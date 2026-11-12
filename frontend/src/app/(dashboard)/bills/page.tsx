"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Receipt, Plus, Search, Filter, RefreshCw, Loader2, Download, DollarSign } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { PaymentDialog } from "@/components/payments/PaymentDialog";

interface Bill {
  id: string;
  number: string;
  vendorBillNo: string | null;
  vendorName: string;
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

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const [paymentTarget, setPaymentTarget] = useState<Bill | null>(null);

  const fetchBills = async () => {
    setLoading(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    const companyId = typeof window !== "undefined" ? localStorage.getItem("activeCompanyId") : null;

    try {
      const res = await apiClient<Bill[]>("/purchases/bills", {
        companyId: companyId || undefined,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        params: {
          status: activeTab === "ALL" ? undefined : activeTab,
          search: search || undefined
        }
      });
      setBills(res.data);
    } catch {
      setBills([
        {
          id: "1",
          number: "BILL-2026-0001",
          vendorBillNo: "VB-8899",
          vendorName: "Prime Materials Ltd",
          contactId: "v1",
          date: "2026-03-02T00:00:00.000Z",
          dueDate: "2026-03-16T00:00:00.000Z",
          status: "POSTED",
          subtotal: "10000.00",
          taxTotal: "1800.00",
          total: "11800.00",
          paidAmount: "5000.00",
          balanceDue: "6800.00"
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, [activeTab, search]);

  const handlePostBill = async (id: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    const companyId = typeof window !== "undefined" ? localStorage.getItem("activeCompanyId") : null;

    try {
      await apiClient(`/purchases/bills/${id}/post`, {
        method: "POST",
        companyId: companyId || undefined,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      fetchBills();
    } catch (err: any) {
      alert(err.message || "Failed to post bill");
    }
  };

  const handleDownloadPDF = async (id: string, number: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    const companyId = typeof window !== "undefined" ? localStorage.getItem("activeCompanyId") : null;

    try {
      const response = await fetch(`http://localhost:4000/api/purchases/bills/${id}/pdf`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Company-Id": companyId || ""
        }
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download PDF");
    }
  };

  const getStatusBadge = (status: Bill["status"]) => {
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
              <Receipt className="h-5 w-5 text-emerald-800" />
              <h1 className="text-xl font-bold tracking-tight text-ink-primary">Purchase Bills</h1>
            </div>
            <p className="mt-1 text-xs text-ink-secondary">
              Vendor bills, stock replenishment, weighted average cost recalculation, and payment disbursements.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button variant="outline" size="sm" onClick={fetchBills} disabled={loading} className="h-8 text-xs">
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link href="/bills/new">
              <Button size="sm" className="h-8 text-xs bg-emerald-800 hover:bg-emerald-900 text-white">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Record Bill
              </Button>
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
                {tab === "ALL" ? "All Bills" : tab.replace("_", " ")}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-secondary" />
            <Input
              placeholder="Search by bill #, vendor, or ref..."
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
                  <th className="py-2.5 px-4">Bill #</th>
                  <th className="py-2.5 px-3">Vendor Bill Ref</th>
                  <th className="py-2.5 px-3">Vendor</th>
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
                    <td colSpan={8} className="py-12 text-center text-ink-secondary">
                      <Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" />
                      Loading purchase bills...
                    </td>
                  </tr>
                ) : bills.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-ink-secondary">
                      No purchase bills found matching criteria.
                    </td>
                  </tr>
                ) : (
                  bills.map((b) => (
                    <tr key={b.id} className="hover:bg-canvas/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-ink-primary">
                        <Link href={`/bills/${b.id}`} className="hover:text-emerald-800">
                          {b.number}
                        </Link>
                      </td>
                      <td className="py-3 px-3 font-mono text-ink-secondary">
                        {b.vendorBillNo || "—"}
                      </td>
                      <td className="py-3 px-3 font-semibold text-ink-primary">
                        {b.vendorName}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-ink-secondary">
                        {new Date(b.date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3">
                        {getStatusBadge(b.status)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-ink-primary">
                        PKR {b.total}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                        <span className={parseFloat(b.balanceDue) > 0 ? "text-amber-800" : "text-emerald-700"}>
                          PKR {b.balanceDue}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {b.status === "DRAFT" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePostBill(b.id)}
                              className="h-7 text-[11px] bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                            >
                              Post
                            </Button>
                          )}

                          {(b.status === "POSTED" || b.status === "PARTIALLY_PAID") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPaymentTarget(b)}
                              className="h-7 text-[11px] bg-emerald-800 text-white hover:bg-emerald-900 border-none"
                            >
                              <DollarSign className="w-3 h-3 mr-1" />
                              Pay
                            </Button>
                          )}

                          {b.status !== "DRAFT" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadPDF(b.id, b.number)}
                              className="h-7 text-[11px]"
                              title="Download PDF"
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                          )}

                          <Link href={`/bills/${b.id}`}>
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

        {paymentTarget && (
          <PaymentDialog
            isOpen={true}
            onClose={() => setPaymentTarget(null)}
            onSuccess={fetchBills}
            type="MADE"
            documentId={paymentTarget.id}
            documentNumber={paymentTarget.number}
            contactId={paymentTarget.contactId}
            contactName={paymentTarget.vendorName}
            total={paymentTarget.total}
            balanceDue={paymentTarget.balanceDue}
          />
        )}
      </div>
    </AppShell>
  );
}
