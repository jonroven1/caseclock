/**
 * POST /api/data/suggestions/merge
 * Merge selected suggested entries into one
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
    const { ids } = body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length < 2) {
      return NextResponse.json(
        { error: "Provide at least 2 entry ids to merge" },
        { status: 400 }
      );
    }

    const entries = ids
      .map((id) => demoStore.suggestedEntries.find((e) => e.id === id))
      .filter((e): e is SuggestedEntry => e != null && e.status === "suggested");

    if (entries.length !== ids.length) {
      return NextResponse.json(
        { error: "Some entries not found or not in suggested status" },
        { status: 400 }
      );
    }

    const sorted = [...entries].sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalTenths = sorted.reduce(
      (sum, e) => sum + e.durationHoursTenths,
      0
    );
    const allEventIds = sorted.flatMap((e) => e.sourceEventIds);
    const mergedConfidence =
      sorted.reduce((s, e) => s + e.confidence, 0) / sorted.length;

    const merged: SuggestedEntry = {
      id: generateId(),
      userId: first.userId,
      date: first.date,
      startTime: first.startTime,
      endTime: last.endTime,
      durationHoursTenths: Math.round(totalTenths * 10) / 10,
      description: sorted.map((e) => e.description).join("; "),
      caseId: first.caseId ?? sorted.find((e) => e.caseId)?.caseId,
      sourceEventIds: [...new Set(allEventIds)],
      confidence: mergedConfidence,
      status: "suggested",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    demoStore.suggestedEntries = demoStore.suggestedEntries.filter(
      (e) => !ids.includes(e.id)
    );
    demoStore.suggestedEntries.push(merged);
    demoStore.suggestedEntries.sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    return NextResponse.json({ success: true, entry: merged });
  } catch (err) {
    console.error("Merge error:", err);
    return NextResponse.json(
      { error: "Failed to merge" },
      { status: 500 }
    );
  }
}
