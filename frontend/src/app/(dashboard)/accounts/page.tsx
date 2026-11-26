"use client";

import React, { useState, useEffect } from "react";
import {
  Layers,
  Search,
  Plus,
  Lock,
  CheckCircle2,
  AlertCircle,
  FolderTree,
  List,
  Filter,
  RefreshCw,
  Loader2
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface Account {
  id: string;
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  parentId: string | null;
  isSystem: boolean;
  systemKey: string | null;
  isActive: boolean;
}

export default function AccountsPage() {
  const { status, activeCompany } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  // New account form state
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<Account["type"]>("ASSET");
  const [parentId, setParentId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchAccounts = async () => {
    if (status !== "AUTHENTICATED") return;
    setLoading(true);
    try {
      const res = await apiClient<Account[]>("/accounts", {
        params: {
          type: activeTab === "ALL" ? undefined : activeTab,
          search: search || undefined
        }
      });
      setAccounts(res.data);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "AUTHENTICATED") {
      fetchAccounts();
    }
  }, [status, activeCompany?.id, activeTab]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFormError(null);

    try {
      await apiClient("/accounts", {
        method: "POST",
        body: JSON.stringify({
          code,
          name,
          type,
          parentId: parentId || null
        })
      });

      setShowModal(false);
      setCode("");
      setName("");
      fetchAccounts();
    } catch (err: any) {
      setFormError(err.message || "Failed to create account");
    } finally {
      setCreating(false);
    }
  };

  const filteredAccounts = accounts.filter((acc) => {
    if (activeTab !== "ALL" && acc.type !== activeTab) return false;
    if (search) {
      const q = search.toLowerCase();
      return acc.code.toLowerCase().includes(q) || acc.name.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Page Action Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-ink-primary tracking-tight">Chart of Accounts</h1>
            <p className="text-xs text-ink-secondary">Manage general ledger accounts, parent-child hierarchies, and system keys</p>
          </div>
          <div className="flex items-center space-x-2.5">
            <Button onClick={() => setShowModal(true)} variant="default" className="shadow-subtle">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New Account
            </Button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
          {/* Type Tabs */}
          <div className="flex items-center space-x-1">
            {["ALL", "ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-ink-primary text-white shadow-subtle"
                    : "text-ink-secondary hover:bg-canvas hover:text-ink-primary"
                }`}
              >
                {tab === "ALL" ? "All Accounts" : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-64">
            <Input
              placeholder="Filter by code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
            <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-2.5" />
          </div>
        </div>

        {/* Accounts Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas border-b border-border text-[11px] font-mono uppercase tracking-wider text-ink-secondary">
                <tr>
                  <th className="py-2.5 px-4 font-semibold w-28">Code</th>
                  <th className="py-2.5 px-4 font-semibold">Account Name</th>
                  <th className="py-2.5 px-4 font-semibold w-32">Type</th>
                  <th className="py-2.5 px-4 font-semibold w-40">System Role</th>
                  <th className="py-2.5 px-4 font-semibold w-24 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-ink-secondary">
                      <Loader2 className="w-4 h-4 mx-auto animate-spin mb-1 text-emerald-brand" />
                      Loading chart of accounts...
                    </td>
                  </tr>
                ) : filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-ink-secondary">
                      No accounts found matching filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-canvas/50 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-ink-primary">
                        {acc.code}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-medium text-ink-primary">{acc.name}</span>
                          {acc.isSystem && (
                            <span title="System Protected Account">
                              <Lock className="w-3 h-3 text-ink-muted" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge
                          variant={
                            acc.type === "ASSET" || acc.type === "INCOME"
                              ? "paid"
                              : acc.type === "LIABILITY"
                              ? "partially_paid"
                              : acc.type === "EXPENSE"
                              ? "overdue"
                              : "default"
                          }
                        >
                          {acc.type}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-ink-secondary">
                        {acc.systemKey || "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <span className="inline-flex items-center text-[11px] text-emerald-brand font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                          Active
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Modal: New Account Dialog */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-surface rounded-lg border border-border w-full max-w-md shadow-xl overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink-primary">Create New Account</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-ink-secondary hover:text-ink-primary text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateAccount} className="p-4 space-y-3.5">
                {formError && (
                  <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-ink-secondary uppercase tracking-wider">
                      Account Code
                    </label>
                    <Input
                      required
                      placeholder="e.g. 1005"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-ink-secondary uppercase tracking-wider">
                      Account Type
                    </label>
                    <select
                      className="flex h-8 w-full rounded border border-border bg-surface px-3 py-1 text-xs text-ink-primary shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink-primary"
                      value={type}
                      onChange={(e) => setType(e.target.value as Account["type"])}
                    >
                      <option value="ASSET">Asset</option>
                      <option value="LIABILITY">Liability</option>
                      <option value="EQUITY">Equity</option>
                      <option value="INCOME">Income</option>
                      <option value="EXPENSE">Expense</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-ink-secondary uppercase tracking-wider">
                    Account Name
                  </label>
                  <Input
                    required
                    placeholder="e.g. Petty Cash Vault"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="pt-2 flex items-center justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="emerald" disabled={creating}>
                    {creating ? "Saving..." : "Create Account"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

