"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Case, CaseImportInput } from "@/types";
import { useAuthenticatedFetch } from "@/hooks/useAuthenticatedFetch";

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (inQuotes) {
      current += c;
    } else if (c === ",") {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSVToCases(text: string): CaseImportInput[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map((h) => h.trim());
  const rows: CaseImportInput[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = values[j] ?? "";
    });
    const emails = [1, 2, 3, 4, 5, 6]
      .map((n) => row[`email${n}`]?.trim())
      .filter(Boolean);
    const input: CaseImportInput = {
      clientFirstName: row.clientFirstName?.trim() ?? "",
      clientLastName: row.clientLastName?.trim() ?? "",
      defendantName: row.defendantName?.trim() || undefined,
      defendantFirstName: row.defendantFirstName?.trim() || undefined,
      defendantLastName: row.defendantLastName?.trim() || undefined,
      caseNumber: row.caseNumber?.trim() ?? "",
      caseId: row.caseId?.trim() || undefined,
      defenseCounsel: row.defenseCounsel?.trim() || undefined,
      emails,
    };
    rows.push(input);
  }
  return rows;
}

const INITIAL_FORM: CaseImportInput = {
  clientFirstName: "",
  clientLastName: "",
  defendantName: "",
  defendantFirstName: "",
  defendantLastName: "",
  caseNumber: "",
  caseId: "",
  defenseCounsel: "",
  emails: ["", "", "", "", "", ""],
};

export default function CasesPage() {
  const { fetchWithAuth, userId } = useAuthenticatedFetch();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState<CaseImportInput>(INITIAL_FORM);
  const [defendantType, setDefendantType] = useState<"entity" | "individual">("entity");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{
    created: number;
    failed: number;
    errors?: { index: number; error: string }[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCases = () => {
    if (!userId) return;
    fetchWithAuth("/api/data/cases")
      .then((r) => r.json())
      .then(setCases)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCases();
  }, [userId, fetchWithAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload: CaseImportInput = {
        clientFirstName: form.clientFirstName.trim(),
        clientLastName: form.clientLastName.trim(),
        caseNumber: form.caseNumber.trim(),
        caseId: form.caseId?.trim() || undefined,
        defenseCounsel: form.defenseCounsel?.trim() || undefined,
        emails: form.emails?.filter((e) => e?.trim()).slice(0, 6) || [],
      };
      if (defendantType === "entity") {
        payload.defendantName = form.defendantName?.trim();
      } else {
        payload.defendantFirstName = form.defendantFirstName?.trim();
        payload.defendantLastName = form.defendantLastName?.trim();
      }

      const res = await fetchWithAuth("/api/data/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create case");
        return;
      }
      setForm(INITIAL_FORM);
      setShowImport(false);
      fetchCases();
    } finally {
      setSubmitting(false);
    }
  };

  const updateForm = (field: keyof CaseImportInput, value: string | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateEmail = (idx: number, value: string) => {
    setForm((prev) => {
      const emails = [...(prev.emails ?? ["", "", "", "", "", ""])];
      emails[idx] = value;
      return { ...prev, emails };
    });
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setCsvResult(null);
    setCsvImporting(true);
    setError(null);
    try {
      const text = await file.text();
      const cases = parseCSVToCases(text);
      if (cases.length === 0) {
        setError("No valid rows found in CSV. Use the template format.");
        return;
      }
      const res = await fetchWithAuth("/api/data/cases/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cases }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to import cases");
        return;
      }
      setCsvResult({
        created: data.created,
        failed: data.failed,
        errors: data.errors,
      });
      fetchCases();
    } catch (err) {
      setError("Failed to read or parse CSV file");
    } finally {
      setCsvImporting(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Cases
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your matters and assign time entries
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            setShowImport((s) => !s);
            setCsvResult(null);
          }}
        >
          {showImport ? "Cancel" : "Import case"}
        </Button>
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={csvImporting}
          >
            {csvImporting ? "Importing…" : "Import from CSV"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCsvImport}
          />
          <a
            href="/cases-import-template.csv"
            download="cases-import-template.csv"
            className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          >
            Download template
          </a>
        </div>
      </div>

      {csvResult && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            csvResult.failed > 0
              ? "bg-amber-50 text-amber-800"
              : "bg-green-50 text-green-800"
          }`}
        >
          {csvResult.created > 0 && (
            <p>Imported {csvResult.created} case{csvResult.created !== 1 ? "s" : ""}.</p>
          )}
          {csvResult.failed > 0 && (
            <p className="mt-1">
              {csvResult.failed} row{csvResult.failed !== 1 ? "s" : ""} failed:
              {csvResult.errors?.map((e) => ` Row ${e.index}: ${e.error}`).join("; ")}
            </p>
          )}
        </div>
      )}

      {showImport && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader
            title="Import case"
            subtitle="Add a case for suggestion matching. Emails 1–6 are used to match events."
          />
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Client first name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.clientFirstName}
                    onChange={(e) => updateForm("clientFirstName", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Client last name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.clientLastName}
                    onChange={(e) => updateForm("clientLastName", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Defendant type
                </label>
                <div className="mt-2 flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="defendantType"
                      checked={defendantType === "entity"}
                      onChange={() => setDefendantType("entity")}
                      className="text-blue-600"
                    />
                    Entity / organization
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="defendantType"
                      checked={defendantType === "individual"}
                      onChange={() => setDefendantType("individual")}
                      className="text-blue-600"
                    />
                    Individual
                  </label>
                </div>
              </div>

              {defendantType === "entity" ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Defendant name (entity) *
                  </label>
                  <input
                    type="text"
                    required={defendantType === "entity"}
                    value={form.defendantName}
                    onChange={(e) => updateForm("defendantName", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Defendant first name *
                    </label>
                    <input
                      type="text"
                      required={defendantType === "individual"}
                      value={form.defendantFirstName}
                      onChange={(e) =>
                        updateForm("defendantFirstName", e.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Defendant last name *
                    </label>
                    <input
                      type="text"
                      required={defendantType === "individual"}
                      value={form.defendantLastName}
                      onChange={(e) =>
                        updateForm("defendantLastName", e.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Case number *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.caseNumber}
                    onChange={(e) => updateForm("caseNumber", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Case ID (optional)
                  </label>
                  <input
                    type="text"
                    value={form.caseId}
                    onChange={(e) => updateForm("caseId", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Defense counsel (optional)
                </label>
                <input
                  type="text"
                  value={form.defenseCounsel}
                  onChange={(e) => updateForm("defenseCounsel", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Emails for matching (1–6)
                </label>
                <p className="mt-0.5 text-xs text-slate-500">
                  Client, defense counsel, etc. Used to match events to this case.
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <input
                      key={i}
                      type="email"
                      placeholder={`Email ${i + 1}`}
                      value={form.emails?.[i] ?? ""}
                      onChange={(e) => updateEmail(i, e.target.value)}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Adding..." : "Add case"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowImport(false);
                    setForm(INITIAL_FORM);
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
        </div>
      ) : cases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
          <p className="text-slate-500">
            No cases yet. Import a case above or load demo data from the
            Dashboard.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cases.map((c) => (
            <Card
              key={c.id}
              className="border-slate-200 shadow-sm transition-shadow hover:shadow-md"
            >
              <CardContent className="py-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-900">
                      {c.caseName}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">{c.clientName}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Matter #{c.matterNumber}
                    </p>
                  </div>
                  <Badge
                    variant={
                      c.status === "active"
                        ? "success"
                        : c.status === "closed"
                          ? "neutral"
                          : "warning"
                    }
                  >
                    {c.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
