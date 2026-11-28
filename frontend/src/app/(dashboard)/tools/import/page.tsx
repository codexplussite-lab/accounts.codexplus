"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Database,
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Layers,
  Users,
  Package,
  RefreshCw,
  ShieldCheck,
  FileText
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";

type ImportType = "accounts" | "contacts" | "products";

const SAMPLE_TEMPLATES: Record<ImportType, { filename: string; headers: string[]; rows: string[][] }> = {
  accounts: {
    filename: "chart_of_accounts_template.csv",
    headers: ["code", "name", "type", "description"],
    rows: [
      ["1005", "Petty Cash Karachi Branch", "ASSET", "Karachi branch cash on hand"],
      ["5005", "Warehouse Rent Expense", "EXPENSE", "Monthly logistics hub lease"],
      ["4005", "Export Consulting Revenue", "INCOME", "Consultancy for offshore clients"]
    ]
  },
  contacts: {
    filename: "contacts_template.csv",
    headers: ["name", "type", "email", "phone", "ntn", "address", "creditLimit"],
    rows: [
      ["Metro Retail Group", "CUSTOMER", "billing@metro.pk", "+923001234567", "1234567-8", "Plot 42, Korangi Industrial Area, Karachi", "500000.00"],
      ["Apex Mills Supplier", "VENDOR", "sales@apexmills.com", "+924235558888", "9876543-2", "88 Industrial Estate, Multan Road, Lahore", "0.00"]
    ]
  },
  products: {
    filename: "products_inventory_template.csv",
    headers: ["name", "sku", "costPrice", "salePrice", "trackStock", "reorderLevel", "barcode", "openingStockQty"],
    rows: [
      ["Industrial Ball Bearings 6204", "BRG-6204", "450.00", "750.00", "true", "10.000", "896400088801", "50.000"],
      ["Synthetic Engine Lubricant 4L", "LUB-4L-SYN", "3200.00", "4800.00", "true", "5.000", "896400088802", "20.000"]
    ]
  }
};

