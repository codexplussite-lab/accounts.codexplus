"use client";

import React, { useState, useEffect } from "react";
import {
  CalendarClock,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  RotateCcw
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/layout/AppShell";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface FiscalYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
}

export default function FiscalSettingsPage() {
  const { status, activeCompany } = useAuth();
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [newLockDate, setNewLockDate] = useState("");
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingLock, setSavingLock] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal dialog states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState<FiscalYear | null>(null);
  const [showReopenModal, setShowReopenModal] = useState<FiscalYear | null>(null);

  // Form states
  const [fyName, setFyName] = useState("");
  const [fyStartDate, setFyStartDate] = useState("");
  const [fyEndDate, setFyEndDate] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [lockRes, yearsRes] = await Promise.all([
        apiClient<{ lockedUntil: string | null }>("fiscal/period-lock"),
        apiClient<FiscalYear[]>("fiscal/years")
      ]);

      const lock = lockRes.data?.lockedUntil;
      setLockedUntil(lock ? lock.split("T")[0] : null);
      setNewLockDate(lock ? lock.split("T")[0] : "");
      setFiscalYears(yearsRes.data || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load fiscal configuration.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "AUTHENTICATED") {
      fetchData();
    }
  }, [status, activeCompany?.id]);

  const handleSavePeriodLock = async (dateVal: string | null) => {
    setSavingLock(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await apiClient("fiscal/period-lock", {
        method: "PUT",
        body: JSON.stringify({ lockedUntil: dateVal || null })
      });
      setLockedUntil(dateVal);
      setSuccessMsg(dateVal ? `Period lock activated through ${dateVal}.` : "Period lock cleared. Backdated entries permitted.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update period lock.");
    } finally {
      setSavingLock(false);
    }
  };

  const handleCreateFiscalYear = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await apiClient("fiscal/years", {
        method: "POST",
        body: JSON.stringify({
          name: fyName,
          startDate: fyStartDate,
          endDate: fyEndDate
        })
      });
      setShowCreateModal(false);
      setFyName("");
      setFyStartDate("");
      setFyEndDate("");
      setSuccessMsg("Fiscal year created successfully.");
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create fiscal year.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseFiscalYear = async (fy: FiscalYear) => {
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient<{ netProfit: string }>(`fiscal/years/${fy.id}/close`, {
        method: "POST"
      });
      setShowCloseModal(null);
      setSuccessMsg(`Fiscal year '${fy.name}' successfully closed. Net profit of ${res.data?.netProfit} PKR transferred to Retained Earnings (3100).`);
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || "Year-end closing failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopenFiscalYear = async (fy: FiscalYear) => {
    if (!reopenReason.trim() || reopenReason.length < 5) {
      setErrorMsg("A detailed audit reason (at least 5 characters) is required to reopen a closed fiscal year.");
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    try {
      await apiClient(`fiscal/years/${fy.id}/reopen`, {
        method: "POST",
        body: JSON.stringify({ reason: reopenReason })
      });
      setShowReopenModal(null);
      setReopenReason("");
      setSuccessMsg(`Fiscal year '${fy.name}' reopened. Reversal logged in Audit Trail.`);
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reopen fiscal year.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-semibold tracking-tight text-ink-primary">Fiscal & Accounting Periods</h1>
            <span className="font-mono text-[11px] text-ink-secondary">
              Period locks & closing
            </span>
          </div>
          <p className="text-xs text-ink-secondary mt-1">
            Configure transaction date locks and execute year-end closing to Retained Earnings (3100)
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="text-xs">
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreateModal(true)} className="text-xs bg-emerald-brand hover:bg-emerald-900 text-white">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Fiscal Year
          </Button>
        </div>
      </div>

      {/* Status Notifications */}
      {errorMsg && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-600 font-bold ml-2">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Period Lock Control Card */}
      <Card className="border-border">
        <CardHeader className="pb-3 border-b border-border bg-canvas/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Lock className="h-4 w-4 text-emerald-brand" />
              <CardTitle className="text-sm font-semibold text-ink-primary">Accounting Period Lock</CardTitle>
            </div>
            {lockedUntil ? (
              <Badge className="bg-rose-50 text-rose-800 border-rose-200 font-mono">
                LOCKED THROUGH {lockedUntil}
              </Badge>
            ) : (
              <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-mono">
                ALL PERIODS OPEN
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <p className="text-xs text-ink-secondary leading-relaxed">
            Transactions dated on or before the selected date will be strictly rejected across Invoices, Bills, Journal Entries,
            and Payments. This prevents unauthorized backdated postings and ensures tax return integrity.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="w-full sm:w-64">
              <Input
                type="date"
                value={newLockDate}
                onChange={(e) => setNewLockDate(e.target.value)}
                className="text-xs font-mono h-9"
              />
            </div>
            <Button
              size="sm"
              disabled={savingLock || !newLockDate}
              onClick={() => handleSavePeriodLock(newLockDate)}
              className="text-xs bg-ink-primary text-white hover:bg-slate-800 h-9"
            >
              <Lock className="h-3.5 w-3.5 mr-1.5" />
              {savingLock ? "Enforcing..." : "Enforce Period Lock"}
            </Button>

            {lockedUntil && (
              <Button
                variant="outline"
                size="sm"
                disabled={savingLock}
                onClick={() => handleSavePeriodLock(null)}
                className="text-xs text-rose-700 hover:bg-rose-50 border-rose-200 h-9"
              >
                <Unlock className="h-3.5 w-3.5 mr-1.5" />
                Clear Lock (Open Periods)
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fiscal Years Directory */}
      <Card className="border-border">
        <CardHeader className="pb-3 border-b border-border bg-canvas/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CalendarClock className="h-4 w-4 text-emerald-brand" />
              <CardTitle className="text-sm font-semibold text-ink-primary">Fiscal Years & Year-End Closings</CardTitle>
            </div>
            <span className="text-xs text-ink-secondary font-mono">{fiscalYears.length} Defined Periods</span>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas border-b border-border text-ink-secondary uppercase tracking-wider text-[10px] font-mono">
              <tr>
                <th className="py-2.5 px-4">Period Name</th>
                <th className="py-2.5 px-4">Start Date</th>
                <th className="py-2.5 px-4">End Date</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-ink-secondary">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-ink-secondary" />
                    Loading fiscal years...
                  </td>
                </tr>
              ) : fiscalYears.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-ink-secondary">
                    No fiscal years configured yet. Click "New Fiscal Year" to establish your financial calendar.
                  </td>
                </tr>
              ) : (
                fiscalYears.map((fy) => (
                  <tr key={fy.id} className="hover:bg-canvas transition-colors">
                    <td className="py-3 px-4 font-bold text-ink-primary font-mono">{fy.name}</td>
                    <td className="py-3 px-4 font-mono text-ink-secondary tabular-nums">
                      {new Date(fy.startDate).toISOString().split("T")[0]}
                    </td>
                    <td className="py-3 px-4 font-mono text-ink-secondary tabular-nums">
                      {new Date(fy.endDate).toISOString().split("T")[0]}
                    </td>
                    <td className="py-3 px-4">
                      {fy.isClosed ? (
                        <Badge className="bg-zinc-100 text-zinc-700 border-zinc-200 font-mono">
                          CLOSED & SEALED
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-mono">
                          ACTIVE / OPEN
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {fy.isClosed ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowReopenModal(fy)}
                          className="h-7 text-xs text-amber-800 border-amber-200 hover:bg-amber-50"
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Reopen Year
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setShowCloseModal(fy)}
                          className="h-7 text-xs bg-ink-primary text-white hover:bg-slate-800 font-mono"
                        >
                          <BookOpen className="h-3 w-3 mr-1" />
                          Close Year-End
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal 1: Create Fiscal Year */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface shadow-xl p-6">
            <h3 className="text-sm font-bold text-ink-primary mb-1">Establish New Fiscal Year</h3>
            <p className="text-xs text-ink-secondary mb-4">
              Define the financial calendar period. Non-overlapping calendar ranges are strictly enforced.
            </p>

            <form onSubmit={handleCreateFiscalYear} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-ink-primary block mb-1">Fiscal Year Label</label>
                <Input
                  required
                  placeholder="e.g. FY 2026 or 2025-2026"
                  value={fyName}
                  onChange={(e) => setFyName(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-ink-primary block mb-1">Start Date</label>
                  <Input
                    required
                    type="date"
                    value={fyStartDate}
                    onChange={(e) => setFyStartDate(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-primary block mb-1">End Date</label>
                  <Input
                    required
                    type="date"
                    value={fyEndDate}
                    onChange={(e) => setFyEndDate(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                  disabled={actionLoading}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={actionLoading}
                  className="text-xs bg-emerald-brand hover:bg-emerald-900 text-white"
                >
                  {actionLoading ? "Creating..." : "Establish Period"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Year-End Close Confirmation Wizard */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-xl p-6">
            <div className="flex items-center space-x-2 text-ink-primary mb-2">
              <ShieldCheck className="h-5 w-5 text-emerald-brand" />
              <h3 className="text-base font-bold">Year-End Closing Wizard: {showCloseModal.name}</h3>
            </div>

            <p className="text-xs text-ink-secondary mb-4 leading-relaxed">
              You are about to execute the official double-entry year-end closing process for fiscal period{" "}
              <span className="font-mono font-bold text-ink-primary">{showCloseModal.name}</span> (
              {new Date(showCloseModal.startDate).toISOString().split("T")[0]} to{" "}
              {new Date(showCloseModal.endDate).toISOString().split("T")[0]}).
            </p>

            <div className="rounded border border-border bg-canvas p-3 mb-4 space-y-2 text-xs">
              <h4 className="font-semibold text-ink-primary">Automated Accounting Operations:</h4>
              <ul className="list-disc pl-5 space-y-1 text-ink-secondary font-mono text-[11px]">
                <li>Zeroes out all Income account balances via offsetting Debit entries.</li>
                <li>Zeroes out all Operating Expense account balances via offsetting Credit entries.</li>
                <li>Transfers the exact calculated Net Income / Net Loss into Retained Earnings (Account 3100).</li>
                <li>Permanently seals the fiscal year to prevent any further journal or subledger mutations.</li>
              </ul>
            </div>

            <div className="flex justify-end space-x-2 border-t border-border pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCloseModal(null)}
                disabled={actionLoading}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => handleCloseFiscalYear(showCloseModal)}
                disabled={actionLoading}
                className="text-xs bg-ink-primary hover:bg-slate-900 text-white font-mono"
              >
                {actionLoading ? "Executing Closing Engine..." : "Confirm & Close Fiscal Year"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Reopen Closed Fiscal Year */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface shadow-xl p-6">
            <div className="flex items-center space-x-2 text-amber-800 mb-2">
              <RotateCcw className="h-5 w-5 text-amber-600" />
              <h3 className="text-base font-bold">Reopen Fiscal Year: {showReopenModal.name}</h3>
            </div>

            <p className="text-xs text-ink-secondary mb-3 leading-relaxed">
              Reopening a closed fiscal year reverses the closing journal entry and enables transactions within this date range.
              This action requires <strong>OWNER</strong> authorization and is permanently logged in the audit trail.
            </p>

            <div className="mb-4">
              <label className="text-xs font-semibold text-ink-primary block mb-1">
                Mandatory Audit Justification (Min 5 chars):
              </label>
              <textarea
                required
                rows={3}
                placeholder="Explain why this closed period is being unsealed (e.g., external audit adjustments, tax correction)..."
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                className="w-full rounded border border-border bg-surface p-2 text-xs font-mono text-ink-primary focus:outline-none focus:ring-1 focus:ring-emerald-brand"
              />
            </div>

            <div className="flex justify-end space-x-2 border-t border-border pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReopenModal(null)}
                disabled={actionLoading}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => handleReopenFiscalYear(showReopenModal)}
                disabled={actionLoading || reopenReason.trim().length < 5}
                className="text-xs bg-amber-700 hover:bg-amber-800 text-white font-mono"
              >
                {actionLoading ? "Reopening..." : "Authorize Reopening"}
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AppShell>
  );
}
