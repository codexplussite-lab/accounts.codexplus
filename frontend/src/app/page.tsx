"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Layers,
  Building2,
  Package,
  AlertTriangle,
  FileText,
  Receipt,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  PlusCircle,
  Database,
  ScanBarcode,
  Landmark,
  Wallet,
  ShieldCheck
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import SpotlightCard from "@/components/react-bits/SpotlightCard";
import Counter from "@/components/react-bits/Counter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface DashboardData {
  balances: {
    cash: string;
    bank: string;
    accountsReceivable: string;
    accountsPayable: string;
  };
  pnl: {
    totalSales: string;
    totalExpenses: string;
    netProfit: string;
    profitMargin: string;
  };
  monthlyTrends: Array<{
    month: string;
    sales: string;
    expenses: string;
    net: string;
  }>;
  inventoryHealth: {
    totalTrackedProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
    deficitProducts: Array<{
      id: string;
      name: string;
      sku: string;
      stock: string;
      reorderLevel: string;
    }>;
  };
  topCustomers: Array<{
    id: string;
    name: string;
    totalRevenue: string;
  }>;
  recentActivity: {
    invoices: Array<{
      id: string;
      number: string;
      date: string;
      total: string;
      status: string;
    }>;
    payments: Array<{
      id: string;
      number: string;
      date: string;
      amount: string;
      type: string;
    }>;
    transactions: Array<{
      id: string;
      number: string;
      date: string;
      narration: string;
      sourceType: string;
    }>;
  };
}

