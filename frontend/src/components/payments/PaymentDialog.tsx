"use client";

import React, { useState, useEffect } from "react";
import { X, DollarSign, Calendar, CreditCard, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api";

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  type: "RECEIVED" | "MADE";
  documentId: string;
  documentNumber: string;
  contactId: string;
  contactName: string;
  total: string;
  balanceDue: string;
}

export function PaymentDialog({
  isOpen,
  onClose,
  onSuccess,
  type,
  documentId,
  documentNumber,
  contactId,
  contactName,
  total,
  balanceDue
}: PaymentDialogProps) {
  const [amount, setAmount] = useState(balanceDue);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("Bank Transfer");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAmount(balanceDue);
  }, [balanceDue]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await apiClient("/payments", {
        method: "POST",
        body: JSON.stringify({
          type,
          contactId,
          invoiceId: type === "RECEIVED" ? documentId : undefined,
          billId: type === "MADE" ? documentId : undefined,
          amount,
          date,
          method,
          reference: reference || null
        })
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to process payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-lg border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-canvas">
          <div className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-emerald-700" />
            <h3 className="font-semibold text-sm text-ink-primary">
              {type === "RECEIVED" ? "Record Customer Payment" : "Disburse Vendor Payment"}
            </h3>
          </div>
          <button onClick={onClose} className="text-ink-secondary hover:text-ink-primary">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs bg-rose-50 text-rose-800 border border-rose-200 rounded">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-canvas border border-border rounded p-3 space-y-1">
            <div className="flex justify-between text-xs text-ink-secondary">
              <span>{type === "RECEIVED" ? "Customer" : "Vendor"}:</span>
              <span className="font-semibold text-ink-primary">{contactName}</span>
            </div>
            <div className="flex justify-between text-xs text-ink-secondary">
              <span>Document Ref:</span>
              <span className="font-mono text-ink-primary">{documentNumber}</span>
            </div>
            <div className="flex justify-between text-xs text-ink-secondary">
              <span>Remaining Balance:</span>
              <span className="font-mono font-bold text-rose-700 tabular-nums">PKR {balanceDue}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-secondary">Payment Amount (PKR)</label>
            <Input
              type="number"
              step="0.01"
              max={balanceDue}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="font-mono tabular-nums text-sm font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-secondary">Payment Date</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-secondary">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full h-9 px-2.5 text-xs bg-white border border-border rounded focus:outline-none focus:ring-1 focus:ring-ink-primary"
              >
                <option value="Cash">Cash on Hand</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Online">Online Gateway</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-secondary">Reference / Cheque #</label>
            <Input
              placeholder="e.g. TXN-998822 or Cheque # 401"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="bg-emerald-800 hover:bg-emerald-900 text-white" disabled={loading}>
              {loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Confirm Payment
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
