"use client";

import React, { useState, useEffect } from "react";
import {
  Landmark,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Link as LinkIcon,
  Unlink,
  FileSpreadsheet,
  Zap,
  ArrowRight,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/layout/AppShell";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface BankAccount {
  id: string;
  name: string;
  accountId: string;
  accountNo: string | null;
  bookBalance: string;
}

interface StatementLine {
  id: string;
  date: string;
  description: string;
  reference: string | null;
  amount: string;
  isReconciled: boolean;
  matchedLineId: string | null;
}

interface UnmatchedGlLine {
  id: string;
  date: string;
  number: string;
  narration: string;
  debit: string;
  credit: string;
}

interface ReconciliationData {
  bankAccount: BankAccount;
  statement: {
    id: string;
    fileName: string;
    uploadedAt: string;
    openingBalance: string;
    closingBalance: string;
  } | null;
  statementBalance: string;
  bookBalance: string;
  unclearedDeposits: string;
  unclearedWithdrawals: string;
  unmatchedStatementTotal: string;
  difference: string;
  status: "RECONCILED" | "UNRECONCILED" | "NO_STATEMENT";
  statementLines: StatementLine[];
  unmatchedGlLines: UnmatchedGlLine[];
}

export default function BankReconciliationPage() {
  const { status, activeCompany } = useAuth();
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [reconData, setReconData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Upload Form
  const [fileName, setFileName] = useState("bank-statement.csv");
  const [csvContent, setCsvContent] = useState("");
  const [closingBalance, setClosingBalance] = useState("");

  // Manual Match Selection
  const [selectedStmtLineId, setSelectedStmtLineId] = useState<string | null>(null);

  const fetchBankAccounts = async () => {
    try {
      const res = await apiClient<BankAccount[]>("/banking/accounts");
      const list = res.data || [];
      setBankAccounts(list);
      if (list.length > 0 && !selectedAccountId) {
        setSelectedAccountId(list[0].id);
      } else if (list.length === 0) {
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load bank accounts.");
      setLoading(false);
    }
  };

  const fetchReconciliation = async (accId: string) => {
    if (!accId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient<ReconciliationData>(`banking/reconciliation/${accId}`);
      setReconData(res.data);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load bank reconciliation report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "AUTHENTICATED") {
      fetchBankAccounts();
    }
  }, [status, activeCompany?.id]);

  useEffect(() => {
    if (status === "AUTHENTICATED" && selectedAccountId) {
      fetchReconciliation(selectedAccountId);
    }
  }, [status, activeCompany?.id, selectedAccountId]);

  const handleImportStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await apiClient("banking/statements/import", {
        method: "POST",
        body: JSON.stringify({
          bankAccountId: selectedAccountId,
          fileName,
          csvContent,
          closingBalance: closingBalance || undefined
        })
      });
      setShowUploadModal(false);
      setCsvContent("");
      setSuccessMsg("Bank statement imported successfully. Non-duplication rule verified.");
      await fetchReconciliation(selectedAccountId);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to import bank statement.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAutoMatch = async () => {
    if (!reconData?.statement?.id) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient<{ matchedCount: number }>(
        `banking/statements/${reconData.statement.id}/auto-match`,
        { method: "POST" }
      );
      setSuccessMsg(`Auto-match complete: ${res.data?.matchedCount || 0} transactions reconciled.`);
      await fetchReconciliation(selectedAccountId);
    } catch (err: any) {
      setErrorMsg(err.message || "Auto-match failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualMatch = async (glLineId: string) => {
    if (!selectedStmtLineId) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await apiClient("banking/match", {
        method: "POST",
        body: JSON.stringify({
          statementLineId: selectedStmtLineId,
          journalLineId: glLineId
        })
      });
      setSelectedStmtLineId(null);
      setSuccessMsg("Transaction manually linked and reconciled.");
      await fetchReconciliation(selectedAccountId);
    } catch (err: any) {
      setErrorMsg(err.message || "Manual matching failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnmatch = async (lineId: string) => {
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await apiClient(`banking/unmatch/${lineId}`, { method: "POST" });
      setSuccessMsg("Match undone. Transaction returned to uncleared state.");
      await fetchReconciliation(selectedAccountId);
    } catch (err: any) {
      setErrorMsg(err.message || "Unmatch failed.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-semibold tracking-tight text-ink-primary">Bank Reconciliation</h1>
            <span className="font-mono text-[11px] text-ink-secondary">
              Statement matching
            </span>
          </div>
          <p className="text-xs text-ink-secondary mt-1">
            Match imported bank statement feeds against General Ledger cash balances
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {reconData?.statement && (
            <Button
              size="sm"
              onClick={handleAutoMatch}
              disabled={actionLoading || loading}
              className="text-xs bg-emerald-brand hover:bg-emerald-900 text-white font-mono"
            >
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              {actionLoading ? "Matching..." : "1-Click Auto-Match"}
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowUploadModal(true)}
            className="text-xs"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Upload Bank CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => selectedAccountId && fetchReconciliation(selectedAccountId)}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Notifications */}
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

      {/* Bank Account Selector Bar */}
      <Card className="border-border">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Landmark className="h-5 w-5 text-emerald-brand flex-shrink-0" />
            <div>
              <span className="text-xs text-ink-secondary block">Select Operating Bank Account:</span>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="h-8 rounded border border-border bg-surface px-2.5 text-xs font-semibold text-ink-primary focus:outline-none focus:ring-1 focus:ring-emerald-brand font-mono"
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.accountNo || "No Account #"}) · GL Bal: {b.bookBalance} PKR
                  </option>
                ))}
              </select>
            </div>
          </div>

          {reconData?.statement && (
            <div className="text-right">
              <span className="text-xs text-ink-secondary block font-mono">Active Feed:</span>
              <span className="text-xs font-bold text-ink-primary font-mono">{reconData.statement.fileName}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reconciliation Metrics KPI Bar */}
      {reconData && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="border-border p-3">
            <span className="text-[10px] text-ink-secondary block font-mono uppercase">Bank Statement Bal</span>
            <span className="text-base font-bold font-mono text-ink-primary tabular-nums">
              {reconData.statementBalance} PKR
            </span>
          </Card>

          <Card className="border-border p-3">
            <span className="text-[10px] text-ink-secondary block font-mono uppercase">GL Book Balance</span>
            <span className="text-base font-bold font-mono text-ink-primary tabular-nums">
              {reconData.bookBalance} PKR
            </span>
          </Card>

          <Card className="border-border p-3">
            <span className="text-[10px] text-ink-secondary block font-mono uppercase">Uncleared Inflows</span>
            <span className="text-base font-bold font-mono text-emerald-700 tabular-nums">
              +{reconData.unclearedDeposits} PKR
            </span>
          </Card>

          <Card className="border-border p-3">
            <span className="text-[10px] text-ink-secondary block font-mono uppercase">Uncleared Outflows</span>
            <span className="text-base font-bold font-mono text-rose-700 tabular-nums">
              -{reconData.unclearedWithdrawals} PKR
            </span>
          </Card>

          <Card className={`p-3 border ${reconData.status === "RECONCILED" ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/40"}`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-ink-primary">Difference</span>
              {reconData.status === "RECONCILED" ? (
                <Badge className="bg-emerald-100 text-emerald-900 border-emerald-200 text-[10px]">RECONCILED</Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-900 border-amber-200 text-[10px]">UNRECONCILED</Badge>
              )}
            </div>
            <span className={`text-base font-bold font-mono tabular-nums ${reconData.status === "RECONCILED" ? "text-emerald-800" : "text-amber-800"}`}>
              {reconData.difference} PKR
            </span>
          </Card>
        </div>
      )}

      {/* Reconciliation Dual Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Bank Statement Lines */}
        <Card className="border-border">
          <CardHeader className="py-3 px-4 border-b border-border bg-canvas/40 flex flex-row items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-brand" />
              <CardTitle className="text-xs font-bold text-ink-primary">External Bank Statement Feed</CardTitle>
            </div>
            <span className="text-[10px] font-mono text-ink-secondary">
              {reconData?.statementLines.filter((l) => l.isReconciled).length || 0} / {reconData?.statementLines.length || 0} Cleared
            </span>
          </CardHeader>

          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-xs text-ink-secondary">Loading feed...</div>
            ) : !reconData?.statement ? (
              <div className="p-8 text-center text-xs text-ink-secondary">
                No bank statement uploaded yet. Click "Upload Bank CSV" above to import your bank feed.
              </div>
            ) : reconData.statementLines.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-secondary">Statement has no transactions.</div>
            ) : (
              reconData.statementLines.map((line) => {
                const amt = Number(line.amount);
                const isDeposit = amt > 0;
                const isSelected = selectedStmtLineId === line.id;

                return (
                  <div
                    key={line.id}
                    className={`p-3 text-xs transition-colors ${
                      isSelected
                        ? "bg-emerald-50/60 border-l-4 border-emerald-600"
                        : line.isReconciled
                        ? "bg-canvas/30"
                        : "hover:bg-canvas"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[11px] text-ink-secondary">
                        {new Date(line.date).toISOString().split("T")[0]}
                      </span>
                      <span className={`font-mono font-bold tabular-nums ${isDeposit ? "text-emerald-700" : "text-ink-primary"}`}>
                        {isDeposit ? `+${line.amount}` : line.amount} PKR
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="truncate pr-2">
                        <span className="font-medium text-ink-primary block truncate">{line.description}</span>
                        {line.reference && (
                          <span className="font-mono text-[10px] text-ink-secondary">Ref: {line.reference}</span>
                        )}
                      </div>

                      {line.isReconciled ? (
                        <div className="flex items-center space-x-1.5 flex-shrink-0">
                          <span className="inline-flex items-center text-[10px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                            Matched
                          </span>
                          <button
                            onClick={() => handleUnmatch(line.id)}
                            className="p-1 text-ink-secondary hover:text-rose-600 transition-colors"
                            title="Unmatch line"
                          >
                            <Unlink className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedStmtLineId(isSelected ? null : line.id)}
                          className="h-6 text-[10px] font-mono px-2"
                        >
                          {isSelected ? "Selected for Match" : "Select to Match"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Right Column: General Ledger Book Transactions */}
        <Card className="border-border">
          <CardHeader className="py-3 px-4 border-b border-border bg-canvas/40 flex flex-row items-center justify-between">
            <div className="flex items-center space-x-2">
              <Landmark className="h-4 w-4 text-emerald-brand" />
              <CardTitle className="text-xs font-bold text-ink-primary">General Ledger Bank Entries</CardTitle>
            </div>
            <span className="text-[10px] font-mono text-ink-secondary">
              {reconData?.unmatchedGlLines.length || 0} Uncleared Postings
            </span>
          </CardHeader>

          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-xs text-ink-secondary">Loading ledger entries...</div>
            ) : !reconData || reconData.unmatchedGlLines.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-secondary">
                All General Ledger transactions are cleared! No outstanding book items.
              </div>
            ) : (
              reconData.unmatchedGlLines.map((gl) => {
                const debit = Number(gl.debit);
                const isDeposit = debit > 0;
                const amt = isDeposit ? gl.debit : gl.credit;

                return (
                  <div key={gl.id} className="p-3 text-xs hover:bg-canvas transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-[11px] text-ink-secondary">
                          {new Date(gl.date).toISOString().split("T")[0]}
                        </span>
                        <span className="font-mono text-[10px] text-ink-secondary bg-surface px-1.5 py-0.5 rounded border border-border">
                          {gl.number}
                        </span>
                      </div>
                      <span className={`font-mono font-bold tabular-nums ${isDeposit ? "text-emerald-700" : "text-ink-primary"}`}>
                        {isDeposit ? `+${amt}` : `-${amt}`} PKR
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-medium text-ink-primary truncate pr-2">{gl.narration}</span>

                      {selectedStmtLineId ? (
                        <Button
                          size="sm"
                          onClick={() => handleManualMatch(gl.id)}
                          disabled={actionLoading}
                          className="h-6 text-[10px] font-mono px-2 bg-emerald-brand hover:bg-emerald-900 text-white"
                        >
                          <LinkIcon className="h-3 w-3 mr-1" />
                          Link Match
                        </Button>
                      ) : (
                        <span className="text-[10px] font-mono text-ink-secondary">Uncleared</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Upload Bank CSV Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-surface shadow-xl p-6">
            <h3 className="text-sm font-bold text-ink-primary mb-1">Upload Bank Statement (CSV)</h3>
            <p className="text-xs text-ink-secondary mb-4">
              Import electronic bank feeds. Under Master Rule 1.2, statement imports never create duplicate accounting journals.
            </p>

            <form onSubmit={handleImportStatement} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-ink-primary block mb-1">File Name</label>
                <Input
                  required
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink-primary block mb-1">
                  Expected Statement Ending Balance (Optional PKR)
                </label>
                <Input
                  placeholder="e.g. 150000.00"
                  value={closingBalance}
                  onChange={(e) => setClosingBalance(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink-primary block mb-1">
                  CSV Statement Content (Date, Description, Reference, Debit, Credit)
                </label>
                <textarea
                  required
                  rows={6}
                  placeholder={`Date,Description,Reference,Debit,Credit\n2026-05-10,Customer Remittance,WIRE-101,0.00,50000.00\n2026-05-12,Vendor Wire Transfer,TRF-902,15000.00,0.00`}
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  className="w-full rounded border border-border bg-surface p-2.5 text-xs font-mono text-ink-primary focus:outline-none focus:ring-1 focus:ring-emerald-brand"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUploadModal(false)}
                  disabled={actionLoading}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={actionLoading}
                  className="text-xs bg-emerald-brand hover:bg-emerald-900 text-white font-mono"
                >
                  {actionLoading ? "Parsing & Storing..." : "Process Bank Feed"}
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
