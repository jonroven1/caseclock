/**
 * GET /api/data/time-entries?date=YYYY-MM-DD
 * POST /api/data/time-entries - approve suggestion and save as time entry
 * Requires X-User-Id header or userId query.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api";
import {
  getTimeEntries,
  saveTimeEntry,
  getSuggestedEntryById,
  saveSuggestedEntry,
  getRawEventsByIds,
  getCases,
  getSettings,
  saveCase,
} from "@/lib/data-store";
import { getOutlookTokens } from "@/lib/outlook-store";
import {
  getExternalEmailsFromEvent,
  mergeExternalEmailsIntoCase,
} from "@/lib/case-emails";
import type { TimeEntry, SuggestedEntry } from "@/types";

function generateId(): string {
  return `te_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function GET(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json(
      { error: "Missing date parameter" },
      { status: 400 }
    );
  }

  const entries = await getTimeEntries(userId, date);
  return NextResponse.json(entries);
}

export async function POST(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { action, suggestedEntry, caseId, durationHoursTenths, description, billable } =
      body as {
        action: "approve" | "reject";
        suggestedEntry: SuggestedEntry;
        caseId?: string;
        durationHoursTenths?: number;
        description?: string;
        billable?: boolean;
      };

    if (!suggestedEntry) {
      return NextResponse.json(
        { error: "Missing suggestedEntry" },
        { status: 400 }
      );
    }

    if (action === "reject") {
      const entry = await getSuggestedEntryById(suggestedEntry.id);
      if (entry && entry.userId === userId) {
        const updated = {
          ...entry,
          status: "rejected" as const,
          updatedAt: new Date().toISOString(),
        };
        await saveSuggestedEntry(updated);
      }
      return NextResponse.json({ success: true });
    }

    if (action === "approve") {
      const finalCaseId = caseId ?? suggestedEntry.caseId;
      if (!finalCaseId) {
        return NextResponse.json(
          { error: "Case must be assigned before approval" },
          { status: 400 }
        );
      }
      if (suggestedEntry.userId !== userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const entry: TimeEntry = {
        id: generateId(),
        userId,
        caseId: finalCaseId,
        date: suggestedEntry.date,
        startTime: suggestedEntry.startTime,
        endTime: suggestedEntry.endTime,
        durationHoursTenths:
          durationHoursTenths ?? suggestedEntry.durationHoursTenths,
        description: description ?? suggestedEntry.description,
        billable: billable ?? suggestedEntry.billable ?? true,
        sourceSuggestedEntryId: suggestedEntry.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveTimeEntry(entry);

      // Add external emails from source events to the case
      if (suggestedEntry.sourceEventIds?.length) {
        const [rawEvents, cases, settings] = await Promise.all([
          getRawEventsByIds(userId, suggestedEntry.sourceEventIds),
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

      const sugEntry = await getSuggestedEntryById(suggestedEntry.id);
      if (sugEntry && sugEntry.userId === userId) {
        const updated = {
          ...sugEntry,
          status: "approved" as const,
          caseId: finalCaseId,
          updatedAt: new Date().toISOString(),
        };
        await saveSuggestedEntry(updated);
      }

      return NextResponse.json({ success: true, entry });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Time entry error:", err);
    return NextResponse.json(
      { error: "Failed to save time entry" },
      { status: 500 }
    );
  }
}
