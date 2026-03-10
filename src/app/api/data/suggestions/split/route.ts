/**
 * POST /api/data/suggestions/split
 * Split a suggested entry into two
 */

import { NextRequest, NextResponse } from "next/server";
import { demoStore } from "@/lib/demo-store";
import type { SuggestedEntry } from "@/types";

function generateId(): string {
  return `sug_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, firstTenths } = body as { id: string; firstTenths: number };

    if (!id || firstTenths == null) {
      return NextResponse.json(
        { error: "Missing id or firstTenths" },
        { status: 400 }
      );
    }

    const idx = demoStore.suggestedEntries.findIndex((e) => e.id === id);
    if (idx < 0) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const entry = demoStore.suggestedEntries[idx];
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

    demoStore.suggestedEntries = demoStore.suggestedEntries.filter(
      (e) => e.id !== id
    );
    demoStore.suggestedEntries.push(first, second);
    demoStore.suggestedEntries.sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

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
