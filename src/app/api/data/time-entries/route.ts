/**
 * GET /api/data/time-entries?date=YYYY-MM-DD&userId=demo-user
 * POST /api/data/time-entries - approve suggestion and save as time entry
 */

import { NextRequest, NextResponse } from "next/server";
import { demoStore } from "@/lib/demo-store";
import type { TimeEntry, SuggestedEntry } from "@/types";

function generateId(): string {
  return `te_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const userId = searchParams.get("userId") ?? "demo-user";

  if (!date) {
    return NextResponse.json(
      { error: "Missing date parameter" },
      { status: 400 }
    );
  }

  const entries = demoStore.timeEntries.filter(
    (e) => e.userId === userId && e.date === date
  );
  return NextResponse.json(entries);
}

export async function POST(request: NextRequest) {
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
      const idx = demoStore.suggestedEntries.findIndex(
        (e) => e.id === suggestedEntry.id
      );
      if (idx >= 0) {
        demoStore.suggestedEntries[idx] = {
          ...demoStore.suggestedEntries[idx],
          status: "rejected",
          updatedAt: new Date().toISOString(),
        };
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

      const entry: TimeEntry = {
        id: generateId(),
        userId: suggestedEntry.userId,
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

      demoStore.timeEntries.push(entry);

      const idx = demoStore.suggestedEntries.findIndex(
        (e) => e.id === suggestedEntry.id
      );
      if (idx >= 0) {
        demoStore.suggestedEntries[idx] = {
          ...demoStore.suggestedEntries[idx],
          status: "approved",
          caseId: finalCaseId,
          updatedAt: new Date().toISOString(),
        };
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
