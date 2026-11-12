"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, Mail, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { apiClient } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiClient<{ user: any; companies: any[]; accessToken: string }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password })
        }
      );

      // Save token in memory/localStorage for API requests
      if (typeof window !== "undefined") {
        localStorage.setItem("accessToken", res.data.accessToken);
        if (res.data.companies && res.data.companies.length > 0) {
          localStorage.setItem("activeCompanyId", res.data.companies[0].id);
        }
      }

      router.push("/");
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please verify your email and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="w-10 h-10 rounded bg-ink-primary flex items-center justify-center text-white font-mono font-bold text-base shadow-subtle">
            ERP
          </div>
          <h1 className="text-xl font-bold tracking-tight text-ink-primary">Acme Enterprise Suite</h1>
          <p className="text-xs text-ink-secondary">Double-Entry Accounting & Inventory ERP</p>
        </div>

        {/* Login Card */}
        <Card>
          <CardHeader>
            <CardTitle>Sign in to your ledger</CardTitle>
            <CardDescription>Enter your enterprise credentials to access company books</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-ink-secondary uppercase tracking-wider">
                  Work Email
                </label>
                <div className="relative">
                  <Input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-8"
                  />
                  <Mail className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-ink-secondary uppercase tracking-wider">
                    Password
                  </label>
                  <a href="#" className="text-[11px] text-emerald-brand hover:underline">
                    Forgot?
                  </a>
                </div>
                <div className="relative">
                  <Input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-8"
                  />
                  <Lock className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-2.5" />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full mt-2" variant="default">
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    Sign In to Workspace
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center border-t border-border/60">
            <p className="text-xs text-ink-secondary">
              Don&apos;t have an enterprise account?{" "}
              <Link href="/register" className="text-emerald-brand font-medium hover:underline">
                Register new company
              </Link>
            </p>
          </CardFooter>
        </Card>

        {/* Security badge */}
        <div className="flex items-center justify-center space-x-1.5 text-[11px] text-ink-secondary">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-brand" />
          <span>Multi-tenant isolation & end-to-end audit logging</span>
        </div>
      </div>
    </div>
  );
}

