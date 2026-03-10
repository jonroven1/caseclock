/**
 * Webhook: Ingest travel/location events
 * POST /api/events/location
 */

import { NextRequest, NextResponse } from "next/server";
import { saveRawEvent } from "@/lib/event-store";
import type { LocationEventPayload, RawEvent } from "@/types";

function generateId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LocationEventPayload;
    const { type, location, destinationType, timestamp, metadata } = body;

    if (!type || !timestamp) {
      return NextResponse.json(
        { error: "Missing required fields: type, timestamp" },
        { status: 400 }
      );
    }

    const rawEvent: RawEvent = {
      id: generateId(),
      userId: "demo-user",
      source: "location",
      type: "travel",
      title: location ?? `Travel (${destinationType ?? "other"})`,
      timestampStart: new Date(timestamp).toISOString(),
      metadata: {
        ...metadata,
        location,
        destinationType: destinationType ?? "other",
      },
      confidence: 0.7,
      createdAt: new Date().toISOString(),
    };

    await saveRawEvent(rawEvent);

    return NextResponse.json({ id: rawEvent.id, success: true });
  } catch (err) {
    console.error("Location event ingestion error:", err);
    return NextResponse.json(
      { error: "Failed to ingest event" },
      { status: 500 }
    );
  }
}
