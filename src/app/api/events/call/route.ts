/**
 * Webhook: Ingest phone call events
 * POST /api/events/call
 */

import { NextRequest, NextResponse } from "next/server";
import { saveRawEvent } from "@/lib/event-store";
import type { CallEventPayload, RawEvent } from "@/types";

function generateId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CallEventPayload;
    const { phoneNumber, durationSeconds, timestamp, metadata } = body;

    if (!timestamp) {
      return NextResponse.json(
        { error: "Missing required field: timestamp" },
        { status: 400 }
      );
    }

    const start = new Date(timestamp);
    const end = new Date(start.getTime() + (durationSeconds ?? 0) * 1000);

    const rawEvent: RawEvent = {
      id: generateId(),
      userId: "demo-user",
      source: "call",
      type: "phone_call",
      title: `Phone call${phoneNumber ? `: ${phoneNumber}` : ""}`,
      timestampStart: start.toISOString(),
      timestampEnd: end.toISOString(),
      metadata: {
        ...metadata,
        phoneNumber,
        durationSeconds: durationSeconds ?? 0,
      },
      confidence: 0.85,
      createdAt: new Date().toISOString(),
    };

    await saveRawEvent(rawEvent);

    return NextResponse.json({ id: rawEvent.id, success: true });
  } catch (err) {
    console.error("Call event ingestion error:", err);
    return NextResponse.json(
      { error: "Failed to ingest event" },
      { status: 500 }
    );
  }
}
