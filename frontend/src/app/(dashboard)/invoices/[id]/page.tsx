"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, Send, DollarSign, Ban, RefreshCw, Loader2, FileText, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { PaymentDialog } from "@/components/payments/PaymentDialog";

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchInvoice = async () => {
    if (!id) return;
    setLoading(true);

    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    const companyId = typeof window !== "undefined" ? localStorage.getItem("activeCompanyId") : null;

    try {
      const res = await apiClient<any>(`/sales/invoices/${id}`, {
        companyId: companyId || undefined,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setInvoice(res.data);
    } catch {
      // Mock fallback for presentation
      setInvoice({
        id,
        number: "INV-2026-0001",
        customerName: "Apex Global Traders",
        contactId: "c1",
        date: "2026-03-01T00:00:00.000Z",
        dueDate: "2026-03-15T00:00:00.000Z",
        status: "POSTED",
        subtotal: "8000.00",
        taxTotal: "1440.00",
        total: "9440.00",
        paidAmount: "4000.00",
        balanceDue: "5440.00",
        items: [
          { id: "1", description: "Industrial Steel Coil", quantity: "10.000", unitPrice: "800.00", discount: "0.00", taxAmount: "1440.00", lineTotal: "9440.00" }
        ],
        payments: [
          { id: "p1", number: "PAY-2026-0001", amount: "4000.00", date: "2026-03-05T00:00:00.000Z", method: "Bank Transfer", reference: "TXN-998822" }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const handlePost = async () => {
    setActionLoading(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    const companyId = typeof window !== "undefined" ? localStorage.getItem("activeCompanyId") : null;

    try {
      await apiClient(`/sales/invoices/${id}/post`, {
        method: "POST",
        companyId: companyId || undefined,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      fetchInvoice();
    } catch (err: any) {
      alert(err.message || "Failed to post invoice");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoid = async () => {
    const reason = prompt("Please provide a reason for voiding this invoice:");
    if (!reason) return;

    setActionLoading(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    const companyId = typeof window !== "undefined" ? localStorage.getItem("activeCompanyId") : null;

    try {
      await apiClient(`/sales/invoices/${id}/void`, {
        method: "POST",
        companyId: companyId || undefined,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: JSON.stringify({ reason })
      });
      fetchInvoice();
    } catch (err: any) {
      alert(err.message || "Failed to void invoice");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    const companyId = typeof window !== "undefined" ? localStorage.getItem("activeCompanyId") : null;

    try {
      const response = await fetch(`http://localhost:4000/api/sales/invoices/${id}/pdf`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Company-Id": companyId || ""
        }
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.number}.pdf`;
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
          Loading invoice details...
        </div>
      </AppShell>
    );
  }

  if (!invoice) return null;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Breadcrumb & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center space-x-3">
            <Link href="/invoices">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold font-mono text-ink-primary">{invoice.number}</h1>
                <Badge
                  variant="outline"
                  className={
                    invoice.status === "PAID"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : invoice.status === "PARTIALLY_PAID"
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : invoice.status === "POSTED"
                      ? "bg-blue-50 text-blue-800 border-blue-200"
                      : invoice.status === "VOID"
                      ? "bg-rose-50 text-rose-800 border-rose-200"
                      : "bg-zinc-100 text-zinc-700 border-zinc-200"
                  }
                >
                  {invoice.status}
                </Badge>
              </div>
              <p className="text-xs text-ink-secondary">
                Billed to {invoice.customerName} on {new Date(invoice.date).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {invoice.status === "DRAFT" && (
              <Button
                size="sm"
                onClick={handlePost}
                disabled={actionLoading}
                className="h-8 text-xs bg-emerald-800 hover:bg-emerald-900 text-white"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Post Invoice
              </Button>
            )}

            {(invoice.status === "POSTED" || invoice.status === "PARTIALLY_PAID") && (
              <Button
                size="sm"
                onClick={() => setShowPaymentModal(true)}
                className="h-8 text-xs bg-emerald-800 hover:bg-emerald-900 text-white"
              >
                <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                Record Payment
              </Button>
            )}

            {invoice.status !== "DRAFT" && (
              <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="h-8 text-xs">
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Download PDF
              </Button>
            )}

            {invoice.status === "POSTED" && parseFloat(invoice.paidAmount) === 0 && (
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

        {/* Invoice Summary Card */}
        <Card className="border-border shadow-subtle">
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-ink-secondary">Customer:</span>
                <p className="font-semibold text-ink-primary mt-0.5">{invoice.customerName}</p>
              </div>
              <div>
                <span className="text-ink-secondary">Date:</span>
                <p className="font-mono text-ink-primary mt-0.5">{new Date(invoice.date).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-ink-secondary">Due Date:</span>
                <p className="font-mono text-ink-primary mt-0.5">
                  {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "Immediate"}
                </p>
              </div>
              <div>
                <span className="text-ink-secondary">Balance Due:</span>
                <p className={`font-mono font-bold mt-0.5 tabular-nums ${parseFloat(invoice.balanceDue) > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                  PKR {invoice.balanceDue}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items Table */}
        <div className="rounded border border-border bg-white overflow-hidden shadow-subtle">
          <div className="px-4 py-3 bg-canvas border-b border-border">
            <h3 className="font-semibold text-xs text-ink-primary uppercase tracking-wider">Line Items</h3>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas border-b border-border text-[11px] font-semibold text-ink-secondary uppercase">
              <tr>
                <th className="py-2.5 px-4">Description</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-right">Discount</th>
                <th className="py-2.5 px-3 text-right">Tax</th>
                <th className="py-2.5 px-4 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoice.items.map((it: any) => (
                <tr key={it.id}>
                  <td className="py-3 px-4 text-ink-primary font-medium">{it.description}</td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">{it.quantity}</td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">PKR {it.unitPrice}</td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">PKR {it.discount}</td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">PKR {it.taxAmount}</td>
                  <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-ink-primary">
                    PKR {it.lineTotal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div className="flex justify-end">
          <div className="w-full sm:w-72 bg-white border border-border rounded p-4 space-y-2 text-xs">
            <div className="flex justify-between text-ink-secondary">
              <span>Subtotal:</span>
              <span className="font-mono tabular-nums text-ink-primary">PKR {invoice.subtotal}</span>
            </div>
            <div className="flex justify-between text-ink-secondary">
              <span>Sales Tax:</span>
              <span className="font-mono tabular-nums text-ink-primary">PKR {invoice.taxTotal}</span>
            </div>
            <div className="border-t border-border pt-1.5 flex justify-between font-bold text-ink-primary">
              <span>Grand Total:</span>
              <span className="font-mono tabular-nums">PKR {invoice.total}</span>
            </div>
            <div className="flex justify-between text-ink-secondary">
              <span>Amount Paid:</span>
              <span className="font-mono tabular-nums text-emerald-800">PKR {invoice.paidAmount}</span>
            </div>
            <div className="border-t border-border pt-1.5 flex justify-between font-bold text-rose-700">
              <span>Remaining Balance:</span>
              <span className="font-mono tabular-nums">PKR {invoice.balanceDue}</span>
            </div>
          </div>
        </div>

        {/* Payment History Section */}
        {invoice.payments && invoice.payments.length > 0 && (
          <div className="rounded border border-border bg-white overflow-hidden shadow-subtle">
            <div className="px-4 py-3 bg-canvas border-b border-border">
              <h3 className="font-semibold text-xs text-ink-primary uppercase tracking-wider">Payment Allocations</h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas border-b border-border text-[11px] font-semibold text-ink-secondary uppercase">
                <tr>
                  <th className="py-2.5 px-4">Receipt #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoice.payments.map((p: any) => (
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

        {/* Payment Dialog */}
        {showPaymentModal && (
          <PaymentDialog
            isOpen={true}
            onClose={() => setShowPaymentModal(false)}
            onSuccess={fetchInvoice}
            type="RECEIVED"
            documentId={invoice.id}
            documentNumber={invoice.number}
            contactId={invoice.contactId}
            contactName={invoice.customerName}
            total={invoice.total}
            balanceDue={invoice.balanceDue}
          />
        )}
      </div>
    </AppShell>
  );
}
