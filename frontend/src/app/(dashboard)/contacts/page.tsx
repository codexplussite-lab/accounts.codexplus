"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Users, Search, Plus, Filter, Loader2, ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle, Phone, Mail, Building } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface Contact {
  id: string;
  name: string;
  type: "CUSTOMER" | "VENDOR" | "BOTH";
  phone: string | null;
  email: string | null;
  ntn: string | null;
  address: string | null;
  openingBalance: string;
  balances: {
    receivable: string;
    payable: string;
    netBalance: string;
  };
  isActive: boolean;
}

export default function ContactsPage() {
  const { status, activeCompany } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  // New Contact form state
  const [name, setName] = useState("");
  const [type, setType] = useState<"CUSTOMER" | "VENDOR" | "BOTH">("CUSTOMER");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [ntn, setNtn] = useState("");
  const [address, setAddress] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0.00");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchContacts = async () => {
    if (status !== "AUTHENTICATED") return;
    setLoading(true);

    try {
      const res = await apiClient<Contact[]>("/contacts", {
        params: {
          type: activeTab === "ALL" ? undefined : activeTab,
          search: search || undefined
        }
      });
      setContacts(res.data);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "AUTHENTICATED") {
      fetchContacts();
    }
  }, [status, activeCompany?.id, activeTab, search]);

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFormError(null);

    try {
      await apiClient("/contacts", {
        method: "POST",
        body: JSON.stringify({
          name,
          type,
          phone: phone || null,
          email: email || null,
          ntn: ntn || null,
          address: address || null,
          openingBalance: openingBalance || "0.00"
        })
      });

      setShowModal(false);
      setName("");
      setPhone("");
      setEmail("");
      setNtn("");
      setAddress("");
      setOpeningBalance("0.00");
      fetchContacts();
    } catch (err: any) {
      setFormError(err.message || "Failed to create contact");
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center space-x-2.5">
              <Users className="h-4 w-4 text-ink-secondary stroke-[1.5]" />
              <h1 className="text-xl font-semibold tracking-tight text-ink-primary">Contacts Directory</h1>
            </div>
            <p className="mt-1 text-xs text-ink-secondary">
              Customers, vendors, and live double-entry ledger balances
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button variant="outline" size="sm" onClick={fetchContacts} disabled={loading} className="h-8 text-xs">
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowModal(true)} className="h-8 text-xs bg-emerald-800 hover:bg-emerald-900 text-white">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Contact
            </Button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-3 rounded border border-border">
          <div className="flex items-center space-x-1.5 w-full sm:w-auto">
            {["ALL", "CUSTOMER", "VENDOR", "BOTH"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  activeTab === tab
                    ? "bg-ink-primary text-white"
                    : "text-ink-secondary hover:text-ink-primary hover:bg-canvas"
                }`}
              >
                {tab === "ALL" ? "All Contacts" : tab === "CUSTOMER" ? "Customers" : tab === "VENDOR" ? "Vendors" : "Both"}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-secondary" />
            <Input
              placeholder="Search by name, NTN, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-white"
            />
          </div>
        </div>

        {/* Contacts Table */}
        <div className="rounded border border-border bg-white overflow-hidden shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas border-b border-border text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Contact Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">NTN / Tax ID</th>
                  <th className="py-2.5 px-3">Phone & Email</th>
                  <th className="py-2.5 px-4 text-right">Ledger Balance</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-ink-secondary">
                      <Loader2 className="w-5 h-5 mx-auto animate-spin mb-2" />
                      Loading contacts...
                    </td>
                  </tr>
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-ink-secondary">
                      No contacts found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  contacts.map((c) => {
                    const isCustomer = c.type === "CUSTOMER" || c.type === "BOTH";
                    const isVendor = c.type === "VENDOR";
                    const balance = isCustomer ? c.balances.receivable : c.balances.payable;
                    const isPositive = parseFloat(balance) > 0;

                    return (
                      <tr key={c.id} className="hover:bg-canvas/60 transition-colors">
                        <td className="py-3 px-4">
                          <Link href={`/contacts/${c.id}`} className="font-semibold text-ink-primary hover:text-emerald-800 transition-colors">
                            {c.name}
                          </Link>
                          {c.address && <p className="text-[11px] text-ink-secondary truncate max-w-xs">{c.address}</p>}
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            variant="outline"
                            className={
                              c.type === "CUSTOMER"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : c.type === "VENDOR"
                                ? "bg-blue-50 text-blue-800 border-blue-200"
                                : "bg-purple-50 text-purple-800 border-purple-200"
                            }
                          >
                            {c.type}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 font-mono text-ink-secondary">
                          {c.ntn || "—"}
                        </td>
                        <td className="py-3 px-3 text-ink-secondary space-y-0.5">
                          {c.phone && <div className="text-[11px]">{c.phone}</div>}
                          {c.email && <div className="text-[11px] text-ink-secondary">{c.email}</div>}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          <div className={`font-semibold ${isPositive ? (isCustomer ? "text-emerald-800" : "text-amber-800") : "text-ink-secondary"}`}>
                            PKR {balance}
                          </div>
                          <span className="text-[10px] text-ink-secondary">
                            {isCustomer ? "Receivable" : "Payable"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link href={`/contacts/${c.id}`}>
                            <Button variant="outline" size="sm" className="h-7 text-[11px]">
                              View Ledger
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* New Contact Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white rounded-lg border border-border shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-bold text-sm text-ink-primary">Add New Contact</h3>
                <button onClick={() => setShowModal(false)} className="text-ink-secondary hover:text-ink-primary text-xs">
                  ✕
                </button>
              </div>

              {formError && (
                <div className="flex items-center gap-2 p-3 text-xs bg-rose-50 text-rose-800 border border-rose-200 rounded">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateContact} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink-secondary">Full Name / Business Title *</label>
                  <Input placeholder="e.g. Acme Corp or John Doe" value={name} onChange={(e) => setName(e.target.value)} required className="text-xs" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink-secondary">Contact Type *</label>
                  <select
                    value={type}
                    onChange={(e: any) => setType(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs bg-white border border-border rounded focus:outline-none focus:ring-1 focus:ring-ink-primary"
                  >
                    <option value="CUSTOMER">Customer (Receivables)</option>
                    <option value="VENDOR">Vendor (Payables)</option>
                    <option value="BOTH">Both (Customer & Vendor)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink-secondary">Phone Number</label>
                    <Input placeholder="+92 300 0000000" value={phone} onChange={(e) => setPhone(e.target.value)} className="text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink-secondary">Email Address</label>
                    <Input type="email" placeholder="billing@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} className="text-xs" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink-secondary">NTN / Tax Registration</label>
                    <Input placeholder="e.g. 1234567-8" value={ntn} onChange={(e) => setNtn(e.target.value)} className="text-xs font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-ink-secondary">Opening Balance (PKR)</label>
                    <Input placeholder="0.00" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className="text-xs font-mono tabular-nums" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink-secondary">Office / Billing Address</label>
                  <Input placeholder="Street, City, Postal Code" value={address} onChange={(e) => setAddress(e.target.value)} className="text-xs" />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowModal(false)} disabled={creating}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-emerald-800 hover:bg-emerald-900 text-white" disabled={creating}>
                    {creating && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                    Save Contact
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
