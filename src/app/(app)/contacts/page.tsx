"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import type { Contact } from "@/types";
import type { Case } from "@/types";
import { useAuthenticatedFetch } from "@/hooks/useAuthenticatedFetch";

export default function ContactsPage() {
  const { fetchWithAuth, userId } = useAuthenticatedFetch();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCaseId, setFilterCaseId] = useState<string>("");

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      fetchWithAuth("/api/data/contacts").then((r) => r.json()),
      fetchWithAuth("/api/data/cases").then((r) => r.json()),
    ])
      .then(([contactsData, casesData]) => {
        setContacts(contactsData);
        setCases(casesData);
      })
      .finally(() => setLoading(false));
  }, [userId, fetchWithAuth]);

  const filtered = filterCaseId
    ? contacts.filter((c) => c.caseId === filterCaseId)
    : contacts;

  const getCaseName = (caseId: string) =>
    cases.find((c) => c.id === caseId)?.caseName ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Contacts
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Contacts linked to cases for event matching
          </p>
        </div>
        <select
          value={filterCaseId}
          onChange={(e) => setFilterCaseId(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">All cases</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.caseName}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
          <p className="text-slate-500">
            No contacts yet. Load demo data from the Dashboard.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((contact) => (
            <Card
              key={contact.id}
              className="border-slate-200 shadow-sm transition-shadow hover:shadow-md"
            >
              <CardContent className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {contact.name}
                    </h3>
                    {contact.role && (
                      <p className="text-sm text-slate-500">{contact.role}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                      {contact.email && <span>{contact.email}</span>}
                      {contact.phone && <span>{contact.phone}</span>}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Case: {getCaseName(contact.caseId)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
