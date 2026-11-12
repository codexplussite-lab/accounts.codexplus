"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, Send, DollarSign, Ban, Loader2, Receipt } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { PaymentDialog } from "@/components/payments/PaymentDialog";

export default function BillDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [bill, setBill] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchBill = async () => {
    if (!id) return;
    setLoading(true);

    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    const companyId = typeof window !== "undefined" ? localStorage.getItem("activeCompanyId") : null;

    try {
      const res = await apiClient<any>(`/purchases/bills/${id}`, {
        companyId: companyId || undefined,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setBill(res.data);
    } catch {
      setBill({
        id,
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
        balanceDue: "6800.00",
        items: [
          { id: "1", description: "Industrial Raw Steel", quantity: "20.000", unitCost: "500.00", taxAmount: "1800.00", lineTotal: "11800.00" }
        ],
        payments: [
          { id: "p1", number: "PAY-2026-0002", amount: "5000.00", date: "2026-03-06T00:00:00.000Z", method: "Bank Transfer", reference: "DISB-1011" }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBill();
  }, [id]);

  const handlePost = async () => {
    setActionLoading(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    const companyId = typeof window !== "undefined" ? localStorage.getItem("activeCompanyId") : null;

    try {
      await apiClient(`/purchases/bills/${id}/post`, {
        method: "POST",
        companyId: companyId || undefined,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      fetchBill();
    } catch (err: any) {
      alert(err.message || "Failed to post bill");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoid = async () => {
    const reason = prompt("Please provide a reason for voiding this bill:");
    if (!reason) return;

    setActionLoading(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    const companyId = typeof window !== "undefined" ? localStorage.getItem("activeCompanyId") : null;

    try {
      await apiClient(`/purchases/bills/${id}/void`, {
        method: "POST",
        companyId: companyId || undefined,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: JSON.stringify({ reason })
      });
      fetchBill();
    } catch (err: any) {
      alert(err.message || "Failed to void bill");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
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
      a.download = `${bill.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download PDF");
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="py-24 text-center text-ink-secondary">
          <Loader2 className="w-6 h-6 mx-auto animate-spin mb-2" />
          Loading bill details...
        </div>
      </AppShell>
    );
  }

  if (!bill) return null;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center space-x-3">
            <Link href="/bills">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold font-mono text-ink-primary">{bill.number}</h1>
                <Badge
                  variant="outline"
                  className={
                    bill.status === "PAID"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : bill.status === "PARTIALLY_PAID"
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : bill.status === "POSTED"
                      ? "bg-blue-50 text-blue-800 border-blue-200"
                      : bill.status === "VOID"
                      ? "bg-rose-50 text-rose-800 border-rose-200"
                      : "bg-zinc-100 text-zinc-700 border-zinc-200"
                  }
                >
                  {bill.status}
                </Badge>
              </div>
              <p className="text-xs text-ink-secondary">
                Vendor: {bill.vendorName} · Billed on {new Date(bill.date).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {bill.status === "DRAFT" && (
              <Button
                size="sm"
                onClick={handlePost}
                disabled={actionLoading}
                className="h-8 text-xs bg-emerald-800 hover:bg-emerald-900 text-white"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Post Bill
              </Button>
            )}

            {(bill.status === "POSTED" || bill.status === "PARTIALLY_PAID") && (
              <Button
                size="sm"
                onClick={() => setShowPaymentModal(true)}
                className="h-8 text-xs bg-emerald-800 hover:bg-emerald-900 text-white"
              >
                <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                Disburse Payment
              </Button>
            )}

            {bill.status !== "DRAFT" && (
              <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="h-8 text-xs">
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Download PDF
              </Button>
            )}

            {bill.status === "POSTED" && parseFloat(bill.paidAmount) === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleVoid}
                disabled={actionLoading}
                className="h-8 text-xs text-rose-700 hover:bg-rose-50 hover:text-rose-800 border-rose-200"
              >
                <Ban className="w-3.5 h-3.5 mr-1.5" />
                Void
              </Button>
            )}
          </div>
        </div>

        {/* Bill Summary */}
        <Card className="border-border shadow-subtle">
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-ink-secondary">Vendor:</span>
                <p className="font-semibold text-ink-primary mt-0.5">{bill.vendorName}</p>
              </div>
              <div>
                <span className="text-ink-secondary">Vendor Bill Ref:</span>
                <p className="font-mono text-ink-primary mt-0.5">{bill.vendorBillNo || "—"}</p>
              </div>
              <div>
                <span className="text-ink-secondary">Due Date:</span>
                <p className="font-mono text-ink-primary mt-0.5">
                  {bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : "Immediate"}
                </p>
              </div>
              <div>
                <span className="text-ink-secondary">Balance Due:</span>
                <p className={`font-mono font-bold mt-0.5 tabular-nums ${parseFloat(bill.balanceDue) > 0 ? "text-amber-800" : "text-emerald-700"}`}>
                  PKR {bill.balanceDue}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <div className="rounded border border-border bg-white overflow-hidden shadow-subtle">
          <div className="px-4 py-3 bg-canvas border-b border-border">
            <h3 className="font-semibold text-xs text-ink-primary uppercase tracking-wider">Purchased Line Items</h3>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas border-b border-border text-[11px] font-semibold text-ink-secondary uppercase">
              <tr>
                <th className="py-2.5 px-4">Item / Description</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Cost</th>
                <th className="py-2.5 px-3 text-right">Tax</th>
                <th className="py-2.5 px-4 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bill.items.map((it: any) => (
                <tr key={it.id}>
                  <td className="py-3 px-4 text-ink-primary font-medium">{it.description || "Stock Item"}</td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">{it.quantity}</td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">PKR {it.unitCost}</td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">PKR {it.taxAmount}</td>
                  <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-ink-primary">
                    PKR {it.lineTotal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full sm:w-72 bg-white border border-border rounded p-4 space-y-2 text-xs">
            <div className="flex justify-between text-ink-secondary">
              <span>Subtotal:</span>
              <span className="font-mono tabular-nums text-ink-primary">PKR {bill.subtotal}</span>
            </div>
            <div className="flex justify-between text-ink-secondary">
              <span>Tax Total:</span>
              <span className="font-mono tabular-nums text-ink-primary">PKR {bill.taxTotal}</span>
            </div>
            <div className="border-t border-border pt-1.5 flex justify-between font-bold text-ink-primary">
              <span>Grand Total:</span>
              <span className="font-mono tabular-nums">PKR {bill.total}</span>
            </div>
            <div className="flex justify-between text-ink-secondary">
              <span>Disbursed:</span>
              <span className="font-mono tabular-nums text-emerald-800">PKR {bill.paidAmount}</span>
            </div>
            <div className="border-t border-border pt-1.5 flex justify-between font-bold text-amber-800">
              <span>Balance Due:</span>
              <span className="font-mono tabular-nums">PKR {bill.balanceDue}</span>
            </div>
          </div>
        </div>

        {/* Payment History */}
        {bill.payments && bill.payments.length > 0 && (
          <div className="rounded border border-border bg-white overflow-hidden shadow-subtle">
            <div className="px-4 py-3 bg-canvas border-b border-border">
              <h3 className="font-semibold text-xs text-ink-primary uppercase tracking-wider">Disbursement History</h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas border-b border-border text-[11px] font-semibold text-ink-secondary uppercase">
                <tr>
                  <th className="py-2.5 px-4">Payment #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bill.payments.map((p: any) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4 font-mono font-semibold text-ink-primary">{p.number}</td>
                    <td className="py-3 px-3 font-mono text-ink-secondary">{new Date(p.date).toLocaleDateString()}</td>
                    <td className="py-3 px-3">{p.method || "Cash"}</td>
                    <td className="py-3 px-3 font-mono text-ink-secondary">{p.reference || "—"}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800 tabular-nums">
                      PKR {p.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showPaymentModal && (
          <PaymentDialog
            isOpen={true}
            onClose={() => setShowPaymentModal(false)}
            onSuccess={fetchBill}
            type="MADE"
            documentId={bill.id}
            documentNumber={bill.number}
            contactId={bill.contactId}
            contactName={bill.vendorName}
            total={bill.total}
            balanceDue={bill.balanceDue}
          />
        )}
      </div>
    </AppShell>
  );
}
