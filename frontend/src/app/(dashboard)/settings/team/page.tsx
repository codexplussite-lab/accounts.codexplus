"use client";

import React, { useState, useEffect } from "react";
import {
  UserCheck,
  UserPlus,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Mail,
  User,
  Trash2,
  Lock
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/layout/AppShell";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type RoleType = "OWNER" | "ACCOUNTANT" | "CASHIER" | "AUDITOR";

interface Member {
  userId: string;
  companyId: string;
  role: RoleType;
  user: {
    id: string;
    email: string;
    name: string;
    isActive: boolean;
    createdAt: string;
  };
}

export default function TeamManagementPage() {
  const { status, activeCompany } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Invite Form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleType>("ACCOUNTANT");
  const [initialPassword, setInitialPassword] = useState("");

  const fetchMembers = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient<Member[]>("users");
      setMembers(res.data || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load team members.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "AUTHENTICATED") {
      fetchMembers();
    }
  }, [status, activeCompany?.id]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await apiClient("users/invite", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          role,
          initialPassword: initialPassword || undefined
        })
      });
      setShowInviteModal(false);
      setName("");
      setEmail("");
      setInitialPassword("");
      setSuccessMsg(`Team member '${email}' invited successfully as ${role}.`);
      await fetchMembers();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to invite member.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: RoleType) => {
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await apiClient(`users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role: newRole })
      });
      setSuccessMsg("Role updated successfully.");
      await fetchMembers();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update member role.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this company?`)) {
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    try {
      await apiClient(`users/${userId}`, { method: "DELETE" });
      setSuccessMsg(`Member ${memberName} removed.`);
      await fetchMembers();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to remove member.");
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleBadge = (r: RoleType) => {
    switch (r) {
      case "OWNER":
        return <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-mono font-bold">OWNER</Badge>;
      case "ACCOUNTANT":
        return <Badge className="bg-slate-100 text-slate-800 border-slate-200 font-mono">ACCOUNTANT</Badge>;
      case "CASHIER":
        return <Badge className="bg-amber-50 text-amber-800 border-amber-200 font-mono">CASHIER</Badge>;
      case "AUDITOR":
        return <Badge className="bg-zinc-100 text-zinc-700 border-zinc-200 font-mono">AUDITOR</Badge>;
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-semibold tracking-tight text-ink-primary">Team & Roles</h1>
            <span className="font-mono text-[11px] text-ink-secondary">
              Access control
            </span>
          </div>
          <p className="text-xs text-ink-secondary mt-1">
            Manage company memberships and role permissions across Owner, Accountant, Cashier, and Auditor
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={fetchMembers} disabled={loading} className="text-xs">
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setShowInviteModal(true)}
            className="text-xs bg-emerald-brand hover:bg-emerald-900 text-white font-mono"
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Invite Member
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

      {/* RBAC Permission Matrix Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="border-border p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-xs font-bold text-emerald-800">OWNER</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-[11px] text-ink-secondary leading-snug">
            Full administrative authority. Manages team, closes/reopens fiscal periods, and modifies period locks.
          </p>
        </Card>

        <Card className="border-border p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-xs font-bold text-slate-800">ACCOUNTANT</span>
            <ShieldCheck className="h-4 w-4 text-slate-600" />
          </div>
          <p className="text-[11px] text-ink-secondary leading-snug">
            Operational accounting. Creates & posts journals, bills, invoices, inventory movements, and views all reports.
          </p>
        </Card>

        <Card className="border-border p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-xs font-bold text-amber-800">CASHIER</span>
            <ShieldCheck className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-[11px] text-ink-secondary leading-snug">
            Sales & receipts only. Creates invoices and records customer payments. Blocked from journals & settings.
          </p>
        </Card>

        <Card className="border-border p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-xs font-bold text-zinc-700">AUDITOR</span>
            <Lock className="h-4 w-4 text-zinc-600" />
          </div>
          <p className="text-[11px] text-ink-secondary leading-snug">
            Strictly read-only. Inspects financial reports, ledger lines, and the immutable audit trail. Cannot mutate data.
          </p>
        </Card>
      </div>

      {/* Team Member Directory Table */}
      <Card className="border-border">
        <CardHeader className="py-3 px-4 border-b border-border bg-canvas/40 flex flex-row items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserCheck className="h-4 w-4 text-emerald-brand" />
            <CardTitle className="text-xs font-bold text-ink-primary">Verified Company Memberships</CardTitle>
          </div>
          <span className="text-xs font-mono text-ink-secondary">{members.length} Active Users</span>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas border-b border-border text-ink-secondary uppercase tracking-wider text-[10px] font-mono">
              <tr>
                <th className="py-2.5 px-4">Member</th>
                <th className="py-2.5 px-4">Email</th>
                <th className="py-2.5 px-4">Assigned Role</th>
                <th className="py-2.5 px-4">Account Status</th>
                <th className="py-2.5 px-4">Joined</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-secondary">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-ink-secondary" />
                    Loading team members...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-secondary">
                    No team members found.
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.userId} className="hover:bg-canvas transition-colors">
                    <td className="py-3 px-4 font-semibold text-ink-primary">
                      <div className="flex items-center space-x-2">
                        <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-ink-secondary font-mono">
                          {m.user?.name ? m.user.name.substring(0, 2).toUpperCase() : "U"}
                        </div>
                        <span>{m.user?.name || "Unnamed User"}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-ink-secondary text-[11px]">{m.user?.email}</td>
                    <td className="py-3 px-4">{getRoleBadge(m.role)}</td>
                    <td className="py-3 px-4">
                      {m.user?.isActive ? (
                        <span className="inline-flex items-center text-[11px] text-emerald-800">
                          <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[11px] text-rose-800">
                          <AlertTriangle className="h-3 w-3 mr-1 text-rose-600" />
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-ink-secondary text-[11px] tabular-nums">
                      {m.user?.createdAt ? new Date(m.user.createdAt).toISOString().split("T")[0] : "—"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <select
                          value={m.role}
                          onChange={(e) => handleUpdateRole(m.userId, e.target.value as RoleType)}
                          disabled={actionLoading}
                          className="h-7 rounded border border-border bg-surface px-2 text-[11px] font-mono text-ink-primary focus:outline-none focus:ring-1 focus:ring-emerald-brand"
                        >
                          <option value="OWNER">OWNER</option>
                          <option value="ACCOUNTANT">ACCOUNTANT</option>
                          <option value="CASHIER">CASHIER</option>
                          <option value="AUDITOR">AUDITOR</option>
                        </select>

                        <button
                          onClick={() => handleRemoveMember(m.userId, m.user?.name || m.user?.email || "Member")}
                          disabled={actionLoading}
                          className="p-1 text-ink-secondary hover:text-rose-600 transition-colors"
                          title="Remove member"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface shadow-xl p-6">
            <h3 className="text-sm font-bold text-ink-primary mb-1">Invite Team Member</h3>
            <p className="text-xs text-ink-secondary mb-4">
              Add a user to this company workspace. Permissions are enforced based on the selected role.
            </p>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-ink-primary block mb-1">Full Name</label>
                <Input
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink-primary block mb-1">Email Address</label>
                <Input
                  required
                  type="email"
                  placeholder="s.jenkins@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink-primary block mb-1">Assigned Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as RoleType)}
                  className="w-full h-9 rounded border border-border bg-surface px-3 text-xs font-mono text-ink-primary focus:outline-none focus:ring-1 focus:ring-emerald-brand"
                >
                  <option value="ACCOUNTANT">ACCOUNTANT (Full accounting, bills, inventory)</option>
                  <option value="CASHIER">CASHIER (Invoicing and payments only)</option>
                  <option value="AUDITOR">AUDITOR (Read-only reports and audit trail)</option>
                  <option value="OWNER">OWNER (Full administrator & fiscal settings)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-ink-primary block mb-1">
                  Initial Password (Optional)
                </label>
                <Input
                  type="password"
                  placeholder="Leave blank for default 'ChangeMe2026!'"
                  value={initialPassword}
                  onChange={(e) => setInitialPassword(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInviteModal(false)}
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
                  {actionLoading ? "Inviting..." : "Send Invitation"}
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
