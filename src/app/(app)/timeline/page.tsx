"use client";

import { useEffect, useState } from "react";
import type { RawEvent } from "@/types";
import { useAuthenticatedFetch } from "@/hooks/useAuthenticatedFetch";
import { parseApiJson } from "@/lib/parse-api-json";

const eventTypeConfig: Record<
  string,
  { label: string; icon: string; color: string; bgColor: string }
> = {
  email_received: {
    label: "Email received",
    icon: "✉️",
    color: "text-slate-600",
    bgColor: "bg-slate-100",
  },
  email_reply_sent: {
    label: "Email reply",
    icon: "↩️",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  email_read_estimated: {
    label: "Email read (estimated)",
    icon: "👁️",
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
  },
  email_draft_edited: {
    label: "Draft edited",
    icon: "📝",
    color: "text-rose-600",
    bgColor: "bg-rose-50",
  },
  calendar_event: {
    label: "Calendar",
    icon: "📅",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
  phone_call: {
    label: "Phone call",
    icon: "📞",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  travel: {
    label: "Travel",
    icon: "🚗",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
  },
  document_open: {
    label: "Document",
    icon: "📄",
    color: "text-violet-600",
    bgColor: "bg-violet-50",
  },
  manual_entry: {
    label: "Manual",
    icon: "✏️",
    color: "text-slate-600",
    bgColor: "bg-slate-100",
  },
};

function getConfig(type: string) {
  return (
    eventTypeConfig[type] ?? {
      label: type,
      icon: "•",
      color: "text-slate-600",
      bgColor: "bg-slate-100",
    }
  );
}

export default function TimelinePage() {
  const { fetchWithAuth, userId } = useAuthenticatedFetch();
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [events, setEvents] = useState<RawEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetchWithAuth(`/api/data/events?date=${date}`)
      .then((r) => parseApiJson<RawEvent[]>(r))
      .then((list) => setEvents(Array.isArray(list) ? list : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [date, userId, fetchWithAuth]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Timeline
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Events for the selected day
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
          <p className="text-slate-500">
            No events for this day. Load demo data from the Dashboard.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical timeline line - hidden on mobile, visible on larger screens */}
          <div className="absolute left-[19px] top-0 bottom-0 hidden w-0.5 bg-gradient-to-b from-blue-200 via-slate-200 to-slate-200 sm:block" />

          <div className="space-y-0">
            {events.map((event, idx) => {
              const config = getConfig(event.type);
              const time = new Date(event.timestampStart);
              const timeStr = time.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              });

              return (
                <div
                  key={event.id}
                  className="group relative flex gap-4 sm:gap-5"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  {/* Time + dot */}
                  <div className="flex shrink-0 flex-col items-center sm:w-14">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.bgColor} ${config.color} text-base shadow-sm ring-4 ring-white sm:h-10 sm:w-10`}
                    >
                      {config.icon}
                    </div>
                    <span className="mt-2 hidden text-xs font-medium text-slate-500 sm:block">
                      {timeStr}
                    </span>
                  </div>

                  {/* Card */}
                  <div className="min-w-0 flex-1 pb-6 sm:pb-8">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.bgColor} ${config.color}`}
                            >
                              {config.label}
                            </span>
                            <span className="text-sm font-medium text-slate-500 sm:hidden">
                              {timeStr}
                            </span>
                          </div>
                          <h3 className="font-semibold leading-snug text-slate-900">
                            {event.title || "Untitled event"}
                          </h3>
                          {event.description && (
                            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                              {event.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
