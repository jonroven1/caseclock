"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EditEntryModal } from "@/components/suggestions/EditEntryModal";
import { ConfidenceIndicator } from "@/components/suggestions/ConfidenceIndicator";
import type { SuggestedEntry } from "@/types";
import type { Case } from "@/types";

const userId = "demo-user";

function getSplitOptions(total: number) {
  const opts: number[] = [];
  for (let t = 0.1; t < total - 0.09; t += 0.1) {
    opts.push(Math.round(t * 10) / 10);
  }
  return opts;
}

export default function SuggestionsPage() {
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [suggestions, setSuggestions] = useState<SuggestedEntry[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editEntry, setEditEntry] = useState<SuggestedEntry | null>(null);
  const [splitEntry, setSplitEntry] = useState<SuggestedEntry | null>(null);
  const [splitFirstTenths, setSplitFirstTenths] = useState(0.1);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch(`/api/data/suggestions?date=${date}&userId=${userId}`).then((r) =>
        r.json()
      ),
      fetch(`/api/data/cases?userId=${userId}`).then((r) => r.json()),
    ])
      .then(([sugs, casesData]) => {
        setSuggestions(sugs);
        setCases(casesData);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [date]);

  const handleApprove = async (
    entry: SuggestedEntry,
    overrides?: {
      caseId?: string;
      description?: string;
      durationHoursTenths?: number;
      billable?: boolean;
    }
  ) => {
    const finalCaseId =
      overrides?.caseId ??
      selectedCaseIds[entry.id] ??
      entry.caseId ??
      cases[0]?.id;
    if (!finalCaseId) {
      alert("Please assign a case first");
      return;
    }
    setAssigning(entry.id);
    try {
      const res = await fetch("/api/data/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          suggestedEntry: entry,
          caseId: finalCaseId,
          description: overrides?.description,
          durationHoursTenths: overrides?.durationHoursTenths,
          billable: overrides?.billable,
        }),
      });
      if (res.ok) {
        const caseId =
          overrides?.caseId ??
          selectedCaseIds[entry.id] ??
          entry.caseId ??
          cases[0]?.id;
        setSuggestions((prev) =>
          prev.map((s) =>
            s.id === entry.id
              ? { ...s, status: "approved" as const, caseId }
              : s
          )
        );
      }
    } finally {
      setAssigning(null);
    }
  };

  const handleReject = async (entry: SuggestedEntry) => {
    setAssigning(entry.id);
    try {
      await fetch("/api/data/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", suggestedEntry: entry }),
      });
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === entry.id ? { ...s, status: "rejected" as const } : s
        )
      );
    } finally {
      setAssigning(null);
    }
  };

  const handleCaseChange = (entryId: string, caseId: string) => {
    setSelectedCaseIds((prev) => ({ ...prev, [entryId]: caseId }));
  };

  const handleEditSave = async (updates: {
    caseId?: string;
    description: string;
    durationHoursTenths: number;
    billable: boolean;
  }) => {
    if (!editEntry) return;
    const res = await fetch("/api/data/suggestions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editEntry.id,
        caseId: updates.caseId,
        description: updates.description,
        durationHoursTenths: updates.durationHoursTenths,
        billable: updates.billable,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setSuggestions((prev) =>
        prev.map((s) => (s.id === editEntry.id ? data.entry : s))
      );
      setSelectedCaseIds((prev) =>
        updates.caseId
          ? { ...prev, [editEntry.id]: updates.caseId }
          : prev
      );
    }
    setEditEntry(null);
  };

  const handleMerge = async () => {
    if (selectedIds.size < 2) return;
    const res = await fetch("/api/data/suggestions/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    });
    if (res.ok) {
      const data = await res.json();
      setSuggestions((prev) =>
        [...prev.filter((s) => !selectedIds.has(s.id)), data.entry].sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        )
      );
      setSelectedIds(new Set());
    }
  };

  const handleSplit = async () => {
    if (!splitEntry) return;
    const secondTenths =
      Math.round((splitEntry.durationHoursTenths - splitFirstTenths) * 10) / 10;
    if (splitFirstTenths < 0.1 || secondTenths < 0.1) {
      alert("Each part must be at least 0.1 hrs");
      return;
    }
    const res = await fetch("/api/data/suggestions/split", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: splitEntry.id,
        firstTenths: splitFirstTenths,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setSuggestions((prev) =>
        [...prev.filter((s) => s.id !== splitEntry.id), ...data.entries].sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        )
      );
      setSplitEntry(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pending = suggestions.filter((s) => s.status === "suggested");
  const approved = suggestions.filter((s) => s.status === "approved");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Suggested entries
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review and approve billable time
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {selectedIds.size >= 2 && (
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <span className="text-sm font-medium text-blue-800">
            {selectedIds.size} selected
          </span>
          <Button size="sm" onClick={handleMerge}>
            Merge selected
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
        </div>
      ) : suggestions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
          <p className="text-slate-500">
            No suggestions for this day. Load demo data from the Dashboard.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <h2 className="text-sm font-semibold text-slate-700">
              Pending ({pending.length})
            </h2>
          )}
          {pending.map((entry) => (
            <Card key={entry.id} className="overflow-hidden">
              <CardContent className="py-4">
                <div className="flex gap-3 sm:gap-4">
                  <div className="flex shrink-0 items-start pt-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(entry.id)}
                      onChange={() => toggleSelect(entry.id)}
                      className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="default">
                            {`${entry.durationHoursTenths} hrs`}
                          </Badge>
                          <span className="text-sm text-slate-500">
                            {new Date(entry.startTime).toLocaleTimeString(
                              "en-US",
                              { hour: "numeric", minute: "2-digit" }
                            )}
                          </span>
                          <ConfidenceIndicator confidence={entry.confidence} />
                        </div>
                        <p className="mt-2 font-medium text-slate-900">
                          {entry.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-sm text-slate-600">Case:</label>
                      <select
                        value={
                          selectedCaseIds[entry.id] ?? entry.caseId ?? ""
                        }
                        onChange={(e) =>
                          handleCaseChange(entry.id, e.target.value)
                        }
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="">Select case</option>
                        {cases.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.caseName}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditEntry(entry)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSplitEntry(entry);
                          setSplitFirstTenths(
                            Math.max(0.1, Math.round((entry.durationHoursTenths / 2) * 10) / 10)
                          );
                        }}
                        disabled={entry.durationHoursTenths < 0.2}
                      >
                        Split
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(entry)}
                        disabled={
                          !(
                            selectedCaseIds[entry.id] ??
                            entry.caseId ??
                            cases[0]?.id
                          ) || assigning === entry.id
                        }
                      >
                        {assigning === entry.id ? "..." : "Approve"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReject(entry)}
                        disabled={assigning === entry.id}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {approved.length > 0 && (
            <>
              <h2 className="mt-6 text-sm font-semibold text-slate-700">
                Approved ({approved.length})
              </h2>
              {approved.map((entry) => (
                <Card
                  key={entry.id}
                  className="border-emerald-200 bg-emerald-50/30"
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge variant="success">
                          {`${entry.durationHoursTenths} hrs`}
                        </Badge>
                        <span className="ml-2 text-sm text-slate-500">
                          {new Date(entry.startTime).toLocaleTimeString(
                            "en-US",
                            { hour: "numeric", minute: "2-digit" }
                          )}
                        </span>
                        <p className="mt-1 font-medium text-slate-900">
                          {entry.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      )}

      <EditEntryModal
        entry={editEntry}
        cases={cases}
        onClose={() => setEditEntry(null)}
        onSave={handleEditSave}
      />

      {splitEntry && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setSplitEntry(null)}
            aria-hidden
          />
          <div className="relative z-10 w-full max-w-sm rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
            <h2 className="text-lg font-semibold text-slate-900">
              Split entry
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Total: {splitEntry.durationHoursTenths} hrs
            </p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700">
                First part (hrs)
              </label>
              <select
                value={splitFirstTenths}
                onChange={(e) =>
                  setSplitFirstTenths(parseFloat(e.target.value))
                }
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
              >
                {getSplitOptions(splitEntry.durationHoursTenths).map((t) => (
                  <option key={t} value={t}>
                    {t} hrs → {Math.round((splitEntry.durationHoursTenths - t) * 10) / 10} hrs
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-6 flex gap-3">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setSplitEntry(null)}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSplit}>
                Split
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
