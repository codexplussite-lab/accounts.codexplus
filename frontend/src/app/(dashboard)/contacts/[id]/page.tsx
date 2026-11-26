"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, Building, Mail, Phone, RefreshCw, Loader2, FileText, DollarSign, Calendar } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface LedgerEntry {
  id: string;
  date: string;
  documentNumber: string;
  sourceType: string;
  description: string;
  debit: string;
  credit: string;
  runningBalance: string;
}

export default function ContactDetailPage() {
  const { status, activeCompany } = useAuth();
  const params = useParams();
  const id = params?.id as string;

  const [contact, setContact] = useState<any>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLedger = async () => {
    if (!id || status !== "AUTHENTICATED") return;
    setLoading(true);

    try {
      const res = await apiClient<{ contact: any; ledger: LedgerEntry[] }>(`/contacts/${id}/ledger`);
      setContact(res.data.contact);
      setLedger(res.data.ledger);
    } catch {
      setContact(null);
      setLedger([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "AUTHENTICATED") {
      fetchLedger();
    }
  }, [id, status, activeCompany?.id]);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center space-x-3">
            <Link href="/contacts">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-ink-primary flex items-center gap-2">
                {contact?.name || "Contact Ledger"}
                {contact?.type && (
                  <Badge variant="outline" className="text-xs font-normal">
                    {contact.type}
                  </Badge>
                )}
              </h1>
              <p className="text-xs text-ink-secondary">
                Audit-backed ledger statement with chronological running balance.
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={fetchLedger} disabled={loading} className="h-8 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Ledger
          </Button>
        </div>

        {/* Balance Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-semibold text-ink-secondary">Opening Balance</span>
              <div className="text-lg font-mono font-bold text-ink-primary tabular-nums">
                PKR {contact?.openingBalance || "0.00"}
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-emerald-50/40">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-semibold text-emerald-800">Current Outstanding Balance</span>
              <div className="text-lg font-mono font-bold text-emerald-900 tabular-nums">
                PKR {contact?.closingBalance || "0.00"}
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-semibold text-ink-secondary">Ledger Verification</span>
              <div className="text-xs text-ink-primary flex items-center gap-1.5 pt-1">
                <BookOpen className="w-4 h-4 text-emerald-700" />
                <span>Strict Double-Entry Derived</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ledger Table */}
        <div className="rounded border border-border bg-white overflow-hidden shadow-subtle">
          <div className="px-4 py-3 bg-canvas border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-xs text-ink-primary uppercase tracking-wider">
              Statement of Account
            </h3>
            <span className="text-xs text-ink-secondary">
              Showing {ledger.length} entries
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas border-b border-border text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-3">Doc #</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-4 text-right">Debit</th>
                  <th className="py-2.5 px-4 text-right">Credit</th>
                  <th className="py-2.5 px-4 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-ink-secondary">
                      <Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" />
                      Loading ledger entries...
                    </td>
                  </tr>
                ) : ledger.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-ink-secondary">
                      No ledger transactions recorded for this contact.
                    </td>
                  </tr>
                ) : (
                  ledger.map((entry) => (
                    <tr key={entry.id} className="hover:bg-canvas/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-ink-secondary whitespace-nowrap">
                        {entry.date ? new Date(entry.date).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-ink-primary whitespace-nowrap">
                        {entry.documentNumber}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className="text-[10px]">
                          {entry.sourceType}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-ink-primary max-w-xs truncate">
                        {entry.description}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-ink-primary">
                        {parseFloat(entry.debit) > 0 ? `PKR ${entry.debit}` : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-ink-primary">
                        {parseFloat(entry.credit) > 0 ? `PKR ${entry.credit}` : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-ink-primary">
                        PKR {entry.runningBalance}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
