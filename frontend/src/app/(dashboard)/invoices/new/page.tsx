"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Save, Send, AlertCircle, Loader2, Calculator } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  taxRateId: string;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const { status } = useAuth();

  const [customers, setCustomers] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);

  const [contactId, setContactId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<LineItem[]>([
    { id: "1", description: "", quantity: "1", unitPrice: "0.00", discount: "0.00", taxRateId: "" }
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "AUTHENTICATED") return;

    const fetchLookups = async () => {
      setLoadingLookups(true);

      try {
        const [cRes, tRes] = await Promise.all([
          apiClient<any[]>("/contacts", {
            params: { type: "CUSTOMER" }
          }),
          apiClient<any[]>("/taxes")
        ]);

        setCustomers(cRes.data || []);
        if (cRes.data && cRes.data.length > 0) setContactId(cRes.data[0].id);
        setTaxes(tRes.data || []);
      } catch {
        // Fallback for presentation
        setCustomers([{ id: "cust-1", name: "Apex Global Traders" }]);
        setContactId("cust-1");
        setTaxes([{ id: "tax-1", name: "GST 18%", percentage: "18.00" }]);
      } finally {
        setLoadingLookups(false);
      }
    };

    fetchLookups();
  }, [status]);

  const addItem = () => {
    setItems([
      ...items,
      { id: String(Date.now()), description: "", quantity: "1", unitPrice: "0.00", discount: "0.00", taxRateId: taxes[0]?.id || "" }
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof LineItem, val: string) => {
    const updated = [...items];
    updated[index][field] = val;
    setItems(updated);
  };

  // Live client-side calculation for immediate user feedback
  let subtotal = 0;
  let taxTotal = 0;

  items.forEach((it) => {
    const q = parseFloat(it.quantity) || 0;
    const p = parseFloat(it.unitPrice) || 0;
    const d = parseFloat(it.discount) || 0;
    const taxable = Math.max(0, q * p - d);

    let t = 0;
    if (it.taxRateId) {
      const match = taxes.find((x) => x.id === it.taxRateId);
      if (match) {
        t = taxable * (parseFloat(match.percentage) / 100);
      }
    }

    subtotal += taxable;
    taxTotal += t;
  });

  const grandTotal = subtotal + taxTotal;

  const handleSubmit = async (postImmediately: boolean) => {
    if (!contactId) {
      setError("Please select a customer");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await apiClient<{ id: string }>("/sales/invoices", {
        method: "POST",
        body: JSON.stringify({
          contactId,
          date,
          dueDate: dueDate || null,
          notes: notes || null,
          items: items.map((it) => ({
            description: it.description || "Invoice Line Item",
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discount: it.discount || "0.00",
            taxRateId: it.taxRateId || null
          }))
        })
      });

      if (postImmediately) {
        await apiClient(`/sales/invoices/${res.data.id}/post`, {
          method: "POST"
        });
      }

      router.push("/invoices");
    } catch (err: any) {
      setError(err.message || "Failed to create invoice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center space-x-3">
            <Link href="/invoices">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-ink-primary">New Sales Invoice</h1>
              <p className="text-xs text-ink-secondary">
                Enter line items, discounts, and sales tax to generate a verified double-entry invoice.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSubmit(false)}
              disabled={saving}
              className="h-8 text-xs"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              Save Draft
            </Button>
            <Button
              size="sm"
              onClick={() => handleSubmit(true)}
              disabled={saving}
              className="h-8 text-xs bg-emerald-800 hover:bg-emerald-900 text-white"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              Post Invoice
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 text-xs bg-rose-50 text-rose-800 border border-rose-200 rounded">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Invoice Header Details */}
        <Card className="border-border shadow-subtle">
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink-secondary">Customer *</label>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="w-full h-9 px-2.5 text-xs bg-white border border-border rounded focus:outline-none focus:ring-1 focus:ring-ink-primary"
                  required
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink-secondary">Invoice Date *</label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink-secondary">Due Date</label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-secondary">Notes & Payment Instructions</label>
              <Input
                placeholder="e.g. Payment due within 15 days via bank transfer..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Line Items Table */}
        <div className="rounded border border-border bg-white overflow-hidden shadow-subtle">
          <div className="px-4 py-3 bg-canvas border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">Line Items</span>
            <Button variant="outline" size="sm" onClick={addItem} className="h-7 text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Row
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas border-b border-border text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Item / Description</th>
                  <th className="py-2.5 px-3 w-24 text-right">Qty</th>
                  <th className="py-2.5 px-3 w-32 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 w-28 text-right">Discount</th>
                  <th className="py-2.5 px-3 w-36">Sales Tax</th>
                  <th className="py-2.5 px-4 w-36 text-right">Line Total</th>
                  <th className="py-2.5 px-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item, idx) => {
                  const q = parseFloat(item.quantity) || 0;
                  const p = parseFloat(item.unitPrice) || 0;
                  const d = parseFloat(item.discount) || 0;
                  const taxable = Math.max(0, q * p - d);
                  let t = 0;
                  if (item.taxRateId) {
                    const match = taxes.find((x) => x.id === item.taxRateId);
                    if (match) t = taxable * (parseFloat(match.percentage) / 100);
                  }
                  const rowTotal = taxable + t;

                  return (
                    <tr key={item.id} className="hover:bg-canvas/40 transition-colors">
                      <td className="py-2 px-3">
                        <Input
                          placeholder="Product description..."
                          value={item.description}
                          onChange={(e) => updateItem(idx, "description", e.target.value)}
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          step="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                          className="h-8 text-xs text-right font-mono tabular-nums"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(idx, "unitPrice", e.target.value)}
                          className="h-8 text-xs text-right font-mono tabular-nums"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.discount}
                          onChange={(e) => updateItem(idx, "discount", e.target.value)}
                          className="h-8 text-xs text-right font-mono tabular-nums"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={item.taxRateId}
                          onChange={(e) => updateItem(idx, "taxRateId", e.target.value)}
                          className="w-full h-8 px-2 text-xs bg-white border border-border rounded focus:outline-none"
                        >
                          <option value="">Zero Rated (0%)</option>
                          {taxes.map((tx) => (
                            <option key={tx.id} value={tx.id}>
                              {tx.name} ({tx.percentage}%)
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-4 text-right font-mono font-semibold tabular-nums text-ink-primary">
                        PKR {rowTotal.toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          disabled={items.length <= 1}
                          className="text-ink-secondary hover:text-rose-700 disabled:opacity-30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Financial Totals Footer Card */}
        <div className="flex justify-end">
          <div className="w-full sm:w-80 bg-white border border-border rounded p-4 space-y-2 shadow-subtle">
            <div className="flex justify-between text-xs text-ink-secondary">
              <span>Subtotal:</span>
              <span className="font-mono tabular-nums text-ink-primary font-medium">PKR {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-ink-secondary">
              <span>Sales Tax:</span>
              <span className="font-mono tabular-nums text-ink-primary font-medium">PKR {taxTotal.toFixed(2)}</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between text-sm font-bold text-ink-primary">
              <span className="text-emerald-800">Grand Total:</span>
              <span className="font-mono tabular-nums text-emerald-900">PKR {grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
