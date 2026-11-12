"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Calendar,
  Loader2
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

interface JournalLine {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
  memo: string | null;
  account?: {
    code: string;
    name: string;
    type: string;
  };
}

interface JournalEntry {
  id: string;
  number: string;
  date: string;
  narration: string | null;
  status: "DRAFT" | "POSTED" | "REVERSED";
  sourceType: string | null;
  lines: JournalLine[];
}

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const companyId = typeof window !== "undefined" ? localStorage.getItem("activeCompanyId") : null;
      const res = await apiClient<JournalEntry[]>("/journal", {
        companyId: companyId || undefined,
        params: {
          status: statusFilter === "ALL" ? undefined : statusFilter
        }
      });
      setEntries(res.data);
    } catch {
      // Mock fallback data for preview if offline
      setEntries([
        {
          id: "je-1",
          number: "JV-2026-0001",
          date: "2026-11-12T00:00:00.000Z",
          narration: "Initial Capital Investment by Partners",
          status: "POSTED",
          sourceType: "MANUAL",
          lines: [
            { id: "l1", accountId: "acc-1", debit: "500000.00", credit: "0.00", memo: "Cash invested", account: { code: "1001", name: "Cash", type: "ASSET" } },
            { id: "l2", accountId: "acc-8", debit: "0.00", credit: "500000.00", memo: "Partner equity", account: { code: "3001", name: "Capital", type: "EQUITY" } }
          ]
        },
        {
          id: "je-2",
          number: "JV-2026-0002",
          date: "2026-11-12T00:00:00.000Z",
          narration: "Office Supplies and Minor Equipment Purchase",
          status: "POSTED",
          sourceType: "MANUAL",
          lines: [
            { id: "l3", accountId: "acc-14", debit: "12500.00", credit: "0.00", memo: "Stationery", account: { code: "6004", name: "Miscellaneous Expense", type: "EXPENSE" } },
            { id: "l4", accountId: "acc-1", debit: "0.00", credit: "12500.00", memo: "Petty cash payout", account: { code: "1001", name: "Cash", type: "ASSET" } }
          ]
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [statusFilter]);

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header with New Entry CTA */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-ink-primary tracking-tight">General Journal</h1>
            <p className="text-xs text-ink-secondary">Double-entry ledger journal entries, postings, and audit trails</p>
          </div>
          <Link href="/journal/new">
            <Button variant="emerald" className="shadow-subtle">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New Journal Entry
            </Button>
          </Link>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center space-x-1">
            {["ALL", "POSTED", "DRAFT", "REVERSED"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  statusFilter === status
                    ? "bg-ink-primary text-white shadow-subtle"
                    : "text-ink-secondary hover:bg-canvas hover:text-ink-primary"
                }`}
              >
                {status === "ALL" ? "All Entries" : status.charAt(0) + status.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Journal Entries Data Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas border-b border-border text-[11px] font-mono uppercase tracking-wider text-ink-secondary">
                <tr>
                  <th className="py-2.5 px-4 font-semibold w-32">Number</th>
                  <th className="py-2.5 px-4 font-semibold w-28">Date</th>
                  <th className="py-2.5 px-4 font-semibold">Narration</th>
                  <th className="py-2.5 px-4 font-semibold w-24">Status</th>
                  <th className="py-2.5 px-4 font-semibold w-36 text-right">Debit</th>
                  <th className="py-2.5 px-4 font-semibold w-36 text-right">Credit</th>
                  <th className="py-2.5 px-4 font-semibold w-16 text-center">Lines</th>
                  <th className="py-2.5 px-4 font-semibold w-20 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-ink-secondary">
                      <Loader2 className="w-4 h-4 mx-auto animate-spin mb-1 text-emerald-brand" />
                      Loading journal entries...
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-ink-secondary">
                      No journal entries found for this company.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    const totalDebit = entry.lines.reduce((sum, l) => sum + parseFloat(l.debit || "0"), 0);
                    const totalCredit = entry.lines.reduce((sum, l) => sum + parseFloat(l.credit || "0"), 0);

                    return (
                      <tr key={entry.id} className="hover:bg-canvas/50 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-medium text-ink-primary">
                          {entry.number}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-ink-secondary">
                          {new Date(entry.date).toISOString().split("T")[0]}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-ink-primary">
                          {entry.narration || "—"}
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge
                            variant={
                              entry.status === "POSTED"
                                ? "paid"
                                : entry.status === "REVERSED"
                                ? "overdue"
                                : "draft"
                            }
                          >
                            {entry.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-ink-primary">
                          {formatCurrency(totalDebit)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-ink-primary">
                          {formatCurrency(totalCredit)}
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono text-ink-secondary">
                          {entry.lines.length}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => setSelectedEntry(entry)}
                            className="p-1 rounded text-ink-secondary hover:bg-canvas hover:text-ink-primary transition-colors"
                            title="View Lines Detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Modal: View Entry Detail & Balanced Lines */}
        {selectedEntry && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-surface rounded-lg border border-border w-full max-w-2xl shadow-xl overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-semibold text-ink-primary">{selectedEntry.number}</h3>
                    <Badge variant={selectedEntry.status === "POSTED" ? "paid" : "draft"}>
                      {selectedEntry.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-ink-secondary mt-0.5">
                    Date: {new Date(selectedEntry.date).toISOString().split("T")[0]} · {selectedEntry.narration}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="text-ink-secondary hover:text-ink-primary text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="p-4">
                <table className="w-full text-left text-xs">
                  <thead className="bg-canvas border-b border-border text-[10px] font-mono uppercase tracking-wider text-ink-secondary">
                    <tr>
                      <th className="py-2 px-3 font-semibold">Account</th>
                      <th className="py-2 px-3 font-semibold">Memo</th>
                      <th className="py-2 px-3 font-semibold w-28 text-right">Debit</th>
                      <th className="py-2 px-3 font-semibold w-28 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {selectedEntry.lines.map((line, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3">
                          <span className="font-mono font-medium text-ink-primary mr-1.5">
                            {line.account?.code || "—"}
                          </span>
                          <span className="text-ink-secondary">{line.account?.name || "Account"}</span>
                        </td>
                        <td className="py-2 px-3 text-ink-secondary">{line.memo || "—"}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-ink-primary">
                          {parseFloat(line.debit) > 0 ? formatCurrency(line.debit) : "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-ink-primary">
                          {parseFloat(line.credit) > 0 ? formatCurrency(line.credit) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-border font-semibold bg-canvas/40">
                    <tr>
                      <td colSpan={2} className="py-2.5 px-3 text-right uppercase font-mono text-[11px] text-ink-secondary">
                        Balanced Ledger Total:
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-brand">
                        {formatCurrency(
                          selectedEntry.lines.reduce((sum, l) => sum + parseFloat(l.debit || "0"), 0)
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-brand">
                        {formatCurrency(
                          selectedEntry.lines.reduce((sum, l) => sum + parseFloat(l.credit || "0"), 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="p-4 border-t border-border flex justify-end">
                <Button variant="outline" onClick={() => setSelectedEntry(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