export default function BulkImportStudioPage() {
  const [activeType, setActiveType] = useState<ImportType>("products");
  const [file, setFile] = useState<File | null>(null);
  const [rawCsvText, setRawCsvText] = useState<string>("");
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count?: number; message?: string } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const downloadSample = (type: ImportType) => {
    const t = SAMPLE_TEMPLATES[type];
    const csvContent = [
      t.headers.join(","),
      ...t.rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", t.filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCsvText = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      throw new Error("CSV file must contain a header row and at least one data row.");
    }

    // Simple robust CSV line parser respecting quotes
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === "," && !inQuotes) {
          result.push(cur.trim());
          cur = "";
        } else {
          cur += char;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const rawHeaders = parseLine(lines[0]);
    const headers = rawHeaders.map((h) => h.replace(/^["']|["']$/g, "").trim());

    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length === 1 && values[0] === "") continue;
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx] || "";
      });
      rows.push(obj);
    }
    return rows;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResult(null);
    setParseError(null);
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        setRawCsvText(text);
        const rows = parseCsvText(text);
        setParsedRows(rows);
      } catch (err: any) {
        setParseError(err?.message || "Failed to parse CSV file");
        setParsedRows([]);
      }
    };
    reader.onerror = () => {
      setParseError("Could not read uploaded file");
      setParsedRows([]);
    };
    reader.readAsText(selectedFile);
  };

  const executeImport = async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);
    setResult(null);

    try {
      const endpoint =
        activeType === "accounts"
          ? "/import/accounts"
          : activeType === "contacts"
          ? "/import/contacts"
          : "/import/products";

      const payload = { csvContent: rawCsvText, rows: parsedRows };
      const res = await apiClient<{ importedCount: number; message: string }>(endpoint, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setResult({
        success: true,
        count: res.data.importedCount,
        message: res.data.message || `Successfully imported ${res.data.importedCount} records.`
      });
      setParsedRows([]);
      setFile(null);
    } catch (err: any) {
      setResult({
        success: false,
        message: err?.message || "Import execution encountered an error."
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-semibold tracking-tight text-ink-primary">
                CSV Data Import
              </h1>
              <span className="font-mono text-[11px] text-ink-secondary">
                Bulk onboarding
              </span>
            </div>
            <p className="text-xs text-ink-secondary mt-1">
              Import Chart of Accounts, contacts, and products with opening stock journals
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadSample(activeType)}
            className="text-xs font-mono h-8"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-brand" />
            Download Sample CSV
          </Button>
        </div>

        {/* Import Type Selector Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => {
              setActiveType("products");
              setFile(null);
              setParsedRows([]);
              setResult(null);
            }}
            className={`p-4 rounded-lg border text-left transition-all ${
              activeType === "products"
                ? "bg-surface border-emerald-brand shadow-subtle ring-1 ring-emerald-brand"
                : "bg-surface/50 border-border hover:border-zinc-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-xs text-ink-primary flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-brand" /> Products & Inventory
              </span>
              <Badge variant="outline" className="text-[10px] font-mono">
                With Opening Stock
              </Badge>
            </div>
            <p className="text-[11px] text-ink-secondary">
              Import SKUs, barcodes, cost/sale prices, and automatically create Dr Inventory / Cr Capital opening entries.
            </p>
          </button>

          <button
            onClick={() => {
              setActiveType("contacts");
              setFile(null);
              setParsedRows([]);
              setResult(null);
            }}
            className={`p-4 rounded-lg border text-left transition-all ${
              activeType === "contacts"
                ? "bg-surface border-emerald-brand shadow-subtle ring-1 ring-emerald-brand"
                : "bg-surface/50 border-border hover:border-zinc-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-xs text-ink-primary flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" /> Customers & Vendors
              </span>
              <Badge variant="outline" className="text-[10px] font-mono">
                CRM Contacts
              </Badge>
            </div>
            <p className="text-[11px] text-ink-secondary">
              Import customer and vendor directories with NTN, phone numbers, addresses, and credit limits.
            </p>
          </button>

          <button
            onClick={() => {
              setActiveType("accounts");
              setFile(null);
              setParsedRows([]);
              setResult(null);
            }}
            className={`p-4 rounded-lg border text-left transition-all ${
              activeType === "accounts"
                ? "bg-surface border-emerald-brand shadow-subtle ring-1 ring-emerald-brand"
                : "bg-surface/50 border-border hover:border-zinc-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-xs text-ink-primary flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-600" /> Chart of Accounts
              </span>
              <Badge variant="outline" className="text-[10px] font-mono">
                General Ledger
              </Badge>
            </div>
            <p className="text-[11px] text-ink-secondary">
              Bulk import new asset, liability, equity, revenue, and expense accounts with unique 4-digit codes.
            </p>
          </button>
        </div>

        {/* Result Message */}
        {result && (
          <div
            className={`p-4 rounded-lg border text-xs flex items-center justify-between ${
              result.success
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-center space-x-2.5">
              {result.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              )}
              <span className="font-medium">{result.message}</span>
            </div>
            {result.success && (
              <Link href={activeType === "products" ? "/inventory" : activeType === "contacts" ? "/contacts" : "/accounts"}>
                <Button size="sm" variant="outline" className="text-xs h-7 bg-white">
                  View Imported Records <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            )}
          </div>
        )}

        {/* Upload Dropzone */}
        <Card className="border-border shadow-subtle">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-emerald-brand" /> Upload {activeType.toUpperCase()} CSV File
            </CardTitle>
            <CardDescription className="text-xs text-ink-secondary">
              Select or drop a standard comma-separated (.csv) file formatted according to the schema specifications.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-canvas/40 hover:bg-canvas transition-colors relative">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <FileSpreadsheet className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-ink-primary">
                {file ? file.name : "Click or drag CSV file to this zone"}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                {file
                  ? `${(file.size / 1024).toFixed(1)} KB · ${parsedRows.length} rows ready for preview`
                  : "Standard CSV format (UTF-8 encoding recommended)"}
              </p>
            </div>

            {parseError && (
              <div className="mt-3 p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview Table & Commit Action */}
        {parsedRows.length > 0 && (
          <Card className="border-border shadow-subtle">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    Preview Data: {parsedRows.length} Rows Detected
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Inspect parsed columns before executing permanent atomic database insert.
                  </CardDescription>
                </div>
                <Button
                  onClick={executeImport}
                  disabled={importing}
                  className="bg-emerald-brand hover:bg-emerald-900 text-white text-xs h-8"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Importing...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Commit Import
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-canvas border-b border-border text-[11px] text-ink-secondary font-mono sticky top-0">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      {Object.keys(parsedRows[0]).map((col) => (
                        <th key={col} className="py-2 px-3 font-semibold uppercase">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-canvas/50">
                        <td className="py-2 px-3 font-mono text-[10px] text-zinc-400">{idx + 1}</td>
                        {Object.values(row).map((val, cellIdx) => (
                          <td key={cellIdx} className="py-2 px-3 font-mono text-ink-primary whitespace-nowrap">
                            {val || <span className="text-zinc-300">-</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
