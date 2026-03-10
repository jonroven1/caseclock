"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const userId = "demo-user";

export default function SettingsPage() {
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/outlook/status?userId=${userId}`)
      .then((r) => r.json())
      .then((data) => setOutlookConnected(data.connected))
      .catch(() => setOutlookConnected(false))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    const connected = params.get("outlook_connected");
    const error = params.get("outlook_error");
    if (connected === "1") {
      setOutlookConnected(true);
      setMessage("Outlook connected successfully.");
    }
    if (error) {
      setMessage(
        error === "config"
          ? "Microsoft OAuth not configured. Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET to .env.local"
          : error === "no_code"
            ? "Connection cancelled. Try again."
            : error === "exchange_failed"
              ? "Connection failed. Check your Azure app settings."
              : `Error: ${error}`
      );
    }
  }, []);

  const handleConnect = () => {
    setMessage(null);
    window.location.href = `/api/auth/outlook?userId=${userId}`;
  };

  const handleSync = async () => {
    setMessage(null);
    setSyncing(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/outlook/sync?date=${date}&userId=${userId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Synced ${data.eventsSynced ?? 0} events from Outlook.`);
      } else {
        setMessage(data.error ?? "Sync failed.");
      }
    } catch {
      setMessage("Sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setMessage(null);
    try {
      await fetch(`/api/outlook/disconnect?userId=${userId}`, {
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
          subtitle="Sign in with your Microsoft account to sync calendar and email"
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
              <Button onClick={handleSync} disabled={syncing}>
                {syncing ? "Syncing..." : "Sync today"}
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
                CaseClock will request access to Mail and Calendar (read only).
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
