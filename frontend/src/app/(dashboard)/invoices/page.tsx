"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, Plus, Search, Filter, RefreshCw, Loader2, Download, DollarSign, CheckCircle2, AlertCircle, Ban } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiClient, apiDownload } from "@/lib/api";
import { PaymentDialog } from "@/components/payments/PaymentDialog";
import { useAuth } from "@/context/AuthContext";

interface Invoice {
  id: string;
  number: string;
  customerName: string;
  contactId: string;
  date: string;
  dueDate: string | null;
  status: "DRAFT" | "POSTED" | "PARTIALLY_PAID" | "PAID" | "VOID";
  subtotal: string;
  taxTotal: string;
  total: string;
  paidAmount: string;
  balanceDue: string;
}

export default function InvoicesPage() {
  const { status, activeCompany } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  // Payment Dialog state
  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);

  const fetchInvoices = async () => {
    if (status !== "AUTHENTICATED") return;
    setLoading(true);

    try {
      const res = await apiClient<Invoice[]>("/sales/invoices", {
        params: {
          status: activeTab === "ALL" ? undefined : activeTab,
          search: search || undefined
        }
      });
      setInvoices(res.data);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "AUTHENTICATED") {
      fetchInvoices();
    }
  }, [status, activeCompany?.id, activeTab, search]);

  const handlePostInvoice = async (id: string) => {
    try {
      await apiClient(`/sales/invoices/${id}/post`, {
        method: "POST"
      });
      fetchInvoices();
    } catch (err: any) {
      alert(err.message || "Failed to post invoice");
    }
  };

  const handleDownloadPDF = async (id: string, number: string) => {
    try {
      await apiDownload(`/sales/invoices/${id}/pdf`, `${number}.pdf`);
    } catch {
      alert("Failed to download PDF");
    }
  };

  const getStatusBadge = (status: Invoice["status"]) => {
    switch (status) {
      case "PAID":
        return <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200">PAID</Badge>;
      case "PARTIALLY_PAID":
        return <Badge className="bg-amber-50 text-amber-800 border-amber-200">PARTIAL</Badge>;
      case "POSTED":
        return <Badge className="bg-blue-50 text-blue-800 border-blue-200">POSTED</Badge>;
      case "VOID":
        return <Badge className="bg-rose-50 text-rose-800 border-rose-200">VOID</Badge>;
      case "DRAFT":
      default:
        return <Badge className="bg-zinc-100 text-zinc-700 border-zinc-200">DRAFT</Badge>;
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center space-x-2.5">
              <FileText className="h-4 w-4 text-ink-secondary stroke-[1.5]" />
              <h1 className="text-xl font-semibold tracking-tight text-ink-primary">Sales Invoices</h1>
            </div>
            <p className="mt-1 text-xs text-ink-secondary">
              Tax invoices with double-entry posting, inventory movements, and PDF export
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button variant="outline" size="sm" onClick={fetchInvoices} disabled={loading} className="h-8 text-xs">
              <RefreshCw className={`h-4 w-4 mr-1.5 text-ink-secondary stroke-[1.5] ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link
              href="/invoices/new"
              className="inline-flex items-center justify-center rounded-md bg-emerald-brand hover:bg-emerald-900 text-white h-8 px-3 text-xs font-medium transition-colors"
            >
              <Plus className="h-4 w-4 mr-1.5 stroke-[1.5]" />
              Create Invoice
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-3 rounded border border-border">
          <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto">
            {["ALL", "DRAFT", "POSTED", "PARTIALLY_PAID", "PAID", "VOID"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? "bg-ink-primary text-white"
                    : "text-ink-secondary hover:text-ink-primary hover:bg-canvas"
                }`}
              >
                {tab === "ALL" ? "All Invoices" : tab.replace("_", " ")}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-secondary" />
            <Input
              placeholder="Search by invoice # or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-white"
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded border border-border bg-white overflow-hidden shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas border-b border-border text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-4 text-right">Grand Total</th>
                  <th className="py-2.5 px-4 text-right">Balance Due</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-ink-secondary">
                      <Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" />
                      Loading sales invoices...
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-ink-secondary">
                      No invoices found matching criteria.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-canvas/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-ink-primary">
                        <Link href={`/invoices/${inv.id}`} className="hover:text-emerald-800">
                          {inv.number}
                        </Link>
                      </td>
                      <td className="py-3 px-3 font-semibold text-ink-primary">
                        {inv.customerName}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-ink-secondary">
                        {new Date(inv.date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3">
                        {getStatusBadge(inv.status)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-ink-primary">
                        PKR {inv.total}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                        <span className={parseFloat(inv.balanceDue) > 0 ? "text-rose-700" : "text-emerald-700"}>
                          PKR {inv.balanceDue}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.status === "DRAFT" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePostInvoice(inv.id)}
                              className="h-7 text-[11px] bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                            >
                              Post
                            </Button>
                          )}

                          {(inv.status === "POSTED" || inv.status === "PARTIALLY_PAID") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPaymentTarget(inv)}
                              className="h-7 text-[11px] bg-emerald-800 text-white hover:bg-emerald-900 border-none"
                            >
                              <DollarSign className="w-3 h-3 mr-1" />
                              Pay
                            </Button>
                          )}

                          {inv.status !== "DRAFT" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadPDF(inv.id, inv.number)}
                              className="h-7 text-[11px]"
                              title="Download PDF"
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                          )}

                          <Link href={`/invoices/${inv.id}`}>
                            <Button variant="outline" size="sm" className="h-7 text-[11px]">
                              View
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Modal */}
        {paymentTarget && (
          <PaymentDialog
            isOpen={true}
            onClose={() => setPaymentTarget(null)}
            onSuccess={fetchInvoices}
            type="RECEIVED"
            documentId={paymentTarget.id}
            documentNumber={paymentTarget.number}
            contactId={paymentTarget.contactId}
            contactName={paymentTarget.customerName}
            total={paymentTarget.total}
            balanceDue={paymentTarget.balanceDue}
          />
        )}
      </div>
    </AppShell>
  );
}
