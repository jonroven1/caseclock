"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Case } from "@/types";

const userId = "demo-user";

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/data/cases?userId=${userId}`)
      .then((r) => r.json())
      .then(setCases)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Cases
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your matters and assign time entries
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
        </div>
      ) : cases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
          <p className="text-slate-500">
            No cases yet. Load demo data from the Dashboard.
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
