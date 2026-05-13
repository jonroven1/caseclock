"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import Link from "next/link";
import { useAuthenticatedFetch } from "@/hooks/useAuthenticatedFetch";
import { parseApiJson } from "@/lib/parse-api-json";
import { stashOutlookOAuthUserId } from "@/lib/outlook-oauth-bridge";

export default function DashboardPage() {
  const { fetchWithAuth, userId } = useAuthenticatedFetch();
  const [today, setToday] = useState("");
  const [suggestedHours, setSuggestedHours] = useState(0);
  const [approvedHours, setApprovedHours] = useState(0);
  const [unreviewedCount, setUnreviewedCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetchWithAuth("/api/outlook/status")
      .then((r) => parseApiJson<{ connected?: boolean }>(r))
      .then((d) => setOutlookConnected(d.connected === true))
      .catch(() => setOutlookConnected(false));
  }, [userId, fetchWithAuth]);

  useEffect(() => {
    if (!userId) return;
    const d = new Date();
    const dateStr = d.toISOString().slice(0, 10);
    setToday(dateStr);

    Promise.all([
      fetchWithAuth(`/api/data/suggestions?date=${dateStr}`).then((r) =>
        parseApiJson<unknown[]>(r)
      ),
      fetchWithAuth(`/api/data/time-entries?date=${dateStr}`).then((r) =>
        parseApiJson<unknown[]>(r)
      ),
      fetchWithAuth(`/api/data/events?date=${dateStr}`).then((r) =>
        parseApiJson<unknown[]>(r)
      ),
    ])
      .then(([suggestions, entries, events]) => {
        const s = Array.isArray(suggestions) ? suggestions : [];
        const e = Array.isArray(entries) ? entries : [];
        const ev = Array.isArray(events) ? events : [];
        const pending = s.filter((x) => (x as { status?: string }).status === "suggested");
        setSuggestedHours(
          s.reduce(
            (a: number, x) => a + ((x as { durationHoursTenths?: number }).durationHoursTenths ?? 0),
            0
          )
        );
        setApprovedHours(
          e.reduce(
            (a: number, x) => a + ((x as { durationHoursTenths?: number }).durationHoursTenths ?? 0),
            0
          )
        );
        setUnreviewedCount(pending.length);
        setEventCount(ev.length);
      })
      .catch((err) => {
        console.error("Dashboard data load failed:", err);
        setSuggestedHours(0);
        setApprovedHours(0);
        setUnreviewedCount(0);
        setEventCount(0);
      });
  }, [userId, fetchWithAuth]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Dashboard
        </h1>
        <p className="mt-1 text-slate-500">
          {today
            ? new Date(today).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="pt-5 pb-5">
            <p className="text-sm font-medium text-slate-500">
              Suggested hours today
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {suggestedHours.toFixed(1)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="pt-5 pb-5">
            <p className="text-sm font-medium text-slate-500">
              Approved hours today
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">
              {approvedHours.toFixed(1)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="pt-5 pb-5">
            <p className="text-sm font-medium text-slate-500">
              Unreviewed suggestions
            </p>
            <p className="mt-2 text-3xl font-bold text-amber-600">
              {unreviewedCount}
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="pt-5 pb-5">
            <p className="text-sm font-medium text-slate-500">
              Raw events today
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {eventCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader
          title="Connect Outlook"
          subtitle="Sync calendar and email from your Microsoft account"
        />
        <CardContent>
          {outlookConnected ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={async () => {
                  setSyncing(true);
                  try {
                    const dateStr =
                      today || new Date().toISOString().slice(0, 10);
                    const res = await fetchWithAuth(
                      `/api/outlook/sync?date=${dateStr}`,
                      { method: "POST" }
                    );
                    await parseApiJson(res);
                    window.location.reload();
                  } catch {
                    /* Sync failed — check Outlook connection in Settings */
                  } finally {
                    setSyncing(false);
                  }
                }}
                disabled={syncing}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {syncing ? "Syncing..." : "Sync today"}
              </button>
              <Link
                href="/settings"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Manage in Settings
              </Link>
            </div>
          ) : (
            <div>
              <a
                href={
                  userId
                    ? `/api/auth/outlook?userId=${encodeURIComponent(userId)}`
                    : "#"
                }
                onClick={() => {
                  if (userId) stashOutlookOAuthUserId(userId);
                }}
                className="inline-flex items-center rounded-xl bg-[#0078d4] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#106ebe] disabled:opacity-50"
              >
                Connect Outlook
              </a>
              <p className="mt-2 text-sm text-slate-500">
                Sign in with Microsoft to sync calendar and email.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader
          title="Quick actions"
          subtitle="Review and approve your time"
          action={
            <Link
              href="/suggestions"
              className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              View all
            </Link>
          }
        />
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link href="/suggestions">
              <span className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700">
                Review suggestions
              </span>
            </Link>
            <Link href="/timeline">
              <span className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                View timeline
              </span>
            </Link>
            <Link href="/cases">
              <span className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                Manage cases
              </span>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader title="Recent activity" />
        <CardContent>
          {eventCount === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                No demo data yet. Click below to load sample events and
                suggestions for a plaintiff-side employment lawyer.
              </p>
              <button
                onClick={async () => {
                  try {
                    const dateStr =
                      today || new Date().toISOString().slice(0, 10);
                    const res = await fetchWithAuth(
                      `/api/seed?date=${dateStr}`,
                      { method: "POST" }
                    );
                    const data = await parseApiJson<{ success?: boolean }>(res);
                    if (data.success) {
                      window.location.reload();
                    }
                  } catch {
                    /* ignore */
                  }
                }}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                Load demo data
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              View your timeline and suggestions above.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
