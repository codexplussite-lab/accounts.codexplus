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
  AlertCircle,
  Landmark,
  CalendarClock,
  UserCheck,
  Database,
  LogOut,
  Menu,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { checkBackendHealth } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

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
  { label: "Recurring Invoices", href: "/invoices/recurring", icon: RefreshCw },
  { label: "Purchase Bills", href: "/bills", icon: Receipt },
  { label: "Inventory & Stock", href: "/inventory", icon: Package },
  { label: "Financial Reports", href: "/reports", icon: BarChart3 },
  { label: "Bank Reconciliation", href: "/banking/reconciliation", icon: Landmark },
  { label: "CSV Data Import", href: "/tools/import", icon: Database },
  { label: "Audit Log", href: "/audit-log", icon: ShieldAlert },
  { label: "Fiscal & Periods", href: "/settings/fiscal", icon: CalendarClock },
  { label: "Team & Roles", href: "/settings/team", icon: UserCheck }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, activeCompany, companies, switchCompany, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [health, setHealth] = useState<{ status: string; database?: string; timestamp: string; environment: string } | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const pathname = usePathname();

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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

  const companyInitials = (activeCompany?.name || "AE")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const userInitials = (user?.name || "US")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-canvas text-ink-primary">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Navigation Rail (Slide-over drawer on mobile, fixed rail on desktop) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-surface transition-all duration-200 ease-in-out",
          mobileOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0",
          collapsed ? "md:w-16" : "md:w-60"
        )}
      >
        {/* Company Switcher Header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-3.5">
          <div className="flex items-center space-x-2.5 overflow-hidden flex-1">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-ink-primary text-xs font-mono font-bold text-white shadow-subtle">
              {companyInitials}
            </div>
            {!collapsed && (
              <div className="truncate flex-1">
                {companies.length > 1 ? (
                  <select
                    value={activeCompany?.id || ""}
                    onChange={(e) => switchCompany(e.target.value)}
                    className="w-full bg-transparent text-xs font-semibold text-ink-primary truncate focus:outline-none cursor-pointer"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id} className="bg-surface text-ink-primary">
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="truncate text-xs font-semibold text-ink-primary">
                    {activeCompany?.name || "Enterprise Ledger"}
                  </div>
                )}
                <p className="text-[10px] font-mono text-ink-secondary">
                  {activeCompany?.currency || "PKR"} · Fiscal 2026
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex h-6 w-6 items-center justify-center rounded text-ink-secondary hover:bg-canvas hover:text-ink-primary transition-colors ml-1"
            title={collapsed ? "Expand rail" : "Collapse rail"}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="flex md:hidden h-7 w-7 items-center justify-center rounded text-ink-secondary hover:bg-canvas hover:text-ink-primary transition-colors ml-1"
            aria-label="Close navigation menu"
          >
            <X className="h-4 w-4" />
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

        {/* User Scope Footer with Logout */}
        <div className="border-t border-border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="h-6 w-6 rounded-full bg-emerald-light border border-emerald-border flex items-center justify-center text-[10px] font-bold text-emerald-brand font-mono flex-shrink-0">
                {userInitials}
              </div>
              {!collapsed && (
                <div className="truncate">
                  <p className="truncate text-xs font-medium text-ink-primary leading-tight">
                    {user?.name || "User"}
                  </p>
                  <p className="text-[10px] font-mono text-emerald-brand uppercase font-semibold">
                    {activeCompany?.role || "MEMBER"}
                  </p>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={logout}
                className="text-ink-muted hover:text-rose-600 transition-colors p-1"
                title="Sign out of ERP"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={cn("flex flex-1 flex-col min-w-0 transition-all duration-200 pl-0", collapsed ? "md:pl-16" : "md:pl-60")}>
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4 sm:px-6 gap-3">
          <div className="flex items-center space-x-2 text-xs min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex md:hidden h-8 w-8 items-center justify-center rounded border border-border bg-canvas text-ink-primary hover:bg-surface mr-1 flex-shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span className="text-ink-secondary truncate hidden sm:inline">{activeCompany?.name || "Acme Enterprise"}</span>
            <span className="text-border hidden sm:inline">/</span>
            <span className="font-medium text-ink-primary truncate">
              {NAV_ITEMS.find((n) => n.href === pathname)?.label || "Workspace"}
            </span>
          </div>

          {/* Telemetry Status Bar */}
          <div className="flex items-center space-x-3 text-xs flex-shrink-0">
            <div className="flex items-center space-x-2 rounded border border-border bg-canvas px-2 sm:px-2.5 py-1">
              <span
                className={cn(
                  "h-2 w-2 rounded-full flex-shrink-0",
                  loadingHealth
                    ? "bg-amber-400 animate-pulse"
                    : health?.status === "ok"
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-rose-500"
                )}
              />
              <span className="font-mono text-[11px] text-ink-secondary">
                <span className="hidden sm:inline">Backend: </span>
                {loadingHealth
                  ? "Probing..."
                  : health?.status === "ok"
                  ? "Online"
                  : "Offline"}
                {health?.status === "ok" && health?.database === "connected" && (
                  <span className="hidden lg:inline"> · DB Connected</span>
                )}
              </span>
              <button
                onClick={verifyHealth}
                className="text-ink-secondary hover:text-ink-primary transition-colors ml-1"
                title="Refresh Backend Telemetry"
                aria-label="Refresh Backend Telemetry"
              >
                <RefreshCw className={cn("h-3 w-3", loadingHealth && "animate-spin")} />
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 sm:p-6 min-w-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

