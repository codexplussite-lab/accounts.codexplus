"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Save,
  Send,
  Loader2
} from "lucide-react";
import Decimal from "decimal.js";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface FormRow {
  id: string;
  accountId: string;
  memo: string;
  debit: string;
  credit: string;
}

export default function NewJournalEntryPage() {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [narration, setNarration] = useState("");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form rows - default 2 lines
  const [rows, setRows] = useState<FormRow[]>([
    { id: "1", accountId: "", memo: "", debit: "0.00", credit: "0.00" },
    { id: "2", accountId: "", memo: "", debit: "0.00", credit: "0.00" }
  ]);

  useEffect(() => {
    const fetchAccounts = async () => {
      setLoadingAccounts(true);
      try {
        const companyId = typeof window !== "undefined" ? localStorage.getItem("activeCompanyId") : null;
        const res = await apiClient<AccountOption[]>("/accounts", {
          companyId: companyId || undefined
        });
        setAccounts(res.data);
      } catch {
        // Fallback accounts for presentation if offline
        setAccounts([
          { id: "acc-1", code: "1001", name: "Cash on Hand", type: "ASSET" },
          { id: "acc-2", code: "1002", name: "Operating Bank Account", type: "ASSET" },
          { id: "acc-3", code: "1100", name: "Accounts Receivable", type: "ASSET" },
          { id: "acc-4", code: "1200", name: "Inventory", type: "ASSET" },
          { id: "acc-5", code: "2001", name: "Accounts Payable", type: "LIABILITY" },
          { id: "acc-6", code: "2100", name: "Sales Tax Payable", type: "LIABILITY" },
          { id: "acc-7", code: "3001", name: "Owner Capital", type: "EQUITY" },
          { id: "acc-8", code: "4001", name: "Sales Revenue", type: "INCOME" },
          { id: "acc-9", code: "5001", name: "Cost of Goods Sold", type: "EXPENSE" },
          { id: "acc-10", code: "6001", name: "Rent Expense", type: "EXPENSE" },
          { id: "acc-11", code: "6004", name: "Miscellaneous Expense", type: "EXPENSE" }
        ]);
      } finally {
        setLoadingAccounts(false);
      }
    };

    fetchAccounts();
  }, []);

  const handleRowChange = (id: string, field: keyof FormRow, value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;

        if (field === "debit" && parseFloat(value || "0") > 0) {
          // Rule: mutually exclusive debit and credit per line
          return { ...row, debit: value, credit: "0.00" };
        }
        if (field === "credit" && parseFloat(value || "0") > 0) {
          return { ...row, credit: value, debit: "0.00" };
        }
        return { ...row, [field]: value };
      })
    );
  };

  const addRow = () => {
    const newId = String(Date.now());
    setRows([...rows, { id: newId, accountId: "", memo: "", debit: "0.00", credit: "0.00" }]);
  };

  const removeRow = (id: string) => {
    if (rows.length <= 2) return; // Keep minimum 2 rows
    setRows(rows.filter((r) => r.id !== id));
  };

  // Decimal calculations for totals
  let totalDebit = new Decimal(0);
  let totalCredit = new Decimal(0);

  rows.forEach((r) => {
    try {
      if (r.debit) totalDebit = totalDebit.plus(new Decimal(r.debit || 0));
      if (r.credit) totalCredit = totalCredit.plus(new Decimal(r.credit || 0));
    } catch {
      // Ignore intermediate typing errors
    }
  });

  const diff = totalDebit.minus(totalCredit).abs();
  const isBalanced = totalDebit.gt(0) && totalDebit.equals(totalCredit);
  const isValidToPost = isBalanced && rows.length >= 2 && rows.every((r) => r.accountId);

  const handleSubmit = async (asDraft: boolean = false) => {
    setError(null);
    setPosting(true);

    try {
      const companyId = typeof window !== "undefined" ? localStorage.getItem("activeCompanyId") : null;
      const endpoint = asDraft ? "/journal/draft" : "/journal";

      const payload = {
        date,
        narration: narration.trim() || undefined,
        lines: rows.map((r) => ({
          accountId: r.accountId,
          debit: r.debit || "0.00",
          credit: r.credit || "0.00",
          memo: r.memo.trim() || undefined
        }))
      };

      await apiClient(endpoint, {
        method: "POST",
        companyId: companyId || undefined,
        body: JSON.stringify(payload)
      });

      router.push("/journal");
    } catch (err: any) {
      setError(err.message || "Failed to post journal entry.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-24">
        {/* Navigation Breadcrumb / Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/journal">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Back to Journal
              </Button>
            </Link>
            <div>
              <h1 className="text-base font-semibold text-ink-primary tracking-tight">
                New Journal Entry
              </h1>
              <p className="text-xs text-ink-secondary">Record double-entry debit and credit lines</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSubmit(true)}
              disabled={posting}
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Save Draft
            </Button>
            <Button
              variant="emerald"
              size="sm"
              onClick={() => handleSubmit(false)}
              disabled={!isValidToPost || posting}
            >
              {posting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Post Entry
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Entry Metadata Card */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-ink-secondary uppercase tracking-wider">
                  Transaction Date
                </label>
                <Input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-[11px] font-medium text-ink-secondary uppercase tracking-wider">
                  Narration / Reference Note
                </label>
                <Input
                  placeholder="e.g. Office rent payment for November 2026"
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lines Data Entry Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas border-b border-border text-[11px] font-mono uppercase tracking-wider text-ink-secondary">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 w-72">Account</th>
                  <th className="py-2.5 px-3">Description / Memo</th>
                  <th className="py-2.5 px-3 w-36 text-right">Debit (PKR)</th>
                  <th className="py-2.5 px-3 w-36 text-right">Credit (PKR)</th>
                  <th className="py-2.5 px-3 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((row, index) => (
                  <tr key={row.id} className="hover:bg-canvas/30 transition-colors">
                    <td className="py-2 px-3 text-center font-mono text-ink-muted">
                      {index + 1}
                    </td>
                    <td className="py-2 px-3">
                      <select
                        required
                        className="flex h-8 w-full rounded border border-border bg-surface px-2 py-1 text-xs text-ink-primary shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink-primary"
                        value={row.accountId}
                        onChange={(e) => handleRowChange(row.id, "accountId", e.target.value)}
                      >
                        <option value="">Select Account...</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name} ({acc.type})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        placeholder="Line note..."
                        value={row.memo}
                        onChange={(e) => handleRowChange(row.id, "memo", e.target.value)}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        isNumeric
                        value={row.debit === "0.00" ? "" : row.debit}
                        placeholder="0.00"
                        onChange={(e) => handleRowChange(row.id, "debit", e.target.value)}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        isNumeric
                        value={row.credit === "0.00" ? "" : row.credit}
                        placeholder="0.00"
                        onChange={(e) => handleRowChange(row.id, "credit", e.target.value)}
                      />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length <= 2}
                        className="text-ink-muted hover:text-rose-600 disabled:opacity-30 disabled:hover:text-ink-muted transition-colors"
                        title={rows.length <= 2 ? "Minimum 2 lines required" : "Remove line"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 border-t border-border bg-canvas/30">
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Row
            </Button>
          </div>
        </Card>

        {/* Sticky Live Balanced Footer Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border shadow-lg p-3 pl-64">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {isBalanced ? (
                <div className="flex items-center space-x-1.5 text-xs text-emerald-800 font-medium bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>BALANCED (Debit == Credit)</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 text-xs text-amber-800 font-medium bg-amber-50 border border-amber-200 px-2.5 py-1 rounded">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>
                    OUT OF BALANCE — Difference: Δ {formatCurrency(diff.toFixed(2))}
                  </span>
                </div>
              )}
              <span className="text-xs text-ink-secondary">
                Lines: {rows.filter((r) => r.accountId).length} / {rows.length}
              </span>
            </div>

            <div className="flex items-center space-x-6 text-xs">
              <div className="text-right">
                <span className="text-[10px] uppercase font-mono text-ink-secondary block">
                  Total Debit
                </span>
                <span className="font-mono font-bold text-sm text-ink-primary tabular-nums">
                  {formatCurrency(totalDebit.toFixed(2))}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-mono text-ink-secondary block">
                  Total Credit
                </span>
                <span className="font-mono font-bold text-sm text-ink-primary tabular-nums">
                  {formatCurrency(totalCredit.toFixed(2))}
                </span>
              </div>

              <Button
                variant="emerald"
                size="lg"
                disabled={!isValidToPost || posting}
                onClick={() => handleSubmit(false)}
              >
                {posting ? "Posting..." : "Post Journal Entry"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

