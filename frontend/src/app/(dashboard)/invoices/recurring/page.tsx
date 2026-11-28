"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  XCircle,
  ArrowLeft,
  FileText,
  User,
  Layers,
  ShieldCheck,
  ChevronRight
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface RecurringProfile {
  id: string;
  contactId: string;
  frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
  interval?: number;
  startDate: string;
  endDate?: string | null;
  nextRunDate: string;
  isActive: boolean;
  status?: "ACTIVE" | "PAUSED" | "COMPLETED";
  totalOccurrences?: number;
  contact?: {
    id: string;
    name: string;
    email?: string;
  };
  items: any[];
}

export default function RecurringInvoicesPage() {
  const { status, activeCompany } = useAuth();
  const [profiles, setProfiles] = useState<RecurringProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Form state
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [frequency, setFrequency] = useState<"WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY">("MONTHLY");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [itemDescription, setItemDescription] = useState("Monthly Software Maintenance Retainer");
  const [itemAmount, setItemAmount] = useState("25000.00");

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const res = await apiClient<RecurringProfile[]>("/recurring");
      setProfiles(res.data);
    } catch (err: any) {
      console.error("Error fetching profiles:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await apiClient<any[]>("/contacts?type=CUSTOMER");
      setContacts(res.data);
      if (res.data.length > 0 && !selectedContactId) {
        setSelectedContactId(res.data[0].id);
      }
    } catch (err) {
      console.error("Error fetching contacts:", err);
    }
  };

  useEffect(() => {
    if (status === "AUTHENTICATED") {
      fetchProfiles();
      fetchContacts();
    }
  }, [status, activeCompany?.id]);

  const handleGenerateDue = async () => {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await apiClient<{ generatedCount: number; invoices: any[] }>("/recurring/generate", {
        method: "POST"
      });
      setMessage({
        text: `Batch billing processed: ${res.data.generatedCount} invoice(s) generated successfully.`,
        type: "success"
      });
      fetchProfiles();
    } catch (err: any) {
      setMessage({
        text: err?.message || "Failed to execute recurring generation cycle.",
        type: "error"
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusChange = async (id: string, status: "ACTIVE" | "PAUSED" | "COMPLETED") => {
    try {
      await apiClient(`/recurring/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: status === "ACTIVE" })
      });
      fetchProfiles();
    } catch (err: any) {
      alert(err?.message || "Failed to update profile status");
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId) {
      alert("Please select a customer.");
      return;
    }

    try {
      await apiClient("/recurring", {
        method: "POST",
        body: JSON.stringify({
          contactId: selectedContactId,
          frequency,
          interval: 1,
          startDate,
          items: [
            {
              description: itemDescription,
              quantity: "1.000",
              unitPrice: itemAmount,
              discount: "0.00"
            }
          ]
        })
      });

      setShowCreateModal(false);
      setMessage({ text: "Recurring billing profile created successfully.", type: "success" });
      fetchProfiles();
    } catch (err: any) {
      alert(err?.message || "Failed to create recurring profile");
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <Link href="/invoices" className="text-ink-secondary hover:text-ink-primary transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h1 className="text-xl font-semibold tracking-tight text-ink-primary">
                Recurring Invoices
              </h1>
              <span className="font-mono text-[11px] text-ink-secondary">
                Scheduled billing
              </span>
            </div>
            <p className="text-xs text-ink-secondary mt-1">
              Scheduled client invoicing with sequential document numbering
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateDue}
              disabled={generating}
              className="text-xs font-mono h-8"
            >
              <Play className={`w-3.5 h-3.5 mr-1.5 text-emerald-brand ${generating ? "animate-spin" : ""}`} />
              Run Generation Cycle
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="bg-emerald-brand hover:bg-emerald-900 text-white text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New Profile
            </Button>
          </div>
        </div>

        {/* Feedback Alert */}
        {message && (
          <div
            className={`p-3.5 rounded-lg border text-xs flex items-center justify-between ${
              message.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-center space-x-2">
              {message.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
            <button onClick={() => setMessage(null)} className="text-xs font-mono underline ml-4">
              Dismiss
            </button>
          </div>
        )}

        {/* Profiles Table */}
        <Card className="border-border shadow-subtle">
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Active Invoicing Schedules</CardTitle>
                <CardDescription className="text-xs">
                  Profiles automatically generate drafts or posted invoices when next run date arrives.
                </CardDescription>
              </div>
              <span className="font-mono text-xs text-ink-secondary">
                {profiles.length} schedule(s) configured
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-canvas border-b border-border text-[11px] text-ink-secondary font-mono">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Customer</th>
                    <th className="py-2.5 px-4 font-medium">Frequency</th>
                    <th className="py-2.5 px-4 font-medium">Next Run Date</th>
                    <th className="py-2.5 px-4 font-medium text-center">Occurrences</th>
                    <th className="py-2.5 px-4 font-medium text-center">Status</th>
                    <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-ink-secondary text-xs">
                        Loading recurring billing schedules...
                      </td>
                    </tr>
                  ) : profiles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-ink-secondary text-xs">
                        No recurring invoice profiles found. Click "New Profile" to schedule automated invoicing.
                      </td>
                    </tr>
                  ) : (
                    profiles.map((p) => (
                      <tr key={p.id} className="hover:bg-canvas/50 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-ink-primary">{p.contact?.name || "Customer"}</p>
                          <p className="text-[10px] text-ink-secondary font-mono">{p.contact?.email || "-"}</p>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {p.frequency}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-ink-primary">
                          {new Date(p.nextRunDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-center font-mono tabular-nums font-semibold">
                          {p.totalOccurrences ?? 0}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge
                            variant={
                              p.isActive
                                ? "paid"
                                : "partially_paid"
                            }
                          >
                            {p.isActive ? "ACTIVE" : "PAUSED"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5">
                          {p.isActive ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStatusChange(p.id, "PAUSED")}
                              className="text-[10px] h-7 px-2"
                              title="Pause recurring schedule"
                            >
                              <Pause className="w-3 h-3 text-amber-600 mr-1" /> Pause
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStatusChange(p.id, "ACTIVE")}
                              className="text-[10px] h-7 px-2"
                              title="Resume recurring schedule"
                            >
                              <Play className="w-3 h-3 text-emerald-brand mr-1" /> Resume
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(p.id, "COMPLETED")}
                            className="text-[10px] h-7 px-2 text-rose-600 hover:text-rose-700"
                            title="Cancel recurring schedule"
                          >
                            <XCircle className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Create Profile Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-lg shadow-elevated w-full max-w-lg p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-semibold text-sm text-ink-primary">Create Recurring Billing Profile</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-ink-secondary hover:text-ink-primary text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateProfile} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-ink-primary block mb-1">Customer</label>
                  <select
                    value={selectedContactId}
                    onChange={(e) => setSelectedContactId(e.target.value)}
                    className="w-full text-xs h-9 px-3 rounded-md border border-border bg-canvas focus:outline-none focus:ring-1 focus:ring-emerald-brand"
                    required
                  >
                    <option value="">Select customer...</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.email ? `(${c.email})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-ink-primary block mb-1">Frequency</label>
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as any)}
                      className="w-full text-xs h-9 px-3 rounded-md border border-border bg-canvas focus:outline-none focus:ring-1 focus:ring-emerald-brand"
                    >
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="QUARTERLY">Quarterly</option>
                      <option value="YEARLY">Yearly (Annual)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-ink-primary block mb-1">Start Date</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="text-xs h-9"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-ink-primary block mb-1">Line Item Description</label>
                  <Input
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    placeholder="e.g. Monthly Software Maintenance Retainer"
                    className="text-xs h-9"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-ink-primary block mb-1">Recurring Amount (PKR)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={itemAmount}
                    onChange={(e) => setItemAmount(e.target.value)}
                    className="text-xs h-9 font-mono"
                    required
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateModal(false)}
                    className="text-xs h-8"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-emerald-brand hover:bg-emerald-900 text-white text-xs h-8"
                  >
                    Save & Activate Schedule
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
