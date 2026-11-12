"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart3,
  ArrowLeft,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Building2,
  Package,
  Layers,
  Download,
  AlertCircle
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";

interface ValuationSummary {
  totalInventoryValuation: string;
  glInventoryAccountBalance: string;
  variance: string;
  isReconciled: boolean;
  totalProductsCount: number;
}

interface ProductValuation {
  id: string;
  sku: string;
  name: string;
  categoryName: string;
  currentStock: string;
  unit: string;
  wacCost: string;
  valuation: string;
}

interface WarehouseDistribution {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  totalQuantity: string;
  totalValuation: string;
  skuCount: number;
}

interface LowStockAlert {
  id: string;
  sku: string;
  name: string;
  currentStock: string;
  reorderLevel: string;
  unit: string;
  deficit: string;
}

export default function InventoryReportsPage() {
  const [activeTab, setActiveTab] = useState<"VALUATION" | "WAREHOUSES" | "ALERTS">("VALUATION");
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState<ValuationSummary | null>(null);
  const [products, setProducts] = useState<ProductValuation[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseDistribution[]>([]);
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [valRes, whRes, alertRes] = await Promise.all([
        apiClient<{ valuationSummary: ValuationSummary; products: ProductValuation[] }>(
          "/inventory/reports/valuation"
        ),
        apiClient<WarehouseDistribution[]>("/inventory/reports/warehouse-distribution"),
        apiClient<LowStockAlert[]>("/inventory/reports/reorder-alerts")
      ]);

      setSummary(valRes.data.valuationSummary);
      setProducts(valRes.data.products);
      setWarehouses(whRes.data);
      setAlerts(alertRes.data);
    } catch {
      // Demo fallback
      setSummary({
        totalInventoryValuation: "60090.00",
        glInventoryAccountBalance: "60090.00",
        variance: "0.00",
        isReconciled: true,
        totalProductsCount: 3
      });
      setProducts([
        {
          id: "p1",
          sku: "SKU-PRO-001",
          name: "Industrial Ceramic Filter Core 10\"",
          categoryName: "Filtration Systems",
          currentStock: "45.000",
          unit: "PCS",
          wacCost: "1250.00",
          valuation: "56250.00"
        },
        {
          id: "p2",
          sku: "SKU-VAL-002",
          name: "High-Pressure Brass Gate Valve 2\"",
          categoryName: "Valves & Fittings",
          currentStock: "8.000",
          unit: "PCS",
          wacCost: "480.00",
          valuation: "3840.00"
        }
      ]);
      setWarehouses([
        {
          warehouseId: "w1",
          warehouseName: "Main Central Warehouse",
          warehouseCode: "WH-MAIN",
          totalQuantity: "53.000",
          totalValuation: "60090.00",
          skuCount: 2
        }
      ]);
      setAlerts([
        {
          id: "p2",
          sku: "SKU-VAL-002",
          name: "High-Pressure Brass Gate Valve 2\"",
          currentStock: "8.000",
          reorderLevel: "15.000",
          unit: "PCS",
          deficit: "7.000"
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center space-x-3">
            <Link href="/inventory">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-emerald-700" />
                <h1 className="text-xl font-bold tracking-tight text-ink-primary">Inventory Valuation & GL Reconciliation</h1>
              </div>
              <p className="text-xs text-ink-secondary mt-0.5">
                Compare physical stock valuation against General Ledger balance to verify double-entry integrity.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchReports}
              disabled={loading}
              className="h-8 text-xs text-ink-secondary hover:text-ink-primary"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Reconciliation Status Banner */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border border-border bg-surface p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-secondary">
                Subledger Stock Valuation
              </p>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono tracking-tight text-ink-primary tabular-nums">
                  PKR {parseFloat(summary.totalInventoryValuation).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-ink-secondary">&sum; (Stock &times; WAC)</span>
              </div>
            </Card>

            <Card className="border border-border bg-surface p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-secondary">
                GL Account 1200 (Inventory)
              </p>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono tracking-tight text-emerald-800 tabular-nums">
                  PKR {parseFloat(summary.glInventoryAccountBalance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-ink-secondary">Net Dr - Cr</span>
              </div>
            </Card>

            <Card className={`border p-4 ${summary.isReconciled ? "bg-emerald-50/50 border-emerald-200" : "bg-rose-50/50 border-rose-200"}`}>
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-secondary">
                Reconciliation Variance
              </p>
              <div className="mt-2 flex items-baseline justify-between">
                <span className={`text-2xl font-bold font-mono tracking-tight tabular-nums ${summary.isReconciled ? "text-emerald-800" : "text-rose-800"}`}>
                  PKR {parseFloat(summary.variance).toFixed(2)}
                </span>
                {summary.isReconciled ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    100% Reconciled
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800">
                    <AlertCircle className="w-3.5 h-3.5 mr-1" />
                    Out of Balance
                  </span>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-border space-x-4">
          <button
            onClick={() => setActiveTab("VALUATION")}
            className={`pb-2 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "VALUATION"
                ? "border-emerald-700 text-emerald-800"
                : "border-transparent text-ink-secondary hover:text-ink-primary"
            }`}
          >
            Product Valuation Breakdown ({products.length})
          </button>
          <button
            onClick={() => setActiveTab("WAREHOUSES")}
            className={`pb-2 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "WAREHOUSES"
                ? "border-emerald-700 text-emerald-800"
                : "border-transparent text-ink-secondary hover:text-ink-primary"
            }`}
          >
            Warehouse Distribution ({warehouses.length})
          </button>
          <button
            onClick={() => setActiveTab("ALERTS")}
            className={`pb-2 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === "ALERTS"
                ? "border-emerald-700 text-emerald-800"
                : "border-transparent text-ink-secondary hover:text-ink-primary"
            }`}
          >
            <span>Reorder Level Alerts</span>
            {alerts.length > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-100 text-amber-800 border border-amber-200">
                {alerts.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Product Valuation Breakdown */}
        {activeTab === "VALUATION" && (
          <div className="rounded border border-border bg-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas border-b border-border text-[10px] uppercase font-medium text-ink-secondary">
                  <tr>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Current Stock</th>
                    <th className="py-2.5 px-3 text-center">Unit</th>
                    <th className="py-2.5 px-3 text-right">WAC Unit Cost</th>
                    <th className="py-2.5 px-3 text-right">Total Valuation</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-ink-secondary">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-emerald-700" />
                        Calculating product valuations...
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-ink-secondary">
                        No product inventory recorded.
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => (
                      <tr key={p.id} className="hover:bg-canvas/50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-medium text-ink-primary">{p.sku}</td>
                        <td className="py-2.5 px-3 font-medium text-ink-primary">{p.name}</td>
                        <td className="py-2.5 px-3 text-ink-secondary">{p.categoryName}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-ink-primary">
                          {parseFloat(p.currentStock).toFixed(3)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-ink-secondary">{p.unit}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-ink-secondary">
                          PKR {parseFloat(p.wacCost).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-900">
                          PKR {parseFloat(p.valuation).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Link href={`/inventory/ledger?productId=${p.id}`}>
                            <Button variant="outline" size="sm" className="h-6 text-[11px] px-2 font-mono">
                              Ledger
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Warehouse Distribution */}
        {activeTab === "WAREHOUSES" && (
          <div className="rounded border border-border bg-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas border-b border-border text-[10px] uppercase font-medium text-ink-secondary">
                  <tr>
                    <th className="py-2.5 px-3">Warehouse Code</th>
                    <th className="py-2.5 px-3">Warehouse Name</th>
                    <th className="py-2.5 px-3 text-center">SKUs Stored</th>
                    <th className="py-2.5 px-3 text-right">Total Quantity</th>
                    <th className="py-2.5 px-3 text-right">Total Valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-ink-secondary">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-emerald-700" />
                        Aggregating warehouse stock...
                      </td>
                    </tr>
                  ) : warehouses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-ink-secondary">
                        No warehouse data available.
                      </td>
                    </tr>
                  ) : (
                    warehouses.map((w) => (
                      <tr key={w.warehouseId} className="hover:bg-canvas/50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-medium text-ink-primary">{w.warehouseCode}</td>
                        <td className="py-2.5 px-3 font-medium text-ink-primary">{w.warehouseName}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-ink-secondary">{w.skuCount}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-ink-primary">
                          {parseFloat(w.totalQuantity).toFixed(3)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-900">
                          PKR {parseFloat(w.totalValuation).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Reorder Alerts */}
        {activeTab === "ALERTS" && (
          <div className="rounded border border-border bg-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas border-b border-border text-[10px] uppercase font-medium text-ink-secondary">
                  <tr>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3 text-right">Current Stock</th>
                    <th className="py-2.5 px-3 text-right">Reorder Threshold</th>
                    <th className="py-2.5 px-3 text-center">Unit</th>
                    <th className="py-2.5 px-3 text-right">Replenishment Deficit</th>
                    <th className="py-2.5 px-3 text-center">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-ink-secondary">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-amber-600" />
                        Scanning reorder thresholds...
                      </td>
                    </tr>
                  ) : alerts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-emerald-800 font-medium">
                        All products are comfortably above their safety reorder thresholds.
                      </td>
                    </tr>
                  ) : (
                    alerts.map((a) => {
                      const isOutOfStock = parseFloat(a.currentStock) <= 0;
                      return (
                        <tr key={a.id} className="hover:bg-canvas/50 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-medium text-ink-primary">{a.sku}</td>
                          <td className="py-2.5 px-3 font-medium text-ink-primary">{a.name}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-ink-primary">
                            {parseFloat(a.currentStock).toFixed(3)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-ink-secondary">
                            {parseFloat(a.reorderLevel).toFixed(3)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-ink-secondary">{a.unit}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-rose-800">
                            {parseFloat(a.deficit).toFixed(3)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isOutOfStock ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                                CRITICAL: 0 Stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                LOW STOCK
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
