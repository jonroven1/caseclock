/**
 * GET /api/data/suggestions?date=YYYY-MM-DD&userId=demo-user
 * Returns suggested entries for a day (from store or reconstructs)
 *
 * PATCH /api/data/suggestions - Edit a suggested entry
 * POST /api/data/suggestions/merge - Merge selected entries
 * POST /api/data/suggestions/split - Split an entry
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { getMockRawEvents } from "@/lib/firebase-admin";
import { demoStore } from "@/lib/demo-store";
import { COLLECTIONS } from "@/lib/firestore";
import { reconstructDay } from "@/services/reconstruction-engine";
import type { SuggestedEntry } from "@/types";

function generateId(): string {
  return `sug_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const userId = searchParams.get("userId") ?? "demo-user";
  const reconstruct = searchParams.get("reconstruct") === "true";

  if (!date) {
    return NextResponse.json(
      { error: "Missing date parameter" },
      { status: 400 }
    );
  }

  const db = await getDb();

  if (db) {
    const snapshot = await db
      .collection(COLLECTIONS.SUGGESTED_ENTRIES)
      .where("userId", "==", userId)
      .where("date", "==", date)
      .orderBy("startTime", "asc")
      .get();
    const entries = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (entries.length > 0) return NextResponse.json(entries);
  }

  let rawEvents = db
    ? []
    : getMockRawEvents().filter(
        (e) =>
          e.userId === userId &&
          new Date(e.timestampStart).toISOString().startsWith(date)
      );

  if (rawEvents.length === 0) {
    rawEvents = demoStore.rawEvents.filter(
      (e) =>
        e.userId === userId &&
        new Date(e.timestampStart).toISOString().startsWith(date)
    );
  }

  const stored = demoStore.suggestedEntries.filter(
    (e) => e.userId === userId && e.date === date
  );
  if (stored.length > 0 && !reconstruct) {
    return NextResponse.json(stored);
  }

  const settings = demoStore.settings[userId] ?? {
    userId,
    roundCallsToTenth: true,
    defaultReplyTenths: 0.1,
    defaultTravelBilling: 0.5,
    autoApproveCalendarEvents: false,
    timezone: "America/New_York",
  };

  const result = reconstructDay({
    rawEvents,
    cases: demoStore.cases,
    contacts: demoStore.contacts,
    settings,
    date,
    userId,
  });

  return NextResponse.json(result.suggestedEntries);
}

export async function PATCH(request: NextRequest) {
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

    const idx = demoStore.suggestedEntries.findIndex((e) => e.id === id);
    if (idx < 0) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const entry = demoStore.suggestedEntries[idx];
    const start = new Date(entry.startTime);
    const durationMs =
      (durationHoursTenths ?? entry.durationHoursTenths) * 60 * 60 * 1000;
    const end = new Date(start.getTime() + durationMs);

    demoStore.suggestedEntries[idx] = {
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

    return NextResponse.json({
      success: true,
      entry: demoStore.suggestedEntries[idx],
    });
  } catch (err) {
    console.error("Patch suggestion error:", err);
    return NextResponse.json(
      { error: "Failed to update" },
      { status: 500 }
    );
  }
}
