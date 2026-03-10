"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import type { SuggestedEntry, Case } from "@/types";

interface EditEntryModalProps {
  entry: SuggestedEntry | null;
  cases: Case[];
  onClose: () => void;
  onSave: (updates: {
    caseId?: string;
    description: string;
    durationHoursTenths: number;
    billable: boolean;
  }) => void | Promise<void>;
}

const TENTH_OPTIONS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.5, 2.0, 2.5, 3.0];

export function EditEntryModal({
  entry,
  cases,
  onClose,
  onSave,
}: EditEntryModalProps) {
  const [caseId, setCaseId] = useState("");
  const [description, setDescription] = useState("");
  const [durationHoursTenths, setDurationHoursTenths] = useState(0.1);
  const [billable, setBillable] = useState(true);

  useEffect(() => {
    if (entry) {
      setCaseId(entry.caseId ?? "");
      setDescription(entry.description);
      setDurationHoursTenths(entry.durationHoursTenths);
      setBillable(entry.billable ?? true);
    }
  }, [entry]);

  if (!entry) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      caseId: caseId || undefined,
      description,
      durationHoursTenths,
      billable,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-lg rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">Edit entry</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Case
            </label>
            <select
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Select case</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.caseName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Describe the work performed"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Duration (tenths of an hour)
            </label>
            <select
              value={durationHoursTenths}
              onChange={(e) => setDurationHoursTenths(parseFloat(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {TENTH_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t} hrs
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={billable}
              onClick={() => setBillable(!billable)}
              className={`relative inline-flex h-8 w-14 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                billable ? "bg-emerald-500" : "bg-slate-200"
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${
                  billable ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-sm font-medium text-slate-700">
              Billable
            </span>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
