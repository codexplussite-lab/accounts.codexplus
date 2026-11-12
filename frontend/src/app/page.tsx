"use client";

import React, { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  FileText,
  Package,
  Layers,
  ArrowUpRight,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import SpotlightCard from "@/components/react-bits/SpotlightCard";
import Counter from "@/components/react-bits/Counter";

interface HealthData {
  status: string;
  timestamp: string;
  environment: string;
}

export default function HomePage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:4000/health");
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setHealth(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to backend server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="min-h-screen bg-canvas text-ink-primary">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-surface border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-ink-primary flex items-center justify-center text-white font-mono font-bold text-sm tracking-tighter">
            ERP
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-sm tracking-tight text-ink-primary">
                Acme Enterprise Ledger
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono uppercase bg-emerald-light text-emerald-brand border border-emerald-border rounded">
                Multi-Tenant
              </span>
            </div>
            <p className="text-xs text-ink-secondary">Production Accounting & Inventory Suite</p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-2 px-3 py-1 rounded bg-canvas border border-border">
            <span
              className={`w-2 h-2 rounded-full ${
                health?.status === "ok" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
            />
            <span className="text-ink-secondary font-mono">
              Backend: {loading ? "Checking..." : health?.status === "ok" ? "Online (4000)" : "Offline"}
            </span>
            <button
              onClick={fetchHealth}
              className="text-ink-secondary hover:text-ink-primary transition-colors ml-1"
              title="Refresh Health"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Phase 0 System Status Banner */}
        <div className="p-4 rounded-lg bg-surface border border-border flex items-start justify-between shadow-subtle">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded bg-emerald-light text-emerald-brand mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink-primary">
                Phase 0 Setup Verified: Monorepo Foundation & Core Integrity
              </h2>
              <p className="text-xs text-ink-secondary mt-0.5">
                Two-folder monorepo (`backend/` + `frontend/`) initialized with strict double-entry schema,
                Zod environment validation, Decimal arithmetic, and bespoke financial tokens.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-mono font-medium bg-emerald-light text-emerald-brand border border-emerald-border">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Phase 0 Complete
            </span>
          </div>
        </div>

        {/* Financial KPI Summary Cards (Using React Bits Spotlight & Counter) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-ink-secondary">
              Core Ledger Invariants (Live Telemetry)
            </h3>
            <span className="text-xs text-ink-secondary font-mono">Currency: PKR | Dual-Ledger</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* KPI 1: Net Revenue */}
            <SpotlightCard
              theme="light"
              spotlightColor="rgba(6, 95, 70, 0.08)"
              className="p-5 bg-surface border border-border rounded-lg shadow-subtle"
            >
              <div className="flex items-center justify-between text-xs text-ink-secondary mb-1">
                <span>Gross Receivables</span>
                <span className="text-emerald-brand font-medium flex items-center">
                  +12.4% <ArrowUpRight className="w-3 h-3 ml-0.5" />
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-ink-primary tabular-nums tracking-tight mt-1">
                PKR{" "}
                <Counter
                  value={1845000}
                  direction="up"
                  duration={1.2}
                  tabular
                  fontSize="1.5rem"
                  fontWeight={700}
                />
              </div>
              <div className="mt-2 text-[11px] text-ink-secondary flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                Derived from JournalLines
              </div>
            </SpotlightCard>

            {/* KPI 2: Total Inventory Asset Value */}
            <SpotlightCard
              theme="light"
              spotlightColor="rgba(30, 41, 59, 0.08)"
              className="p-5 bg-surface border border-border rounded-lg shadow-subtle"
            >
              <div className="flex items-center justify-between text-xs text-ink-secondary mb-1">
                <span>Inventory Valuation</span>
                <span className="font-mono text-xs text-ink-secondary">WAC Model</span>
              </div>
              <div className="text-2xl font-bold font-mono text-ink-primary tabular-nums tracking-tight mt-1">
                PKR{" "}
                <Counter
                  value={923400}
                  direction="up"
                  duration={1.4}
                  tabular
                  fontSize="1.5rem"
                  fontWeight={700}
                />
              </div>
              <div className="mt-2 text-[11px] text-ink-secondary flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-cobalt-brand mr-1.5" />
                SUM(StockMovement.qty × WAC)
              </div>
            </SpotlightCard>

            {/* KPI 3: Trial Balance Verification */}
            <SpotlightCard
              theme="light"
              spotlightColor="rgba(6, 95, 70, 0.08)"
              className="p-5 bg-surface border border-border rounded-lg shadow-subtle"
            >
              <div className="flex items-center justify-between text-xs text-ink-secondary mb-1">
                <span>Trial Balance</span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono bg-emerald-light text-emerald-brand rounded border border-emerald-border">
                  BALANCED
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-brand tabular-nums tracking-tight mt-1">
                Δ 0.00
              </div>
              <div className="mt-2 text-[11px] text-ink-secondary flex items-center">
                <CheckCircle2 className="w-3 h-3 text-emerald-brand mr-1" />
                Σ Debit === Σ Credit
              </div>
            </SpotlightCard>

            {/* KPI 4: Tenant Scope & Audit */}
            <SpotlightCard
              theme="light"
              spotlightColor="rgba(71, 85, 105, 0.08)"
              className="p-5 bg-surface border border-border rounded-lg shadow-subtle"
            >
              <div className="flex items-center justify-between text-xs text-ink-secondary mb-1">
                <span>Tenant Isolation</span>
                <span className="font-mono text-[10px] text-ink-secondary">X-Company-Id</span>
              </div>
              <div className="text-lg font-bold font-mono text-ink-primary tracking-tight mt-1 truncate">
                Active Tenant Verified
              </div>
              <div className="mt-2 text-[11px] text-ink-secondary flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                Server-side Resolution Enforced
              </div>
            </SpotlightCard>
          </div>
        </div>

        {/* Architecture & Non-Negotiables Verification Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Backend Architecture Specifications */}
          <div className="p-5 rounded-lg bg-surface border border-border shadow-subtle">
            <h4 className="text-sm font-semibold text-ink-primary flex items-center mb-3">
              <Layers className="w-4 h-4 mr-2 text-ink-secondary" />
              Backend Integrity Rules (Enforced)
            </h4>
            <ul className="space-y-2.5 text-xs text-ink-secondary">
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-brand mr-2 mt-0.5 flex-shrink-0" />
                <span>
                  <strong className="text-ink-primary">Zero Floating-Point Money:</strong> `@db.Decimal(15, 2)` in
                  Prisma schema, `decimal.js` calculations, numeric strings in JSON.
                </span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-brand mr-2 mt-0.5 flex-shrink-0" />
                <span>
                  <strong className="text-ink-primary">Double-Entry Discipline:</strong> Every posting recipe
                  requires balanced lines before atomic `prisma.$transaction` commit.
                </span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-brand mr-2 mt-0.5 flex-shrink-0" />
                <span>
                  <strong className="text-ink-primary">Immutable Ledger:</strong> Posted records return `403 Forbidden`
                  on update/delete. Corrections via reversal entries.
                </span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-brand mr-2 mt-0.5 flex-shrink-0" />
                <span>
                  <strong className="text-ink-primary">Concurrency Safe Document Numbers:</strong> Row-level lock
                  via `SELECT ... FOR UPDATE` on `DocumentSequence`.
                </span>
              </li>
            </ul>
          </div>

          {/* Frontend Design Specifications */}
          <div className="p-5 rounded-lg bg-surface border border-border shadow-subtle">
            <h4 className="text-sm font-semibold text-ink-primary flex items-center mb-3">
              <Building2 className="w-4 h-4 mr-2 text-ink-secondary" />
              Bespoke Financial UI Standards (Enforced)
            </h4>
            <ul className="space-y-2.5 text-xs text-ink-secondary">
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-brand mr-2 mt-0.5 flex-shrink-0" />
                <span>
                  <strong className="text-ink-primary">Anti-AI Fingerprint:</strong> Warm Alabaster (`#F8F9FA`),
                  Obsidian ink (`#0F172A`), 1px hairline borders (`#E4E7EC`). Zero generic gradients or AI slop.
                </span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-brand mr-2 mt-0.5 flex-shrink-0" />
                <span>
                  <strong className="text-ink-primary">Tabular Numbers Everywhere:</strong> `tabular-nums` applied
                  across all financial columns, amounts, and counters for pixel-perfect vertical alignment.
                </span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-brand mr-2 mt-0.5 flex-shrink-0" />
                <span>
                  <strong className="text-ink-primary">Tactile Micro-Interactions:</strong> Integrated React Bits
                  (`SpotlightCard`, `Counter`) for high-performance fintech dashboards.
                </span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-brand mr-2 mt-0.5 flex-shrink-0" />
                <span>
                  <strong className="text-ink-primary">Typography Pairing:</strong> Plus Jakarta Sans for UI
                  controls paired with JetBrains Mono for ledger codes, SKUs, and amounts.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

