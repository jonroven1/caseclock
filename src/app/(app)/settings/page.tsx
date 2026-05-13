"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuthenticatedFetch } from "@/hooks/useAuthenticatedFetch";
import { parseApiJson } from "@/lib/parse-api-json";
import {
  stashOutlookOAuthUserId,
  clearOutlookOAuthBridge,
} from "@/lib/outlook-oauth-bridge";

export default function SettingsPage() {
  const { fetchWithAuth, userId, authLoading } = useAuthenticatedFetch();
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const autoSyncDone = useRef(false);

  useEffect(() => {
    if (!userId) return;
    fetchWithAuth("/api/outlook/status")
      .then((r) => parseApiJson<{ connected?: boolean }>(r))
      .then((data) => setOutlookConnected(data.connected === true))
      .catch(() => setOutlookConnected(false))
      .finally(() => setLoading(false));
  }, [userId, fetchWithAuth]);

  useEffect(() => {
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    const connected = params.get("outlook_connected");
    const error = params.get("outlook_error");
    const errorDetail = params.get("error_detail");
    if (connected === "1") {
      setOutlookConnected(true);
      setMessage("Outlook connected successfully. Syncing…");
    }
    if (error) {
      let msg =
        error === "config"
          ? "Microsoft OAuth not configured. Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET to .env.local"
          : error === "no_code"
            ? "Connection cancelled. Try again."
            : error === "missing_state"
              ? "Session expired. Please try connecting again from Settings."
              : error === "exchange_failed"
                ? "Connection failed. Check your Azure app settings."
                : `Error: ${error}`;
      if (errorDetail) msg += ` (${errorDetail})`;
      setMessage(msg);
    }
  }, []);

  const syncOutlook = useCallback(
    async (params: string) => {
      if (!userId) return;
      setSyncing(true);
      try {
        const res = await fetchWithAuth(`/api/outlook/sync?${params}`, {
          method: "POST",
        });
        const data = await parseApiJson<{
          startDate?: string;
          endDate?: string;
          eventsSynced?: number;
        }>(res);
        clearOutlookOAuthBridge();
        const range =
          data.startDate === data.endDate
            ? data.startDate
            : `${data.startDate} → ${data.endDate}`;
        setMessage(
          `Synced ${data.eventsSynced ?? 0} events from Outlook (${range}).`
        );
      } catch (e) {
        setMessage(
          e instanceof Error ? e.message : "Sync failed."
        );
      } finally {
        setSyncing(false);
      }
    },
    [userId, fetchWithAuth]
  );

  useEffect(() => {
    if (authLoading) return;
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    if (
      params.get("outlook_connected") === "1" &&
      userId &&
      !autoSyncDone.current
    ) {
      autoSyncDone.current = true;
      setOutlookConnected(true);
      setMessage("Outlook connected successfully. Syncing…");
      window.history.replaceState({}, "", "/settings");
      const t = setTimeout(() => syncOutlook("days=7"), 1200);
      return () => clearTimeout(t);
    }
  }, [userId, syncOutlook, authLoading]);

  const handleConnect = () => {
    setMessage(null);
    if (userId) {
      stashOutlookOAuthUserId(userId);
      window.location.href = `/api/auth/outlook?userId=${encodeURIComponent(userId)}`;
    }
  };

  const handleSyncToday = () => {
    setMessage(null);
    syncOutlook(`date=${new Date().toISOString().slice(0, 10)}`);
  };

  const handleSyncPastWeek = () => {
    setMessage(null);
    syncOutlook("days=7");
  };

  const handleSyncPastMonth = () => {
    setMessage(null);
    syncOutlook("days=30");
  };

  const handleDisconnect = async () => {
    setMessage(null);
    clearOutlookOAuthBridge();
    try {
      await fetchWithAuth("/api/outlook/disconnect", {
        method: "POST",
      });
      setOutlookConnected(false);
      setMessage("Outlook disconnected.");
    } catch {
      setMessage("Disconnect failed.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Billing heuristics and integrations
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader
          title="Connect Outlook"
          subtitle="Sign in with your Microsoft account to sync email"
        />
        <CardContent className="space-y-4">
          {message && (
            <div
              className={`rounded-full px-4 py-2 text-sm ${
                message.includes("Error") || message.includes("failed")
                  ? "bg-red-50 text-red-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {message}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-slate-500">Checking connection...</p>
          ) : outlookConnected ? (
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleSyncToday} disabled={syncing}>
                {syncing ? "Syncing..." : "Sync today"}
              </Button>
              <Button
                variant="secondary"
                onClick={handleSyncPastWeek}
                disabled={syncing}
              >
                Sync past week
              </Button>
              <Button
                variant="secondary"
                onClick={handleSyncPastMonth}
                disabled={syncing}
              >
                Sync past month
              </Button>
              <Button variant="ghost" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </div>
          ) : (
            <div>
              <Button onClick={handleConnect} className="mb-2">
                Connect Outlook
              </Button>
              <p className="mt-2 text-sm text-slate-500">
                You&apos;ll sign in with Microsoft on your phone or browser.
                CaseClock will request read-only Mail access.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader
          title="Billing heuristics"
          subtitle="How suggested time is calculated"
        />
        <CardContent className="space-y-5">
          <div>
            <h4 className="font-medium text-slate-700">Email reply</h4>
            <p className="mt-1 text-sm text-slate-500">
              Default 0.1 hrs per reply. Multiple replies in same thread within
              30 min suggest 0.2–0.3. Attachment or document-open increases time
              and confidence.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-slate-700">Calendar events</h4>
            <p className="mt-1 text-sm text-slate-500">
              Use actual duration, rounded to nearest 0.1 hr.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-slate-700">Phone calls</h4>
            <p className="mt-1 text-sm text-slate-500">
              Use actual duration. Round up to nearest 0.1 if configured.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-slate-700">Travel</h4>
            <p className="mt-1 text-sm text-slate-500">
              Create travel suggestions for court, deposition, client site.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader
          title="Webhook endpoints"
          subtitle="POST events to these URLs (auth required in production)"
        />
        <CardContent>
          <ul className="space-y-2 font-mono text-sm text-slate-600">
            <li>POST /api/events/email</li>
            <li>POST /api/events/calendar</li>
            <li>POST /api/events/call</li>
            <li>POST /api/events/location</li>
            <li>POST /api/events/document</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
