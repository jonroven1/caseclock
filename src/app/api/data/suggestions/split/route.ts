/**
 * POST /api/data/suggestions/split
 * Split a suggested entry into two
 * Requires X-User-Id header or userId query.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api";
import {
  getSuggestedEntryById,
  saveSuggestedEntry,
  deleteSuggestedEntries,
} from "@/lib/data-store";
import type { SuggestedEntry } from "@/types";

function generateId(): string {
  return `sug_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function POST(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { id, firstTenths } = body as { id: string; firstTenths: number };

    if (!id || firstTenths == null) {
      return NextResponse.json(
        { error: "Missing id or firstTenths" },
        { status: 400 }
      );
    }

    const entry = await getSuggestedEntryById(id);
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    if (entry.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (entry.status !== "suggested") {
      return NextResponse.json(
        { error: "Can only split suggested entries" },
        { status: 400 }
      );
    }

    const secondTenths = Math.round((entry.durationHoursTenths - firstTenths) * 10) / 10;
    if (firstTenths < 0.1 || secondTenths < 0.1) {
      return NextResponse.json(
        { error: "Each part must be at least 0.1 hrs" },
        { status: 400 }
      );
    }

    const start = new Date(entry.startTime);
    const mid = new Date(
      start.getTime() + firstTenths * 60 * 60 * 1000
    );
    const end = new Date(
      start.getTime() + entry.durationHoursTenths * 60 * 60 * 1000
    );

    const first: SuggestedEntry = {
      id: generateId(),
      userId: entry.userId,
      date: entry.date,
      startTime: start.toISOString(),
      endTime: mid.toISOString(),
      durationHoursTenths: firstTenths,
      description: entry.description,
      caseId: entry.caseId,
      sourceEventIds: [...entry.sourceEventIds],
      confidence: entry.confidence,
      status: "suggested",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const second: SuggestedEntry = {
      id: generateId(),
      userId: entry.userId,
      date: entry.date,
      startTime: mid.toISOString(),
      endTime: end.toISOString(),
      durationHoursTenths: secondTenths,
      description: entry.description,
      caseId: entry.caseId,
      sourceEventIds: [],
      confidence: entry.confidence,
      status: "suggested",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await deleteSuggestedEntries([id]);
    await saveSuggestedEntry(first);
    await saveSuggestedEntry(second);

    return NextResponse.json({
      success: true,
      entries: [first, second],
    });
  } catch (err) {
    console.error("Split error:", err);
    return NextResponse.json(
      { error: "Failed to split" },
      { status: 500 }
    );
  }
}
