"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, User, Mail, Lock, ShieldCheck, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [currency, setCurrency] = useState("PKR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await register({
        name,
        email,
        password,
        companyName,
        currency
      });
    } catch (err: any) {
      setError(err.message || "Registration failed. Please check your details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="w-10 h-10 rounded bg-ink-primary flex items-center justify-center text-white font-mono font-bold text-base shadow-subtle">
            ERP
          </div>
          <h1 className="text-xl font-bold tracking-tight text-ink-primary">Set Up Enterprise Accounting</h1>
          <p className="text-xs text-ink-secondary">Creates your company, default chart of accounts, and Owner account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Register Company & Owner</CardTitle>
            <CardDescription>
              Automatic provisioning of 15 default ledger accounts and Main Warehouse
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-ink-secondary uppercase tracking-wider">
                    Full Name
                  </label>
                  <Input
                    required
                    placeholder="Alice Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-ink-secondary uppercase tracking-wider">
                    Base Currency
                  </label>
                  <select
                    className="flex h-8 w-full rounded border border-border bg-surface px-3 py-1 text-xs text-ink-primary shadow-subtle focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink-primary"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="PKR">PKR (Pakistani Rupee)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="AED">AED (UAE Dirham)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="GBP">GBP (British Pound)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-ink-secondary uppercase tracking-wider">
                  Company Name
                </label>
                <div className="relative">
                  <Input
                    required
                    placeholder="Acme Industrial Corp"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="pl-8"
                  />
                  <Building2 className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-ink-secondary uppercase tracking-wider">
                  Work Email
                </label>
                <div className="relative">
                  <Input
                    type="email"
                    required
                    placeholder="owner@acme.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-8"
                  />
                  <Mail className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-ink-secondary uppercase tracking-wider">
                  Password (min 8 chars)
                </label>
                <div className="relative">
                  <Input
                    type="password"
                    required
                    minLength={8}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-8"
                  />
                  <Lock className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-2.5" />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full mt-3" variant="emerald">
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Provisioning Ledger...
                  </>
                ) : (
                  <>
                    Initialize Company Ledger
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center border-t border-border/60">
            <p className="text-xs text-ink-secondary">
              Already have an enterprise account?{" "}
              <Link href="/login" className="text-emerald-brand font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

