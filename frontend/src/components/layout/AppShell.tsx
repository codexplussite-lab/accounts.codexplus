"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  BookOpen,
  Users,
  FileText,
  Receipt,
  Package,
  BarChart3,
  ShieldAlert,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { checkBackendHealth } from "@/lib/api";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Chart of Accounts", href: "/accounts", icon: Layers },
  { label: "Journal Entries", href: "/journal", icon: BookOpen },
  { label: "Contacts", href: "/contacts", icon: Users },
  { label: "Sales Invoices", href: "/invoices", icon: FileText },
  { label: "Purchase Bills", href: "/bills", icon: Receipt },
  { label: "Inventory & Stock", href: "/inventory", icon: Package },
  { label: "Financial Reports", href: "/reports", icon: BarChart3 },
  { label: "Audit Log", href: "/audit-log", icon: ShieldAlert },
  { label: "Settings", href: "/settings", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [health, setHealth] = useState<{ status: string; timestamp: string; environment: string } | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const pathname = usePathname();

  const verifyHealth = async () => {
    setLoadingHealth(true);
    try {
      const data = await checkBackendHealth();
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    verifyHealth();
    const interval = setInterval(verifyHealth, 30000); // 30s telemetry
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-screen bg-canvas text-ink-primary">
      {/* Left Navigation Rail */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-surface transition-all duration-200 ease-in-out",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Company Switcher Header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-3.5">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-ink-primary text-xs font-mono font-bold text-white shadow-subtle">
              AE
            </div>
            {!collapsed && (
              <div className="truncate">
                <div className="flex items-center space-x-1.5">
                  <span className="truncate text-xs font-semibold text-ink-primary">Acme Enterprise</span>
                </div>
                <p className="text-[10px] font-mono text-ink-secondary">PKR · Fiscal 2026</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-6 w-6 items-center justify-center rounded text-ink-secondary hover:bg-canvas hover:text-ink-primary transition-colors"
            title={collapsed ? "Expand rail" : "Collapse rail"}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-0.5 p-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center rounded px-2.5 py-2 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-canvas text-ink-primary font-semibold shadow-subtle border border-border"
                    : "text-ink-secondary hover:bg-canvas hover:text-ink-primary border border-transparent"
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-emerald-brand" : "text-ink-secondary")} />
                {!collapsed && <span className="ml-2.5 truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Scope Footer */}
        <div className="border-t border-border p-3">
          <div className="flex items-center space-x-2.5">
            <div className="h-6 w-6 rounded-full bg-emerald-light border border-emerald-border flex items-center justify-center text-[10px] font-bold text-emerald-brand font-mono">
              OW
            </div>
            {!collapsed && (
              <div className="truncate">
                <p className="truncate text-xs font-medium text-ink-primary leading-tight">Syed Moosa</p>
                <p className="text-[10px] font-mono text-emerald-brand uppercase font-semibold">OWNER</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={cn("flex flex-1 flex-col transition-all duration-200", collapsed ? "pl-16" : "pl-60")}>
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface px-6">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-ink-secondary">Acme Enterprise</span>
            <span className="text-border">/</span>
            <span className="font-medium text-ink-primary">
              {NAV_ITEMS.find((n) => n.href === pathname)?.label || "Workspace"}
            </span>
          </div>

          {/* Telemetry Status Bar */}
          <div className="flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-2 rounded border border-border bg-canvas px-2.5 py-1">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  loadingHealth
                    ? "bg-amber-400 animate-pulse"
                    : health?.status === "ok"
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-rose-500"
                )}
              />
              <span className="font-mono text-[11px] text-ink-secondary">
                Backend: {loadingHealth ? "Probing..." : health?.status === "ok" ? "Online (4000)" : "Offline"}
              </span>
              <button
                onClick={verifyHealth}
                className="text-ink-secondary hover:text-ink-primary transition-colors ml-1"
                title="Refresh Backend Telemetry"
              >
                <RefreshCw className={cn("h-3 w-3", loadingHealth && "animate-spin")} />
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