export default function ExecutiveDashboard() {
  const { status, activeCompany } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeActivityTab, setActiveActivityTab] = useState<"invoices" | "payments" | "transactions">("invoices");

  const fetchDashboard = async () => {
    if (status !== "AUTHENTICATED") return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient<DashboardData>("/dashboard/overview");
      setData(res.data);
    } catch (err: any) {
      setError(err?.message || "Failed to load executive dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "AUTHENTICATED") {
      fetchDashboard();
    }
  }, [status, activeCompany?.id]);

  const formatPKR = (val: string | number) => {
    const num = typeof val === "string" ? parseFloat(val) : val;
    return isNaN(num) ? "0.00" : num.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseNumber = (val?: string) => {
    if (!val) return 0;
    const n = parseFloat(val);
    return isNaN(n) ? 0 : Math.round(n);
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Executive Action Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl font-bold tracking-tight text-ink-primary font-heading">
                Executive Financial Dashboard
              </h1>
              <Badge variant="paid" className="font-mono text-[10px]">
                LIVE LEDGER
              </Badge>
            </div>
            <p className="text-xs text-ink-secondary mt-1">
              Multi-tenant, double-entry financial telemetry derived directly from immutable posted journal entries.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDashboard}
              disabled={loading}
              className="text-xs font-mono h-8"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link href="/invoices">
              <Button size="sm" className="bg-emerald-brand hover:bg-emerald-900 text-white text-xs h-8">
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                New Invoice
              </Button>
            </Link>
            <Link href="/tools/import">
              <Button variant="outline" size="sm" className="text-xs h-8">
                <Database className="w-3.5 h-3.5 mr-1.5" />
                CSV Import
              </Button>
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <Button size="sm" variant="outline" onClick={fetchDashboard} className="text-xs h-7">
              Retry
            </Button>
          </div>
        )}

        {/* 1. Core Financial Liquidity & AR/AP Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Cash Balance */}
          <SpotlightCard
            theme="light"
            spotlightColor="rgba(6, 95, 70, 0.08)"
            className="p-4 bg-surface border border-border rounded-lg shadow-subtle"
          >
            <div className="flex items-center justify-between text-xs text-ink-secondary mb-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Wallet className="w-3.5 h-3.5 text-emerald-brand" /> Cash On Hand
              </span>
              <span className="text-[10px] font-mono text-ink-secondary">Account 1001</span>
            </div>
            <div className="text-2xl font-bold font-mono text-ink-primary tabular-nums tracking-tight mt-1">
              PKR{" "}
              {loading ? (
                <span className="animate-pulse text-zinc-300">0.00</span>
              ) : (
                <Counter
                  value={parseNumber(data?.balances.cash)}
                  direction="up"
                  duration={0.8}
                  tabular
                  fontSize="1.5rem"
                  fontWeight={700}
                />
              )}
            </div>
            <div className="mt-2 text-[11px] text-ink-secondary flex items-center justify-between border-t border-border/60 pt-2">
              <span>Immediate Liquidity</span>
              <span className="font-mono tabular-nums text-ink-primary">
                {formatPKR(data?.balances.cash || "0.00")}
              </span>
            </div>
          </SpotlightCard>

          {/* Card 2: Bank Balance */}
          <SpotlightCard
            theme="light"
            spotlightColor="rgba(6, 95, 70, 0.08)"
            className="p-4 bg-surface border border-border rounded-lg shadow-subtle"
          >
            <div className="flex items-center justify-between text-xs text-ink-secondary mb-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Landmark className="w-3.5 h-3.5 text-blue-600" /> Bank Balance
              </span>
              <span className="text-[10px] font-mono text-ink-secondary">Account 1002</span>
            </div>
            <div className="text-2xl font-bold font-mono text-ink-primary tabular-nums tracking-tight mt-1">
              PKR{" "}
              {loading ? (
                <span className="animate-pulse text-zinc-300">0.00</span>
              ) : (
                <Counter
                  value={parseNumber(data?.balances.bank)}
                  direction="up"
                  duration={0.8}
                  tabular
                  fontSize="1.5rem"
                  fontWeight={700}
                />
              )}
            </div>
            <div className="mt-2 text-[11px] text-ink-secondary flex items-center justify-between border-t border-border/60 pt-2">
              <span>Operating Deposits</span>
              <span className="font-mono tabular-nums text-ink-primary">
                {formatPKR(data?.balances.bank || "0.00")}
              </span>
            </div>
          </SpotlightCard>

          {/* Card 3: Accounts Receivable */}
          <SpotlightCard
            theme="light"
            spotlightColor="rgba(6, 95, 70, 0.08)"
            className="p-4 bg-surface border border-border rounded-lg shadow-subtle"
          >
            <div className="flex items-center justify-between text-xs text-ink-secondary mb-1">
              <span className="flex items-center gap-1.5 font-medium">
                <FileText className="w-3.5 h-3.5 text-amber-600" /> Accounts Receivable
              </span>
              <span className="text-[10px] font-mono text-ink-secondary">Account 1100</span>
            </div>
            <div className="text-2xl font-bold font-mono text-ink-primary tabular-nums tracking-tight mt-1">
              PKR{" "}
              {loading ? (
                <span className="animate-pulse text-zinc-300">0.00</span>
              ) : (
                <Counter
                  value={parseNumber(data?.balances.accountsReceivable)}
                  direction="up"
                  duration={0.8}
                  tabular
                  fontSize="1.5rem"
                  fontWeight={700}
                />
              )}
            </div>
            <div className="mt-2 text-[11px] text-ink-secondary flex items-center justify-between border-t border-border/60 pt-2">
              <span>Customer Inflow Due</span>
              <span className="font-mono tabular-nums text-ink-primary">
                {formatPKR(data?.balances.accountsReceivable || "0.00")}
              </span>
            </div>
          </SpotlightCard>

          {/* Card 4: Accounts Payable */}
          <SpotlightCard
            theme="light"
            spotlightColor="rgba(6, 95, 70, 0.08)"
            className="p-4 bg-surface border border-border rounded-lg shadow-subtle"
          >
            <div className="flex items-center justify-between text-xs text-ink-secondary mb-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Receipt className="w-3.5 h-3.5 text-rose-600" /> Accounts Payable
              </span>
              <span className="text-[10px] font-mono text-ink-secondary">Account 2001</span>
            </div>
            <div className="text-2xl font-bold font-mono text-ink-primary tabular-nums tracking-tight mt-1">
              PKR{" "}
              {loading ? (
                <span className="animate-pulse text-zinc-300">0.00</span>
              ) : (
                <Counter
                  value={parseNumber(data?.balances.accountsPayable)}
                  direction="up"
                  duration={0.8}
                  tabular
                  fontSize="1.5rem"
                  fontWeight={700}
                />
              )}
            </div>
            <div className="mt-2 text-[11px] text-ink-secondary flex items-center justify-between border-t border-border/60 pt-2">
              <span>Vendor Liabilities</span>
              <span className="font-mono tabular-nums text-ink-primary">
                {formatPKR(data?.balances.accountsPayable || "0.00")}
              </span>
            </div>
          </SpotlightCard>
        </div>

        {/* 2. P&L Performance & Monthly Financial Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Executive P&L Scorecard */}
          <Card className="border-border shadow-subtle">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-brand" /> Net Profit & Margins
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-mono">
                  MARGIN: {data?.pnl.profitMargin || "0.0%"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="p-3.5 rounded-lg bg-canvas border border-border">
                <span className="text-[11px] text-ink-secondary block mb-1">Net Operating Profit</span>
                <div
                  className={`text-2xl font-bold font-mono tabular-nums ${
                    parseFloat(data?.pnl.netProfit || "0") >= 0 ? "text-emerald-brand" : "text-rose-600"
                  }`}
                >
                  PKR {formatPKR(data?.pnl.netProfit || "0.00")}
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-ink-secondary flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Total Recognized Revenue
                  </span>
                  <span className="font-mono font-medium tabular-nums text-ink-primary">
                    PKR {formatPKR(data?.pnl.totalSales || "0.00")}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-ink-secondary flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> Total Incurred Expenses
                  </span>
                  <span className="font-mono font-medium tabular-nums text-ink-primary">
                    PKR {formatPKR(data?.pnl.totalExpenses || "0.00")}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-ink-secondary flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-brand" /> Ledger Precision
                  </span>
                  <span className="font-mono text-[11px] text-emerald-brand">Strict Double-Entry</span>
                </div>
              </div>

              <div className="pt-2">
                <Link href="/reports?tab=profit-and-loss">
                  <Button variant="outline" className="w-full text-xs h-8">
                    View Full P&L Statement <ArrowRight className="w-3 h-3 ml-1.5" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Revenue vs Expense Monthly Trend Visualizer */}
          <Card className="lg:col-span-2 border-border shadow-subtle">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-ink-primary">
                    Revenue & Expense Timeline
                  </CardTitle>
                  <p className="text-[11px] text-ink-secondary mt-0.5">
                    Monthly breakdown of sales, expenditures, and net financial yield.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono text-[11px]">
                  <span className="flex items-center gap-1.5 text-emerald-brand">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block" /> Sales
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-600">
                    <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" /> Expenses
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {data?.monthlyTrends && data.monthlyTrends.length > 0 ? (
                <div className="space-y-4">
                  {data.monthlyTrends.map((trend) => {
                    const salesVal = parseFloat(trend.sales) || 0;
                    const expVal = parseFloat(trend.expenses) || 0;
                    const maxVal = Math.max(salesVal, expVal, 1000);
                    const salesPercent = Math.min(100, Math.round((salesVal / maxVal) * 100));
                    const expPercent = Math.min(100, Math.round((expVal / maxVal) * 100));

                    return (
                      <div key={trend.month} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="font-semibold text-ink-primary">{trend.month}</span>
                          <span className="text-ink-secondary">
                            Sales: PKR {formatPKR(trend.sales)} | Exp: PKR {formatPKR(trend.expenses)} | Net:{" "}
                            <span
                              className={
                                parseFloat(trend.net) >= 0 ? "text-emerald-brand font-semibold" : "text-rose-600 font-semibold"
                              }
                            >
                              PKR {formatPKR(trend.net)}
                            </span>
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 h-4 bg-canvas rounded overflow-hidden border border-border/50 p-0.5">
                          {/* Sales Bar */}
                          <div className="h-full bg-emerald-50 rounded-sm relative overflow-hidden">
                            <div
                              className="h-full bg-emerald-600 rounded-sm transition-all duration-500"
                              style={{ width: `${salesPercent}%` }}
                            />
                          </div>
                          {/* Expense Bar */}
                          <div className="h-full bg-rose-50 rounded-sm relative overflow-hidden">
                            <div
                              className="h-full bg-rose-500 rounded-sm transition-all duration-500"
                              style={{ width: `${expPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-center p-6 text-ink-secondary">
                  <Clock className="w-8 h-8 mb-2 text-zinc-300" />
                  <p className="text-xs">No monthly trends recorded yet.</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Post invoices or bills to populate monthly financial charts.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 3. Inventory Health & Top Customers Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Inventory Health & Deficit Stock Widget */}
          <Card className="border-border shadow-subtle">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-brand" /> Inventory Health
                </CardTitle>
                <Link href="/inventory">
                  <Badge variant="outline" className="text-[10px] hover:bg-canvas cursor-pointer">
                    Manage Stock
                  </Badge>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-canvas border border-border">
                  <span className="text-[11px] text-ink-secondary block">Low Stock</span>
                  <div className="text-xl font-bold font-mono text-amber-600 mt-1 tabular-nums">
                    {data?.inventoryHealth.lowStockCount || 0}
                  </div>
                  <span className="text-[10px] text-zinc-400">At or below reorder</span>
                </div>
                <div className="p-3 rounded-lg bg-canvas border border-border">
                  <span className="text-[11px] text-ink-secondary block">Out of Stock</span>
                  <div className="text-xl font-bold font-mono text-rose-600 mt-1 tabular-nums">
                    {data?.inventoryHealth.outOfStockCount || 0}
                  </div>
                  <span className="text-[10px] text-zinc-400">Zero or negative</span>
                </div>
              </div>

              {data?.inventoryHealth.deficitProducts && data.inventoryHealth.deficitProducts.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider block">
                    Deficit Warning Items
                  </span>
                  <div className="divide-y divide-border/60 border border-border rounded-md overflow-hidden bg-surface">
                    {data.inventoryHealth.deficitProducts.map((p) => (
                      <div key={p.id} className="p-2.5 flex items-center justify-between text-xs">
                        <div className="truncate pr-2">
                          <p className="font-medium text-ink-primary truncate">{p.name}</p>
                          <p className="text-[10px] font-mono text-ink-secondary">{p.sku}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span
                            className={`font-mono font-bold text-[11px] tabular-nums ${
                              parseFloat(p.stock) <= 0 ? "text-rose-600" : "text-amber-600"
                            }`}
                          >
                            {p.stock} Units
                          </span>
                          <p className="text-[9px] text-zinc-400">Reorder: {p.reorderLevel}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-100 text-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                  <p className="text-xs font-medium text-emerald-900">Stock Levels Healthy</p>
                  <p className="text-[10px] text-emerald-700 mt-0.5">
                    All tracked products are above reorder thresholds.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top 5 Billed Customers Leaderboard */}
          <Card className="border-border shadow-subtle">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-brand" /> Top Valued Customers
                </CardTitle>
                <Link href="/contacts">
                  <Badge variant="outline" className="text-[10px] hover:bg-canvas cursor-pointer">
                    All Contacts
                  </Badge>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {data?.topCustomers && data.topCustomers.length > 0 ? (
                <div className="space-y-2.5">
                  {data.topCustomers.map((cust, idx) => (
                    <div
                      key={cust.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 hover:border-border transition-colors bg-surface"
                    >
                      <div className="flex items-center space-x-2.5 truncate">
                        <span className="w-5 h-5 rounded-full bg-zinc-100 text-ink-primary font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <div className="truncate">
                          <p className="text-xs font-semibold text-ink-primary truncate">{cust.name}</p>
                          <p className="text-[10px] text-ink-secondary">Billed Sales</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs font-mono font-bold text-emerald-brand tabular-nums">
                          PKR {formatPKR(cust.totalRevenue)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-center p-6 text-ink-secondary">
                  <Users className="w-8 h-8 mb-2 text-zinc-300" />
                  <p className="text-xs">No customer revenue recorded.</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">Post customer invoices to generate rankings.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick ERP Shortcuts & System Features */}
          <Card className="border-border shadow-subtle">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-semibold text-ink-primary">ERP Shortcuts</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2">
              <Link href="/invoices/recurring" className="block">
                <div className="p-2.5 rounded-lg border border-border hover:border-emerald-500/50 hover:bg-canvas transition-colors flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <RefreshCw className="w-4 h-4 text-emerald-brand" />
                    <div>
                      <p className="text-xs font-semibold text-ink-primary">Recurring Invoices</p>
                      <p className="text-[10px] text-ink-secondary">Automated schedules & billing</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-ink-secondary" />
                </div>
              </Link>

              <Link href="/tools/import" className="block">
                <div className="p-2.5 rounded-lg border border-border hover:border-emerald-500/50 hover:bg-canvas transition-colors flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <Database className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-xs font-semibold text-ink-primary">Bulk CSV Data Import</p>
                      <p className="text-[10px] text-ink-secondary">Accounts, contacts & stock</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-ink-secondary" />
                </div>
              </Link>

              <Link href="/banking/reconciliation" className="block">
                <div className="p-2.5 rounded-lg border border-border hover:border-emerald-500/50 hover:bg-canvas transition-colors flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <Landmark className="w-4 h-4 text-purple-600" />
                    <div>
                      <p className="text-xs font-semibold text-ink-primary">Bank Reconciliation</p>
                      <p className="text-[10px] text-ink-secondary">CSV statement matching</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-ink-secondary" />
                </div>
              </Link>

              <Link href="/audit-log" className="block">
                <div className="p-2.5 rounded-lg border border-border hover:border-emerald-500/50 hover:bg-canvas transition-colors flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-brand" />
                    <div>
                      <p className="text-xs font-semibold text-ink-primary">Immutable Audit Log</p>
                      <p className="text-[10px] text-ink-secondary">Cryptographic traceability</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-ink-secondary" />
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* 4. Live Ledger Activity Feed (Invoices, Payments, Journal Entries) */}
        <Card className="border-border shadow-subtle">
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold text-ink-primary">
                  Recent Ledger Activity
                </CardTitle>
                <p className="text-[11px] text-ink-secondary mt-0.5">
                  Real-time posted documents, disbursements, and double-entry journals.
                </p>
              </div>

              {/* Activity Filter Tabs */}
              <div className="flex items-center space-x-1 bg-canvas p-1 rounded-md border border-border">
                <button
                  onClick={() => setActiveActivityTab("invoices")}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    activeActivityTab === "invoices"
                      ? "bg-surface text-ink-primary shadow-subtle font-semibold"
                      : "text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  Invoices ({data?.recentActivity.invoices.length || 0})
                </button>
                <button
                  onClick={() => setActiveActivityTab("payments")}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    activeActivityTab === "payments"
                      ? "bg-surface text-ink-primary shadow-subtle font-semibold"
                      : "text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  Payments ({data?.recentActivity.payments.length || 0})
                </button>
                <button
                  onClick={() => setActiveActivityTab("transactions")}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                    activeActivityTab === "transactions"
                      ? "bg-surface text-ink-primary shadow-subtle font-semibold"
                      : "text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  Journals ({data?.recentActivity.transactions.length || 0})
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2 p-0">
            {activeActivityTab === "invoices" && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-canvas border-b border-border text-[11px] text-ink-secondary font-mono">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Invoice Number</th>
                      <th className="py-2.5 px-4 font-medium">Date</th>
                      <th className="py-2.5 px-4 font-medium text-right">Amount (PKR)</th>
                      <th className="py-2.5 px-4 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {data?.recentActivity.invoices && data.recentActivity.invoices.length > 0 ? (
                      data.recentActivity.invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-canvas/50 transition-colors">
                          <td className="py-2.5 px-4 font-mono font-semibold text-ink-primary">
                            <Link href={`/invoices`} className="hover:underline">
                              {inv.number}
                            </Link>
                          </td>
                          <td className="py-2.5 px-4 text-ink-secondary font-mono">
                            {new Date(inv.date).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-ink-primary tabular-nums">
                            {formatPKR(inv.total)}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <Badge
                              variant={
                                inv.status === "PAID"
                                  ? "paid"
                                  : inv.status === "PARTIALLY_PAID"
                                  ? "partially_paid"
                                  : inv.status === "POSTED"
                                  ? "outline"
                                  : "draft"
                              }
                            >
                              {inv.status}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-ink-secondary text-xs">
                          No recent invoices recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeActivityTab === "payments" && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-canvas border-b border-border text-[11px] text-ink-secondary font-mono">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Receipt #</th>
                      <th className="py-2.5 px-4 font-medium">Date</th>
                      <th className="py-2.5 px-4 font-medium">Payment Type</th>
                      <th className="py-2.5 px-4 font-medium text-right">Amount (PKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {data?.recentActivity.payments && data.recentActivity.payments.length > 0 ? (
                      data.recentActivity.payments.map((p) => (
                        <tr key={p.id} className="hover:bg-canvas/50 transition-colors">
                          <td className="py-2.5 px-4 font-mono font-semibold text-ink-primary">{p.number}</td>
                          <td className="py-2.5 px-4 text-ink-secondary font-mono">
                            {new Date(p.date).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-4">
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {p.type}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-brand tabular-nums">
                            {formatPKR(p.amount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-ink-secondary text-xs">
                          No recent payments recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeActivityTab === "transactions" && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-canvas border-b border-border text-[11px] text-ink-secondary font-mono">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Voucher #</th>
                      <th className="py-2.5 px-4 font-medium">Date</th>
                      <th className="py-2.5 px-4 font-medium">Narration</th>
                      <th className="py-2.5 px-4 font-medium text-center">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {data?.recentActivity.transactions && data.recentActivity.transactions.length > 0 ? (
                      data.recentActivity.transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-canvas/50 transition-colors">
                          <td className="py-2.5 px-4 font-mono font-semibold text-ink-primary">
                            <Link href="/journal" className="hover:underline">
                              {tx.number}
                            </Link>
                          </td>
                          <td className="py-2.5 px-4 text-ink-secondary font-mono">
                            {new Date(tx.date).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-4 text-ink-primary">{tx.narration}</td>
                          <td className="py-2.5 px-4 text-center">
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {tx.sourceType}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-ink-secondary text-xs">
                          No recent transactions recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
