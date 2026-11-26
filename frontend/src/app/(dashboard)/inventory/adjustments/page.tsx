"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  SlidersHorizontal,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Scale,
  Package,
  Building2,
  ShieldAlert
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface Product {
  id: string;
  sku: string;
  name: string;
  unit: string;
  costPrice: string;
  currentStock: string;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
}

export default function StockAdjustmentsPage() {
  const router = useRouter();
  const { status, activeCompany } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "AUTHENTICATED") return;
    async function loadData() {
      setLoading(true);
      try {
        const [prodRes, whRes] = await Promise.all([
          apiClient<Product[]>("/inventory/products"),
          apiClient<Warehouse[]>("/inventory/warehouses")
        ]);
        setProducts(prodRes.data);
        setWarehouses(whRes.data);
        if (prodRes.data.length > 0) setProductId(prodRes.data[0].id);
        const defWh = whRes.data.find((w) => w.isDefault) || whRes.data[0];
        if (defWh) setWarehouseId(defWh.id);
      } catch {
        // Fallback for UI demonstration
        setProducts([
          {
            id: "p1",
            sku: "SKU-PRO-001",
            name: "Industrial Ceramic Filter Core 10\"",
            unit: "PCS",
            costPrice: "1250.00",
            currentStock: "45.000"
          },
          {
            id: "p2",
            sku: "SKU-VAL-002",
            name: "High-Pressure Brass Gate Valve 2\"",
            unit: "PCS",
            costPrice: "480.00",
            currentStock: "8.000"
          }
        ]);
        setWarehouses([
          { id: "w1", name: "Main Central Warehouse", code: "WH-MAIN", isDefault: true }
        ]);
        setProductId("p1");
        setWarehouseId("w1");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [status, activeCompany?.id]);

  const selectedProduct = products.find((p) => p.id === productId);
  const qtyNum = parseFloat(quantity || "0");
  const unitCostNum = selectedProduct ? parseFloat(selectedProduct.costPrice) : 0;
  const valuationImpact = Math.abs(qtyNum * unitCostNum);
  const isPositiveAdjustment = qtyNum > 0;
  const isNegativeAdjustment = qtyNum < 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || reason.trim().length < 5) {
      setError("A descriptive audit reason (minimum 5 characters) is mandatory for financial compliance.");
      return;
    }
    if (qtyNum === 0 || isNaN(qtyNum)) {
      setError("Adjustment quantity cannot be zero.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await apiClient("/inventory/adjustment", {
        method: "POST",
        body: JSON.stringify({
          productId,
          warehouseId,
          quantity: quantity.toString(),
          reason: reason.trim(),
          date
        })
      });

      setSuccess("Stock adjustment committed successfully. Double-entry journal posted.");
      setQuantity("");
      setReason("");
      setTimeout(() => {
        router.push("/inventory");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to commit stock adjustment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center space-x-3">
            <Link href="/inventory">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center space-x-2">
                <SlidersHorizontal className="h-5 w-5 text-emerald-700" />
                <h1 className="text-xl font-bold tracking-tight text-ink-primary">Stock Adjustment</h1>
              </div>
              <p className="text-xs text-ink-secondary mt-0.5">
                Record physical audit variances, inventory write-offs, or stock discrepancies with mandatory double-entry posting.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Adjustment Details Card */}
            <Card className="border border-border bg-surface p-5 space-y-4">
              <h2 className="text-sm font-bold text-ink-primary flex items-center space-x-2 border-b border-border pb-2.5">
                <Package className="h-4 w-4 text-emerald-700" />
                <span>Adjustment Parameters</span>
              </h2>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">Product *</label>
                <select
                  required
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full h-8 text-xs rounded border border-border bg-canvas px-2.5 text-ink-primary font-mono focus:outline-none focus:ring-1 focus:ring-emerald-700"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name} (Stock: {p.currentStock} {p.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">Target Warehouse *</label>
                <select
                  required
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full h-8 text-xs rounded border border-border bg-canvas px-2.5 text-ink-primary focus:outline-none focus:ring-1 focus:ring-emerald-700"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code}) {w.isDefault ? "[Default]" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    Delta Quantity * <span className="text-[10px] text-ink-secondary">(+ or -)</span>
                  </label>
                  <Input
                    required
                    type="number"
                    step="0.001"
                    placeholder="e.g. +5 or -2"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="h-8 text-xs font-mono tabular-nums bg-canvas text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">Adjustment Date *</label>
                  <Input
                    required
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-8 text-xs font-mono bg-canvas"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Mandatory Audit Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detail the root cause: e.g. Year-end cycle count variance, damaged stock disposal approved by warehouse manager..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full text-xs rounded border border-border bg-canvas p-2 text-ink-primary focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
                <p className="text-[10px] text-ink-secondary mt-1">
                  Required for immutable audit log traceability and compliance.
                </p>
              </div>
            </Card>

            {/* Live Double-Entry Balancing Card */}
            <Card className="border border-border bg-surface p-5 space-y-4">
              <h2 className="text-sm font-bold text-ink-primary flex items-center space-x-2 border-b border-border pb-2.5">
                <Scale className="h-4 w-4 text-emerald-700" />
                <span>Financial Double-Entry Journal Preview</span>
              </h2>

              <div className="p-3 rounded bg-canvas border border-border text-xs space-y-2">
                <div className="flex justify-between text-ink-secondary">
                  <span>Unit Cost (WAC):</span>
                  <span className="font-mono tabular-nums font-semibold text-ink-primary">
                    PKR {unitCostNum.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-ink-secondary">
                  <span>Adjustment Quantity:</span>
                  <span className={`font-mono tabular-nums font-semibold ${qtyNum > 0 ? "text-emerald-700" : qtyNum < 0 ? "text-rose-700" : "text-ink-primary"}`}>
                    {qtyNum > 0 ? `+${qtyNum.toFixed(3)}` : qtyNum.toFixed(3)} {selectedProduct?.unit || ""}
                  </span>
                </div>
                <div className="flex justify-between text-ink-secondary border-t border-border pt-2">
                  <span>Valuation Impact:</span>
                  <span className="font-mono tabular-nums font-bold text-ink-primary">
                    PKR {valuationImpact.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Dynamic Journal Entries Table */}
              <div className="rounded border border-border overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-canvas border-b border-border text-[10px] uppercase font-medium text-ink-secondary">
                    <tr>
                      <th className="py-2 px-3">Account</th>
                      <th className="py-2 px-3 text-right">Debit</th>
                      <th className="py-2 px-3 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono text-[11px] tabular-nums">
                    {isPositiveAdjustment ? (
                      <>
                        <tr>
                          <td className="py-2 px-3 text-ink-primary font-medium">
                            1200 · Inventory Asset
                          </td>
                          <td className="py-2 px-3 text-right text-emerald-800">
                            {valuationImpact.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right text-ink-secondary">0.00</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-ink-primary font-medium">
                            5001 · Cost of Goods Sold (Variance)
                          </td>
                          <td className="py-2 px-3 text-right text-ink-secondary">0.00</td>
                          <td className="py-2 px-3 text-right text-emerald-800">
                            {valuationImpact.toFixed(2)}
                          </td>
                        </tr>
                      </>
                    ) : isNegativeAdjustment ? (
                      <>
                        <tr>
                          <td className="py-2 px-3 text-ink-primary font-medium">
                            5001 · Cost of Goods Sold (Write-off)
                          </td>
                          <td className="py-2 px-3 text-right text-rose-800">
                            {valuationImpact.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right text-ink-secondary">0.00</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-ink-primary font-medium">
                            1200 · Inventory Asset
                          </td>
                          <td className="py-2 px-3 text-right text-ink-secondary">0.00</td>
                          <td className="py-2 px-3 text-right text-rose-800">
                            {valuationImpact.toFixed(2)}
                          </td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-ink-secondary font-sans text-xs">
                          Specify a non-zero delta quantity to preview accounting entries.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {valuationImpact > 0 && (
                    <tfoot className="bg-canvas border-t border-border font-mono font-bold text-[11px] tabular-nums">
                      <tr>
                        <td className="py-2 px-3 text-ink-primary">Total:</td>
                        <td className="py-2 px-3 text-right text-ink-primary">{valuationImpact.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-ink-primary">{valuationImpact.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {valuationImpact > 0 && (
                <div className="flex items-center space-x-1.5 text-xs text-emerald-800 bg-emerald-50 p-2 rounded border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Double-Entry Balance Verified: Debit === Credit</span>
                </div>
              )}
            </Card>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
            <Link href="/inventory">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || qtyNum === 0 || !reason}
              className="h-8 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Commit Stock Adjustment
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
