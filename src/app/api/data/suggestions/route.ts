/**
 * GET /api/data/suggestions?date=YYYY-MM-DD
 * Returns suggested entries for a day (from store or reconstructs)
 * Requires X-User-Id header or userId query.
 *
 * PATCH /api/data/suggestions - Edit a suggested entry
 * POST /api/data/suggestions/merge - Merge selected entries
 * POST /api/data/suggestions/split - Split an entry
 */

import { NextRequest, NextResponse } from "next/server";
import { reconstructDay } from "@/services/reconstruction-engine";
import { getUserIdFromRequest } from "@/lib/api";
import {
  getSuggestedEntries,
  getRawEvents,
  getRawEventsByIds,
  getCases,
  getContacts,
  getSettings,
  getSuggestedEntryById,
  saveSuggestedEntry,
  saveCase,
} from "@/lib/data-store";
import { getOutlookTokens } from "@/lib/outlook-store";
import {
  getExternalEmailsFromEvent,
  mergeExternalEmailsIntoCase,
} from "@/lib/case-emails";
import type { SuggestedEntry } from "@/types";

function generateId(): string {
  return `sug_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function GET(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const reconstruct = searchParams.get("reconstruct") === "true";

  if (!date) {
    return NextResponse.json(
      { error: "Missing date parameter" },
      { status: 400 }
    );
  }

  const stored = await getSuggestedEntries(userId, date);
  if (stored.length > 0 && !reconstruct) {
    return NextResponse.json(stored);
  }

  const [rawEvents, cases, contacts, settings] = await Promise.all([
    getRawEvents(userId, date),
    getCases(userId),
    getContacts(userId),
    getSettings(userId),
  ]);

  const result = reconstructDay({
    rawEvents,
    cases,
    contacts,
    settings,
    date,
    userId,
  });

  // When an email is matched to a case, add external emails to the case (exclude internal/same-domain)
  const userEmail =
    (await getOutlookTokens(userId, request))?.email ??
    settings.userEmail;
  const casesById = new Map(cases.map((c) => [c.id, c]));
  const eventsById = new Map(rawEvents.map((e) => [e.id, e]));
  const emailsToAddByCase = new Map<string, string[]>();

  for (const entry of result.suggestedEntries) {
    if (!entry.caseId || !entry.sourceEventIds?.length) continue;
    for (const eid of entry.sourceEventIds) {
      const ev = eventsById.get(eid);
      if (ev) {
        const external = getExternalEmailsFromEvent(ev, userEmail);
        if (external.length > 0) {
          const existing = emailsToAddByCase.get(entry.caseId) ?? [];
          emailsToAddByCase.set(entry.caseId, [...existing, ...external]);
        }
      }
    }
  }

  for (const [caseId, newEmails] of emailsToAddByCase) {
    const caseData = casesById.get(caseId);
    if (!caseData) continue;
    const updated = mergeExternalEmailsIntoCase(caseData, newEmails);
    if (updated) await saveCase(updated);
  }

  return NextResponse.json(result.suggestedEntries);
}

export async function PATCH(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const {
      id,
      caseId,
      description,
      durationHoursTenths,
      billable,
    } = body as {
      id: string;
      caseId?: string;
      description?: string;
      durationHoursTenths?: number;
      billable?: boolean;
    };

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const entry = await getSuggestedEntryById(id);
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    if (entry.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const start = new Date(entry.startTime);
    const durationMs =
      (durationHoursTenths ?? entry.durationHoursTenths) * 60 * 60 * 1000;
    const end = new Date(start.getTime() + durationMs);

    const updated: SuggestedEntry = {
      ...entry,
      ...(caseId !== undefined && { caseId }),
      ...(description !== undefined && { description }),
      ...(durationHoursTenths !== undefined && {
        durationHoursTenths,
        endTime: end.toISOString(),
      }),
      ...(billable !== undefined && { billable }),
      status: "edited",
      updatedAt: new Date().toISOString(),
    };

    await saveSuggestedEntry(updated);

    // When caseId is assigned, add external emails from source events to the case
    const finalCaseId = caseId ?? entry.caseId;
    if (finalCaseId && entry.sourceEventIds?.length) {
      const [rawEvents, cases, settings] = await Promise.all([
        getRawEventsByIds(userId, entry.sourceEventIds),
        getCases(userId),
        getSettings(userId),
      ]);
      const userEmail =
        (await getOutlookTokens(userId, request))?.email ??
        settings.userEmail;
      const caseData = cases.find((c) => c.id === finalCaseId);
      if (caseData) {
        let newEmails: string[] = [];
        for (const ev of rawEvents) {
          newEmails.push(...getExternalEmailsFromEvent(ev, userEmail));
        }
        const caseUpdated = mergeExternalEmailsIntoCase(caseData, newEmails);
        if (caseUpdated) await saveCase(caseUpdated);
      }
    }

    return NextResponse.json({ success: true, entry: updated });
  } catch (err) {
    console.error("Patch suggestion error:", err);
    return NextResponse.json(
      { error: "Failed to update" },
      { status: 500 }
    );
  }
}
