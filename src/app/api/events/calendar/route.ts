/**
 * Webhook: Ingest calendar events
 * POST /api/events/calendar
 */

import { NextRequest, NextResponse } from "next/server";
import { saveRawEvent } from "@/lib/event-store";
import type { CalendarEventPayload, RawEvent } from "@/types";

function generateId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CalendarEventPayload;
    const { title, description, start, end, location, attendees, metadata } = body;

    if (!title || !start || !end) {
      return NextResponse.json(
        { error: "Missing required fields: title, start, end" },
        { status: 400 }
      );
    }

    const rawEvent: RawEvent = {
      id: generateId(),
      userId: "demo-user",
      source: "calendar",
      type: "calendar_event",
      title,
      description,
      timestampStart: new Date(start).toISOString(),
      timestampEnd: new Date(end).toISOString(),
      metadata: {
        ...metadata,
        location,
        attendees,
      },
      confidence: 0.9,
      createdAt: new Date().toISOString(),
    };

    await saveRawEvent(rawEvent);

    return NextResponse.json({ id: rawEvent.id, success: true });
  } catch (err) {
    console.error("Calendar event ingestion error:", err);
    return NextResponse.json(
      { error: "Failed to ingest event" },
      { status: 500 }
    );
  }
}
