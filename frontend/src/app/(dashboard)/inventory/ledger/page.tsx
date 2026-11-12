"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  ArrowLeft,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Package,
  Building2,
  Calendar,
  Download,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api";

interface Product {
  id: string;
  sku: string;
  name: string;
  unit: string;
  currentCost: string;
  currentStock: string;
  currentValuation: string;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface LedgerEntry {
  id: string;
  date: string;
  warehouseName: string;
  type: string;
  sourceType: string;
  sourceId: string | null;
  inQuantity: string;
  outQuantity: string;
  unitCost: string;
  value: string;
  runningQuantity: string;
  runningValuation: string;
  note: string | null;
}

function StockLedgerContent() {
  const searchParams = useSearchParams();
  const initialProductId = searchParams?.get("productId") || "";

  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedProductId, setSelectedProductId] = useState(initialProductId);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [productDetails, setProductDetails] = useState<Product | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);

  // Load initial product and warehouse lists
  useEffect(() => {
    async function init() {
      try {
        const [prodRes, whRes] = await Promise.all([
          apiClient<any[]>("/inventory/products"),
          apiClient<Warehouse[]>("/inventory/warehouses")
        ]);
        setProducts(prodRes.data);
        setWarehouses(whRes.data);

        const targetId = initialProductId || (prodRes.data.length > 0 ? prodRes.data[0].id : "");
        setSelectedProductId(targetId);
      } catch {
        // Fallback demo
        const fallbackProds = [
          {
            id: "p1",
            sku: "SKU-PRO-001",
            name: "Industrial Ceramic Filter Core 10\"",
            unit: "PCS",
            currentCost: "1250.00",
            currentStock: "45.000",
            currentValuation: "56250.00"
          }
        ];
        setProducts(fallbackProds);
        setSelectedProductId("p1");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [initialProductId]);

  // Load ledger whenever selected product or filters change
  const fetchLedger = async () => {
    if (!selectedProductId) return;
    setLedgerLoading(true);
    try {
      const res = await apiClient<{ product: Product; ledger: LedgerEntry[] }>(
        `/inventory/reports/stock-ledger/${selectedProductId}`,
        {
          params: {
            warehouseId: selectedWarehouseId || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined
          }
        }
      );
      setProductDetails(res.data.product);
      setEntries(res.data.ledger);
    } catch {
      // Demo entries
      setProductDetails({
        id: "p1",
        sku: "SKU-PRO-001",
        name: "Industrial Ceramic Filter Core 10\"",
        unit: "PCS",
        currentCost: "1250.00",
        currentStock: "45.000",
        currentValuation: "56250.00"
      });
      setEntries([
        {
          id: "m1",
          date: "2026-03-01T09:00:00.000Z",
          warehouseName: "Main Central Warehouse",
          type: "OPENING",
          sourceType: "OPENING",
          sourceId: null,
          inQuantity: "50.000",
          outQuantity: "0.000",
          unitCost: "1250.00",
          value: "62500.00",
          runningQuantity: "50.000",
          runningValuation: "62500.00",
          note: "Opening stock on ledger initialization"
        },
        {
          id: "m2",
          date: "2026-03-05T14:30:00.000Z",
          warehouseName: "Main Central Warehouse",
          type: "SALE",
          sourceType: "INVOICE",
          sourceId: "INV-2026-0001",
          inQuantity: "0.000",
          outQuantity: "5.000",
          unitCost: "1250.00",
          value: "6250.00",
          runningQuantity: "45.000",
          runningValuation: "56250.00",
          note: "Dispatched against Sales Invoice INV-2026-0001"
        }
      ]);
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProductId) {
      fetchLedger();
    }
  }, [selectedProductId, selectedWarehouseId]);

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
                <BookOpen className="h-5 w-5 text-emerald-700" />
                <h1 className="text-xl font-bold tracking-tight text-ink-primary">Product Stock Ledger</h1>
              </div>
              <p className="text-xs text-ink-secondary mt-0.5">
                Audit trail of every stock movement, running quantity balances, and historical WAC valuations.
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center gap-3 bg-surface p-3.5 rounded border border-border">
          <div className="w-full sm:w-64">
            <label className="block text-[10px] uppercase font-semibold text-ink-secondary mb-1">
              Select Product
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full h-8 text-xs rounded border border-border bg-canvas px-2 text-ink-primary font-mono focus:outline-none focus:ring-1 focus:ring-emerald-700"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-52">
            <label className="block text-[10px] uppercase font-semibold text-ink-secondary mb-1">
              Filter Warehouse
            </label>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="w-full h-8 text-xs rounded border border-border bg-canvas px-2 text-ink-primary focus:outline-none focus:ring-1 focus:ring-emerald-700"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-36">
            <label className="block text-[10px] uppercase font-semibold text-ink-secondary mb-1">
              From Date
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 text-xs font-mono bg-canvas"
            />
          </div>

          <div className="w-full sm:w-36">
            <label className="block text-[10px] uppercase font-semibold text-ink-secondary mb-1">
              To Date
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 text-xs font-mono bg-canvas"
            />
          </div>

          <div className="flex items-end space-x-2 pt-4 sm:pt-0">
            <Button
              onClick={fetchLedger}
              variant="outline"
              size="sm"
              disabled={ledgerLoading}
              className="h-8 text-xs mt-3.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${ledgerLoading ? "animate-spin" : ""}`} />
              Filter
            </Button>
          </div>
        </div>

        {/* Product Snapshot Bar */}
        {productDetails && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded bg-surface border border-border">
            <div>
              <p className="text-[10px] uppercase font-semibold text-ink-secondary">SKU / Code</p>
              <p className="text-sm font-mono font-bold text-ink-primary mt-0.5">{productDetails.sku}</p>
              <p className="text-xs text-ink-secondary truncate">{productDetails.name}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-ink-secondary">Current Stock</p>
              <p className="text-sm font-mono font-bold text-ink-primary mt-0.5 tabular-nums">
                {parseFloat(productDetails.currentStock).toFixed(3)} {productDetails.unit}
              </p>
              <p className="text-[10px] text-emerald-800">Ledger-Derived Balance</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-ink-secondary">Weighted Avg Cost</p>
              <p className="text-sm font-mono font-bold text-ink-primary mt-0.5 tabular-nums">
                PKR {parseFloat(productDetails.currentCost).toFixed(2)}
              </p>
              <p className="text-[10px] text-ink-secondary">Per {productDetails.unit}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-ink-secondary">Total Asset Value</p>
              <p className="text-sm font-mono font-bold text-emerald-900 mt-0.5 tabular-nums">
                PKR {parseFloat(productDetails.currentValuation).toFixed(2)}
              </p>
              <p className="text-[10px] text-ink-secondary">WAC &times; Stock</p>
            </div>
          </div>
        )}

        {/* Chronological Movements Table */}
        <div className="rounded border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas border-b border-border text-[10px] uppercase font-medium text-ink-secondary">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Warehouse</th>
                  <th className="py-2.5 px-3">Movement Type</th>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3 text-right">In (+Qty)</th>
                  <th className="py-2.5 px-3 text-right">Out (-Qty)</th>
                  <th className="py-2.5 px-3 text-right">Unit Cost</th>
                  <th className="py-2.5 px-3 text-right">Running Stock</th>
                  <th className="py-2.5 px-3 text-right">Valuation</th>
                  <th className="py-2.5 px-3">Audit Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ledgerLoading ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-ink-secondary">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-emerald-700" />
                      Loading stock ledger trail...
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-ink-secondary">
                      No stock movements recorded for this product yet.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    const hasIn = parseFloat(entry.inQuantity) > 0;
                    const hasOut = parseFloat(entry.outQuantity) > 0;

                    return (
                      <tr key={entry.id} className="hover:bg-canvas/50 transition-colors font-mono text-[11px]">
                        <td className="py-2.5 px-3 text-ink-secondary">
                          {new Date(entry.date).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 text-ink-primary font-sans text-xs">
                          {entry.warehouseName}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            entry.type === "OPENING" || entry.type === "PURCHASE" || entry.type === "TRANSFER_IN"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : entry.type === "SALE" || entry.type === "TRANSFER_OUT"
                              ? "bg-rose-50 text-rose-800 border border-rose-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}>
                            {entry.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-ink-secondary">
                          {entry.sourceId || entry.sourceType}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-emerald-800 font-semibold">
                          {hasIn ? `+${parseFloat(entry.inQuantity).toFixed(3)}` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-rose-800 font-semibold">
                          {hasOut ? `-${parseFloat(entry.outQuantity).toFixed(3)}` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-ink-secondary">
                          PKR {parseFloat(entry.unitCost).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-bold text-ink-primary">
                          {parseFloat(entry.runningQuantity).toFixed(3)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-emerald-900">
                          PKR {parseFloat(entry.runningValuation).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-ink-secondary font-sans text-xs max-w-xs truncate">
                          {entry.note || "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function StockLedgerPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="py-12 text-center text-xs text-ink-secondary">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-emerald-700" />
            Loading stock ledger parameters...
          </div>
        </AppShell>
      }
    >
      <StockLedgerContent />
    </Suspense>
  );
}
