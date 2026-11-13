"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BarChart3,
  Scale,
  BookOpen,
  PieChart,
  FileSpreadsheet,
  Download,
  Calendar,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Layers,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";

type ReportType =
  | "trial-balance"
  | "balance-sheet"
  | "profit-and-loss"
  | "general-ledger"
  | "ar-ageing"
  | "ap-ageing"
  | "cash-flow"
  | "tax";

function ReportsDashboardContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams?.get("tab") as ReportType) || "trial-balance";

  const [activeTab, setActiveTab] = useState<ReportType>(initialTab);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  // Filter state
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split("T")[0]);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  // Data state
  const [accounts, setAccounts] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any>(null);

  // Load account list for General Ledger selector
  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await apiClient<any[]>("/accounts");
        setAccounts(res.data);
        if (res.data.length > 0 && !selectedAccountId) {
          setSelectedAccountId(res.data[0].id);
        }
      } catch {
        // Fallback demo accounts
        setAccounts([
          { id: "a1", code: "1001", name: "Cash on Hand", type: "ASSET" },
          { id: "a2", code: "1100", name: "Accounts Receivable", type: "ASSET" },
          { id: "a3", code: "4001", name: "Sales Revenue", type: "INCOME" }
        ]);
        setSelectedAccountId("a1");
      }
    }
    loadAccounts();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      let endpoint = "";
      const params: Record<string, string | undefined> = {};

      switch (activeTab) {
        case "trial-balance":
          endpoint = "/reports/trial-balance";
          params.asOfDate = asOfDate;
          break;
        case "balance-sheet":
          endpoint = "/reports/balance-sheet";
          params.asOfDate = asOfDate;
          break;
        case "profit-and-loss":
          endpoint = "/reports/profit-and-loss";
          params.startDate = startDate;
          params.endDate = endDate;
          break;
        case "general-ledger":
          endpoint = "/reports/general-ledger";
          params.accountId = selectedAccountId;
          params.startDate = startDate;
          params.endDate = endDate;
          break;
        case "ar-ageing":
          endpoint = "/reports/ar-ageing";
          params.asOfDate = asOfDate;
          break;
        case "ap-ageing":
          endpoint = "/reports/ap-ageing";
          params.asOfDate = asOfDate;
          break;
        case "cash-flow":
          endpoint = "/reports/cash-flow";
          params.startDate = startDate;
          params.endDate = endDate;
          break;
        case "tax":
          endpoint = "/reports/tax";
          params.startDate = startDate;
          params.endDate = endDate;
          break;
      }

      const res = await apiClient(endpoint, { params });
      setReportData(res.data);
    } catch {
      // Demo fallback data
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "general-ledger" && !selectedAccountId && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
      return;
    }
    fetchReport();
  }, [activeTab, asOfDate, startDate, endDate, selectedAccountId]);

  const handleExport = async (format: "pdf" | "excel") => {
    setExporting(format);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : "";
      const companyId = typeof window !== "undefined" ? localStorage.getItem("activeCompanyId") : "";

      const queryParams = new URLSearchParams({
        reportType: activeTab,
        format,
        ...(activeTab === "general-ledger" ? { accountId: selectedAccountId } : {}),
        asOfDate,
        startDate,
        endDate
      });

      const url = `http://localhost:4000/api/reports/export?${queryParams.toString()}`;
      const response = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(companyId ? { "X-Company-Id": companyId } : {})
        }
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${activeTab}-${new Date().toISOString().split("T")[0]}.${format === "excel" ? "xlsx" : "pdf"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert(err.message || "Failed to download export");
    } finally {
      setExporting(null);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-emerald-700" />
              <h1 className="text-xl font-bold tracking-tight text-ink-primary">Financial Reporting Center</h1>
            </div>
            <p className="text-xs text-ink-secondary mt-0.5">
              GAAP & IFRS compliant double-entry reports, immutable General Ledger, Trial Balance, P&L, Balance Sheet, and Ageing analysis.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={exporting !== null}
              onClick={() => handleExport("excel")}
              className="h-8 text-xs font-medium"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-emerald-700" />
              {exporting === "excel" ? "Generating XLSX..." : "Export Excel"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting !== null}
              onClick={() => handleExport("pdf")}
              className="h-8 text-xs font-medium"
            >
              <Download className="h-3.5 w-3.5 mr-1.5 text-rose-700" />
              {exporting === "pdf" ? "Generating PDF..." : "Export PDF"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchReport}
              disabled={loading}
              className="h-8 text-xs text-ink-secondary hover:text-ink-primary"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Global Controls & Date Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-3.5 rounded border border-border">
          {/* Report Tab Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "trial-balance", label: "Trial Balance", icon: Scale },
              { id: "balance-sheet", label: "Balance Sheet", icon: Building2 },
              { id: "profit-and-loss", label: "Profit & Loss", icon: PieChart },
              { id: "general-ledger", label: "General Ledger", icon: BookOpen },
              { id: "ar-ageing", label: "AR Ageing", icon: Clock },
              { id: "ap-ageing", label: "AP Ageing", icon: Clock },
              { id: "cash-flow", label: "Cash Flow", icon: DollarSign },
              { id: "tax", label: "Tax Report", icon: Layers }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ReportType)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                    activeTab === tab.id
                      ? "bg-ink-primary text-white shadow-subtle"
                      : "text-ink-secondary hover:bg-canvas hover:text-ink-primary"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Date Range & Specific Parameters */}
          <div className="flex items-center space-x-2">
            {activeTab === "general-ledger" && (
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="h-8 text-xs rounded border border-border bg-canvas px-2 text-ink-primary font-mono focus:outline-none focus:ring-1 focus:ring-emerald-700"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            )}

            {activeTab === "trial-balance" || activeTab === "balance-sheet" || activeTab === "ar-ageing" || activeTab === "ap-ageing" ? (
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-medium text-ink-secondary">As of:</span>
                <Input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="h-8 text-xs font-mono bg-canvas w-36"
                />
              </div>
            ) : (
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-medium text-ink-secondary">From:</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 text-xs font-mono bg-canvas w-32"
                />
                <span className="text-[11px] font-medium text-ink-secondary">To:</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 text-xs font-mono bg-canvas w-32"
                />
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Report View */}
        {loading ? (
          <div className="rounded border border-border bg-surface p-12 text-center text-xs text-ink-secondary">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-700" />
            Loading financial ledger records...
          </div>
        ) : !reportData ? (
          <div className="rounded border border-border bg-surface p-8 text-center text-xs text-ink-secondary">
            No transaction records found for the selected reporting parameters.
          </div>
        ) : (
          <div className="space-y-6">
            {/* 1. Trial Balance View */}
            {activeTab === "trial-balance" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded bg-surface border border-border">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-ink-secondary">Trial Balance Status:</span>
                    {reportData.isBalanced ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        BALANCED (Variance: PKR 0.00)
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                        <AlertCircle className="w-3.5 h-3.5 mr-1" />
                        UNBALANCED (Variance: PKR {reportData.variance})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-6 text-xs font-mono">
                    <div>
                      <span className="text-ink-secondary mr-2">Total Debit:</span>
                      <span className="font-bold tabular-nums text-ink-primary">PKR {reportData.totalDebit}</span>
                    </div>
                    <div>
                      <span className="text-ink-secondary mr-2">Total Credit:</span>
                      <span className="font-bold tabular-nums text-ink-primary">PKR {reportData.totalCredit}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded border border-border bg-surface overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-canvas border-b border-border text-[10px] uppercase font-medium text-ink-secondary">
                      <tr>
                        <th className="py-2.5 px-3">Code</th>
                        <th className="py-2.5 px-3">Account Name</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-right">Debit (PKR)</th>
                        <th className="py-2.5 px-3 text-right">Credit (PKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono text-[11px]">
                      {reportData.accounts?.map((acc: any) => (
                        <tr key={acc.accountId} className="hover:bg-canvas/50 transition-colors">
                          <td className="py-2 px-3 font-medium text-ink-primary">{acc.code}</td>
                          <td className="py-2 px-3 font-sans text-xs text-ink-primary">{acc.name}</td>
                          <td className="py-2 px-3 text-ink-secondary text-[10px]">{acc.type}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-emerald-800">
                            {parseFloat(acc.debit) > 0 ? acc.debit : "—"}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-rose-800">
                            {parseFloat(acc.credit) > 0 ? acc.credit : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-canvas border-t-2 border-border font-mono font-bold text-xs tabular-nums">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-3 text-ink-primary">GRAND TOTAL:</td>
                        <td className="py-2.5 px-3 text-right text-emerald-800">PKR {reportData.totalDebit}</td>
                        <td className="py-2.5 px-3 text-right text-rose-800">PKR {reportData.totalCredit}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* 2. Balance Sheet View */}
            {activeTab === "balance-sheet" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border border-border bg-surface p-4">
                    <p className="text-[10px] uppercase font-semibold text-ink-secondary">Total Assets</p>
                    <p className="text-2xl font-mono font-bold text-ink-primary mt-1 tabular-nums">
                      PKR {reportData.assets?.total}
                    </p>
                  </Card>
                  <Card className="border border-border bg-surface p-4">
                    <p className="text-[10px] uppercase font-semibold text-ink-secondary">Total Liabilities</p>
                    <p className="text-2xl font-mono font-bold text-rose-800 mt-1 tabular-nums">
                      PKR {reportData.liabilities?.total}
                    </p>
                  </Card>
                  <Card className="border border-border bg-surface p-4">
                    <p className="text-[10px] uppercase font-semibold text-ink-secondary">Total Equity (inc. Net Profit)</p>
                    <p className="text-2xl font-mono font-bold text-emerald-800 mt-1 tabular-nums">
                      PKR {reportData.equity?.total}
                    </p>
                  </Card>
                </div>

                <div className="rounded border border-border bg-surface p-4 space-y-6">
                  {/* Assets Section */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary border-b border-border pb-1 mb-2">
                      Assets
                    </h3>
                    <div className="divide-y divide-border font-mono text-xs">
                      {reportData.assets?.accounts?.map((a: any) => (
                        <div key={a.id} className="flex justify-between py-1.5">
                          <span className="font-sans">{a.code} — {a.name}</span>
                          <span className="tabular-nums font-semibold">PKR {a.amount}</span>
                        </div>
                      ))}
                      <div className="flex justify-between py-2 font-bold bg-canvas/50 px-2 rounded">
                        <span>Total Assets:</span>
                        <span className="tabular-nums">PKR {reportData.assets?.total}</span>
                      </div>
                    </div>
                  </div>

                  {/* Liabilities Section */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary border-b border-border pb-1 mb-2">
                      Liabilities
                    </h3>
                    <div className="divide-y divide-border font-mono text-xs">
                      {reportData.liabilities?.accounts?.map((a: any) => (
                        <div key={a.id} className="flex justify-between py-1.5">
                          <span className="font-sans">{a.code} — {a.name}</span>
                          <span className="tabular-nums font-semibold">PKR {a.amount}</span>
                        </div>
                      ))}
                      <div className="flex justify-between py-2 font-bold bg-canvas/50 px-2 rounded">
                        <span>Total Liabilities:</span>
                        <span className="tabular-nums">PKR {reportData.liabilities?.total}</span>
                      </div>
                    </div>
                  </div>

                  {/* Equity Section */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary border-b border-border pb-1 mb-2">
                      Equity
                    </h3>
                    <div className="divide-y divide-border font-mono text-xs">
                      {reportData.equity?.accounts?.map((a: any) => (
                        <div key={a.id} className="flex justify-between py-1.5">
                          <span className="font-sans">{a.code} — {a.name}</span>
                          <span className="tabular-nums font-semibold">PKR {a.amount}</span>
                        </div>
                      ))}
                      <div className="flex justify-between py-1.5 text-emerald-800">
                        <span className="font-sans">Current Period Net Earnings</span>
                        <span className="tabular-nums font-semibold">PKR {reportData.equity?.currentPeriodNetEarnings}</span>
                      </div>
                      <div className="flex justify-between py-2 font-bold bg-canvas/50 px-2 rounded">
                        <span>Total Equity:</span>
                        <span className="tabular-nums">PKR {reportData.equity?.total}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Profit & Loss View */}
            {activeTab === "profit-and-loss" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="border border-border bg-surface p-4">
                    <p className="text-[10px] uppercase font-semibold text-ink-secondary">Total Revenue</p>
                    <p className="text-2xl font-mono font-bold text-ink-primary mt-1 tabular-nums">
                      PKR {reportData.revenue?.total}
                    </p>
                  </Card>
                  <Card className="border border-border bg-surface p-4">
                    <p className="text-[10px] uppercase font-semibold text-ink-secondary">Cost of Goods Sold</p>
                    <p className="text-2xl font-mono font-bold text-rose-800 mt-1 tabular-nums">
                      PKR {reportData.costOfGoodsSold?.total}
                    </p>
                  </Card>
                  <Card className="border border-border bg-surface p-4">
                    <p className="text-[10px] uppercase font-semibold text-ink-secondary">Gross Profit</p>
                    <p className="text-2xl font-mono font-bold text-ink-primary mt-1 tabular-nums">
                      PKR {reportData.grossProfit}
                    </p>
                  </Card>
                  <Card className="border border-border bg-surface p-4">
                    <p className="text-[10px] uppercase font-semibold text-ink-secondary">Net Profit</p>
                    <p className="text-2xl font-mono font-bold text-emerald-800 mt-1 tabular-nums">
                      PKR {reportData.netProfit}
                    </p>
                  </Card>
                </div>

                <div className="rounded border border-border bg-surface p-4 space-y-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary border-b border-border pb-1 mb-2">
                      Operating Income
                    </h3>
                    <div className="divide-y divide-border font-mono text-xs">
                      {reportData.revenue?.accounts?.map((a: any) => (
                        <div key={a.id} className="flex justify-between py-1.5">
                          <span className="font-sans">{a.code} — {a.name}</span>
                          <span className="tabular-nums font-semibold">PKR {a.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary border-b border-border pb-1 mb-2">
                      Cost of Goods Sold (COGS)
                    </h3>
                    <div className="divide-y divide-border font-mono text-xs">
                      {reportData.costOfGoodsSold?.accounts?.map((a: any) => (
                        <div key={a.id} className="flex justify-between py-1.5">
                          <span className="font-sans">{a.code} — {a.name}</span>
                          <span className="tabular-nums font-semibold">PKR {a.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary border-b border-border pb-1 mb-2">
                      Operating Expenses
                    </h3>
                    <div className="divide-y divide-border font-mono text-xs">
                      {reportData.operatingExpenses?.accounts?.map((a: any) => (
                        <div key={a.id} className="flex justify-between py-1.5">
                          <span className="font-sans">{a.code} — {a.name}</span>
                          <span className="tabular-nums font-semibold">PKR {a.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. General Ledger View */}
            {activeTab === "general-ledger" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 rounded bg-surface border border-border text-xs">
                  <div>
                    <span className="text-ink-secondary mr-2">Account:</span>
                    <span className="font-mono font-bold text-ink-primary">
                      {reportData.account?.code} — {reportData.account?.name}
                    </span>
                  </div>
                  <div className="flex items-center space-x-6 font-mono">
                    <div>
                      <span className="text-ink-secondary mr-2">Opening:</span>
                      <span className="tabular-nums font-bold">PKR {reportData.openingBalance}</span>
                    </div>
                    <div>
                      <span className="text-ink-secondary mr-2">Closing:</span>
                      <span className="tabular-nums font-bold text-emerald-800">PKR {reportData.closingBalance}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded border border-border bg-surface overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-canvas border-b border-border text-[10px] uppercase font-medium text-ink-secondary">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Entry #</th>
                        <th className="py-2.5 px-3">Source</th>
                        <th className="py-2.5 px-3">Narration / Memo</th>
                        <th className="py-2.5 px-3 text-right">Debit</th>
                        <th className="py-2.5 px-3 text-right">Credit</th>
                        <th className="py-2.5 px-3 text-right">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono text-[11px]">
                      {reportData.transactions?.map((t: any) => (
                        <tr key={t.id} className="hover:bg-canvas/50 transition-colors">
                          <td className="py-2 px-3 text-ink-secondary">{new Date(t.date).toLocaleDateString()}</td>
                          <td className="py-2 px-3 font-medium text-ink-primary">{t.entryNumber}</td>
                          <td className="py-2 px-3 text-ink-secondary">{t.sourceType}</td>
                          <td className="py-2 px-3 font-sans text-xs text-ink-primary max-w-xs truncate">{t.narration || t.memo || "—"}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-emerald-800">
                            {parseFloat(t.debit) > 0 ? t.debit : "—"}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-rose-800">
                            {parseFloat(t.credit) > 0 ? t.credit : "—"}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold text-ink-primary">
                            PKR {t.runningBalance}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. AR Ageing View */}
            {activeTab === "ar-ageing" && (
              <div className="rounded border border-border bg-surface overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-canvas border-b border-border text-[10px] uppercase font-medium text-ink-secondary">
                    <tr>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3 text-right">Outstanding</th>
                      <th className="py-2.5 px-3 text-right">Current</th>
                      <th className="py-2.5 px-3 text-right">0–30 Days</th>
                      <th className="py-2.5 px-3 text-right">31–60 Days</th>
                      <th className="py-2.5 px-3 text-right">61–90 Days</th>
                      <th className="py-2.5 px-3 text-right">90+ Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono text-[11px] tabular-nums">
                    {reportData.customers?.map((c: any) => (
                      <tr key={c.contactId} className="hover:bg-canvas/50 transition-colors">
                        <td className="py-2 px-3 font-sans font-medium text-ink-primary">{c.customerName}</td>
                        <td className="py-2 px-3 text-right font-bold text-ink-primary">PKR {c.totalOutstanding}</td>
                        <td className="py-2 px-3 text-right text-emerald-800">{c.current}</td>
                        <td className="py-2 px-3 text-right text-amber-700">{c.days0_30}</td>
                        <td className="py-2 px-3 text-right text-amber-800">{c.days31_60}</td>
                        <td className="py-2 px-3 text-right text-rose-700">{c.days61_90}</td>
                        <td className="py-2 px-3 text-right text-rose-900 font-bold">{c.days90Plus}</td>
                      </tr>
                    ))}
                  </tbody>
                  {reportData.totals && (
                    <tfoot className="bg-canvas border-t-2 border-border font-mono font-bold text-xs tabular-nums">
                      <tr>
                        <td className="py-2.5 px-3">TOTAL:</td>
                        <td className="py-2.5 px-3 text-right text-ink-primary">PKR {reportData.totals.totalOutstanding}</td>
                        <td className="py-2.5 px-3 text-right">{reportData.totals.current}</td>
                        <td className="py-2.5 px-3 text-right">{reportData.totals.days0_30}</td>
                        <td className="py-2.5 px-3 text-right">{reportData.totals.days31_60}</td>
                        <td className="py-2.5 px-3 text-right">{reportData.totals.days61_90}</td>
                        <td className="py-2.5 px-3 text-right">{reportData.totals.days90Plus}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* 6. AP Ageing View */}
            {activeTab === "ap-ageing" && (
              <div className="rounded border border-border bg-surface overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-canvas border-b border-border text-[10px] uppercase font-medium text-ink-secondary">
                    <tr>
                      <th className="py-2.5 px-3">Vendor</th>
                      <th className="py-2.5 px-3 text-right">Outstanding</th>
                      <th className="py-2.5 px-3 text-right">Current</th>
                      <th className="py-2.5 px-3 text-right">0–30 Days</th>
                      <th className="py-2.5 px-3 text-right">31–60 Days</th>
                      <th className="py-2.5 px-3 text-right">61–90 Days</th>
                      <th className="py-2.5 px-3 text-right">90+ Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono text-[11px] tabular-nums">
                    {reportData.vendors?.map((v: any) => (
                      <tr key={v.contactId} className="hover:bg-canvas/50 transition-colors">
                        <td className="py-2 px-3 font-sans font-medium text-ink-primary">{v.vendorName}</td>
                        <td className="py-2 px-3 text-right font-bold text-ink-primary">PKR {v.totalOutstanding}</td>
                        <td className="py-2 px-3 text-right text-emerald-800">{v.current}</td>
                        <td className="py-2 px-3 text-right text-amber-700">{v.days0_30}</td>
                        <td className="py-2 px-3 text-right text-amber-800">{v.days31_60}</td>
                        <td className="py-2 px-3 text-right text-rose-700">{v.days61_90}</td>
                        <td className="py-2 px-3 text-right text-rose-900 font-bold">{v.days90Plus}</td>
                      </tr>
                    ))}
                  </tbody>
                  {reportData.totals && (
                    <tfoot className="bg-canvas border-t-2 border-border font-mono font-bold text-xs tabular-nums">
                      <tr>
                        <td className="py-2.5 px-3">TOTAL:</td>
                        <td className="py-2.5 px-3 text-right text-ink-primary">PKR {reportData.totals.totalOutstanding}</td>
                        <td className="py-2.5 px-3 text-right">{reportData.totals.current}</td>
                        <td className="py-2.5 px-3 text-right">{reportData.totals.days0_30}</td>
                        <td className="py-2.5 px-3 text-right">{reportData.totals.days31_60}</td>
                        <td className="py-2.5 px-3 text-right">{reportData.totals.days61_90}</td>
                        <td className="py-2.5 px-3 text-right">{reportData.totals.days90Plus}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* 7. Cash Flow View */}
            {activeTab === "cash-flow" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="border border-border bg-surface p-4">
                    <p className="text-[10px] uppercase font-semibold text-ink-secondary">Opening Cash & Bank</p>
                    <p className="text-2xl font-mono font-bold text-ink-primary mt-1 tabular-nums">
                      PKR {reportData.openingBalance}
                    </p>
                  </Card>
                  <Card className="border border-border bg-surface p-4">
                    <p className="text-[10px] uppercase font-semibold text-ink-secondary">Total Inflows</p>
                    <p className="text-2xl font-mono font-bold text-emerald-800 mt-1 tabular-nums">
                      PKR {reportData.inflows?.total}
                    </p>
                  </Card>
                  <Card className="border border-border bg-surface p-4">
                    <p className="text-[10px] uppercase font-semibold text-ink-secondary">Total Outflows</p>
                    <p className="text-2xl font-mono font-bold text-rose-800 mt-1 tabular-nums">
                      PKR {reportData.outflows?.total}
                    </p>
                  </Card>
                  <Card className="border border-border bg-surface p-4">
                    <p className="text-[10px] uppercase font-semibold text-ink-secondary">Closing Cash & Bank</p>
                    <p className="text-2xl font-mono font-bold text-ink-primary mt-1 tabular-nums">
                      PKR {reportData.closingBalance}
                    </p>
                  </Card>
                </div>
              </div>
            )}

            {/* 8. Tax Report View */}
            {activeTab === "tax" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border border-border bg-surface p-4">
                    <p className="text-[10px] uppercase font-semibold text-ink-secondary">Sales Tax Payable (Output)</p>
                    <p className="text-2xl font-mono font-bold text-rose-800 mt-1 tabular-nums">
                      PKR {reportData.summary?.outputTaxPayable}
                    </p>
                  </Card>
                  <Card className="border border-border bg-surface p-4">
                    <p className="text-[10px] uppercase font-semibold text-ink-secondary">Tax Receivable (Input)</p>
                    <p className="text-2xl font-mono font-bold text-emerald-800 mt-1 tabular-nums">
                      PKR {reportData.summary?.inputTaxReceivable}
                    </p>
                  </Card>
                  <Card className="border border-border bg-surface p-4">
                    <p className="text-[10px] uppercase font-semibold text-ink-secondary">Net Tax Position</p>
                    <p className="text-2xl font-mono font-bold text-ink-primary mt-1 tabular-nums">
                      PKR {reportData.summary?.netTaxPosition}
                    </p>
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="py-12 text-center text-xs text-ink-secondary">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-emerald-700" />
            Loading reporting modules...
          </div>
        </AppShell>
      }
    >
      <ReportsDashboardContent />
    </Suspense>
  );
}
