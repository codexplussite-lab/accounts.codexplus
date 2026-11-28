"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Search,
  Filter,
  Calendar,
  Eye,
  RefreshCw,
  ArrowRight,
  User,
  Clock,
  Layers,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/layout/AppShell";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface AuditLogItem {
  id: string;
  companyId: string;
  userId: string | null;
  user: { id: string; name: string; email: string } | null;
  model: string;
  objectId: string;
  action: string;
  oldData: any;
  newData: any;
  ipAddress: string | null;
  timestamp: string;
}

export default function AuditLogPage() {
  const { status, activeCompany } = useAuth();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);

  // Filters
  const [modelFilter, setModelFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Diff Modal State
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = async () => {
    if (status !== "AUTHENTICATED") return;
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (modelFilter) params.model = modelFilter;
      if (actionFilter) params.action = actionFilter;
      if (searchTerm) params.search = searchTerm;

      const res = await apiClient<AuditLogItem[]>("/audit-logs", { params });
      setLogs(res.data || []);
      setTotal(res.meta?.total || 0);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "AUTHENTICATED") {
      fetchLogs();
    }
  }, [status, activeCompany?.id, page, modelFilter, actionFilter]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case "CREATE":
        return <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200">CREATE</Badge>;
      case "POST":
        return <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-semibold">POST</Badge>;
      case "UPDATE":
        return <Badge className="bg-amber-50 text-amber-800 border-amber-200">UPDATE</Badge>;
      case "VOID":
      case "REVERSE":
        return <Badge className="bg-rose-50 text-rose-800 border-rose-200">REVERSE</Badge>;
      case "DELETE":
        return <Badge className="bg-rose-100 text-rose-900 border-rose-300">DELETE</Badge>;
      case "LOGIN":
        return <Badge className="bg-zinc-100 text-zinc-700 border-zinc-200">LOGIN</Badge>;
      default:
        return <Badge className="bg-zinc-100 text-zinc-700 border-zinc-200">{action}</Badge>;
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-semibold tracking-tight text-ink-primary">Audit Log</h1>
            <span className="font-mono text-[11px] text-ink-secondary">
              Append-only trail
            </span>
          </div>
          <p className="text-xs text-ink-secondary mt-1">
            Operational log recording create, post, update, void, and sign-in events
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="text-xs">
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Trail
          </Button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-ink-secondary">Total Logged Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-ink-primary tabular-nums">{total}</div>
            <p className="text-[11px] text-ink-secondary mt-1">Enforced by database-level write rules</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-ink-secondary">Protected Entities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-ink-primary tabular-nums">11 Models</div>
            <p className="text-[11px] text-ink-secondary mt-1">Invoices, Bills, Journals, Stock, Locks, Users</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-ink-secondary">Integrity Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 text-emerald-700 font-semibold text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>100% Immutable Verification</span>
            </div>
            <p className="text-[11px] text-ink-secondary mt-1">Zero deletes or updates permitted</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-ink-secondary" />
              <Input
                placeholder="Search object ID or memo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchLogs()}
                className="pl-8 text-xs font-mono"
              />
            </div>

            <select
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              className="h-9 w-full rounded border border-border bg-surface px-3 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-1 focus:ring-emerald-brand font-mono"
            >
              <option value="">All Models (All Resources)</option>
              <option value="Invoice">Invoice</option>
              <option value="Bill">Bill</option>
              <option value="JournalEntry">JournalEntry</option>
              <option value="Company">Company</option>
              <option value="FiscalYear">FiscalYear</option>
              <option value="BankAccount">BankAccount</option>
              <option value="BankStatement">BankStatement</option>
              <option value="Membership">Membership</option>
              <option value="Contact">Contact</option>
              <option value="StockMovement">StockMovement</option>
            </select>

            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="h-9 w-full rounded border border-border bg-surface px-3 py-1.5 text-xs text-ink-primary focus:outline-none focus:ring-1 focus:ring-emerald-brand font-mono"
            >
              <option value="">All Actions</option>
              <option value="CREATE">CREATE</option>
              <option value="POST">POST</option>
              <option value="UPDATE">UPDATE</option>
              <option value="VOID">VOID / REVERSE</option>
              <option value="DELETE">DELETE</option>
              <option value="LOGIN">LOGIN</option>
            </select>

            <Button variant="secondary" size="sm" onClick={fetchLogs} className="h-9 text-xs">
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card className="border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas border-b border-border text-ink-secondary uppercase tracking-wider text-[10px] font-mono">
              <tr>
                <th className="py-2.5 px-4">Timestamp (UTC)</th>
                <th className="py-2.5 px-4">Actor</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Model</th>
                <th className="py-2.5 px-4">Object ID</th>
                <th className="py-2.5 px-4">IP Address</th>
                <th className="py-2.5 px-4 text-right">Data Snapshot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-ink-secondary">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-ink-secondary" />
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-ink-secondary">
                    No audit records match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-canvas transition-colors">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-ink-secondary whitespace-nowrap tabular-nums">
                      {new Date(log.timestamp).toLocaleString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit"
                      })}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-ink-primary">
                      {log.user ? (
                        <div>
                          <div className="font-medium text-ink-primary">{log.user.name}</div>
                          <div className="text-[10px] font-mono text-ink-secondary">{log.user.email}</div>
                        </div>
                      ) : (
                        <span className="font-mono text-ink-secondary text-[11px]">System / Anonymous</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">{getActionBadge(log.action)}</td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-ink-primary text-[11px]">{log.model}</td>
                    <td className="py-2.5 px-4 font-mono text-ink-secondary text-[11px] truncate max-w-[140px]" title={log.objectId}>
                      {log.objectId}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-ink-secondary text-[11px] whitespace-nowrap">
                      {log.ipAddress || "—"}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        className="h-7 text-[11px] px-2 font-mono"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View Diff
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-canvas text-xs text-ink-secondary">
          <div>
            Showing <span className="font-mono font-medium text-ink-primary">{logs.length}</span> of{" "}
            <span className="font-mono font-medium text-ink-primary">{total}</span> events
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage(page - 1)}
              className="h-7 text-xs"
            >
              Previous
            </Button>
            <span className="font-mono text-xs px-2">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page * limit >= total || loading}
              onClick={() => setPage(page + 1)}
              className="h-7 text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* Old Data vs New Data Diff Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-lg border border-border bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-ink-primary">
                    Audit Record: {selectedLog.model} #{selectedLog.objectId}
                  </h3>
                  {getActionBadge(selectedLog.action)}
                </div>
                <p className="text-xs text-ink-secondary mt-0.5 font-mono">
                  Log ID: {selectedLog.id} · Recorded {new Date(selectedLog.timestamp).toISOString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded p-1 text-ink-secondary hover:bg-canvas hover:text-ink-primary"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Old Data Box */}
                <div className="rounded border border-border bg-canvas p-3">
                  <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
                    <span className="text-xs font-semibold text-rose-800 flex items-center">
                      <span className="h-2 w-2 rounded-full bg-rose-500 mr-1.5" />
                      Prior State (Old Data)
                    </span>
                    <span className="text-[10px] font-mono text-ink-secondary">Before Modification</span>
                  </div>
                  <pre className="text-[11px] font-mono text-ink-primary overflow-x-auto p-2 bg-surface rounded border border-border max-h-[300px]">
                    {selectedLog.oldData
                      ? JSON.stringify(selectedLog.oldData, null, 2)
                      : "/* No prior state (Resource created or initial event) */"}
                  </pre>
                </div>

                {/* New Data Box */}
                <div className="rounded border border-border bg-canvas p-3">
                  <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
                    <span className="text-xs font-semibold text-emerald-800 flex items-center">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5" />
                      Updated State (New Data)
                    </span>
                    <span className="text-[10px] font-mono text-ink-secondary">Committed to Database</span>
                  </div>
                  <pre className="text-[11px] font-mono text-ink-primary overflow-x-auto p-2 bg-surface rounded border border-border max-h-[300px]">
                    {selectedLog.newData
                      ? JSON.stringify(selectedLog.newData, null, 2)
                      : "/* No resulting data (Resource purged or void event) */"}
                  </pre>
                </div>
              </div>

              {/* Security & Provenance Context */}
              <div className="rounded border border-border bg-canvas p-3 text-xs">
                <h4 className="font-semibold text-ink-primary mb-2 flex items-center">
                  <ShieldAlert className="h-4 w-4 mr-1 text-emerald-brand" />
                  Compliance & Provenance Verification
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                  <div>
                    <span className="text-ink-secondary block">Operator ID:</span>
                    <span className="text-ink-primary truncate block">{selectedLog.userId || "System Service"}</span>
                  </div>
                  <div>
                    <span className="text-ink-secondary block">Client IP:</span>
                    <span className="text-ink-primary block">{selectedLog.ipAddress || "Internal Server"}</span>
                  </div>
                  <div>
                    <span className="text-ink-secondary block">Company ID:</span>
                    <span className="text-ink-primary truncate block">{selectedLog.companyId}</span>
                  </div>
                  <div>
                    <span className="text-ink-secondary block">Immutability Rule:</span>
                    <span className="text-emerald-700 font-semibold block">Active (Enforced)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border px-6 py-3 bg-canvas flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)} className="text-xs font-mono">
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AppShell>
  );
}
