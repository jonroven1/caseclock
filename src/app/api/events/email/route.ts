/**
 * Webhook: Ingest email events (received, reply sent)
 * POST /api/events/email
 */

import { NextRequest, NextResponse } from "next/server";
import { saveRawEvent } from "@/lib/event-store";
import type { EmailEventPayload, RawEvent } from "@/types";

function generateId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as EmailEventPayload;
    const { type, subject, from, to, threadId, timestamp, hasAttachment, attachmentCount, metadata } = body;

    if (!type || !timestamp) {
      return NextResponse.json(
        { error: "Missing required fields: type, timestamp" },
        { status: 400 }
      );
    }

    const rawEvent: RawEvent = {
      id: generateId(),
      userId: "demo-user", // TODO: Get from auth token
      source: "email",
      type,
      title: subject ?? "Email",
      description: undefined,
      timestampStart: new Date(timestamp).toISOString(),
      metadata: {
        ...metadata,
        from,
        to,
        threadId,
        hasAttachment,
        attachmentCount,
      },
      confidence: 0.8,
      createdAt: new Date().toISOString(),
    };

    await saveRawEvent(rawEvent);

    return NextResponse.json({ id: rawEvent.id, success: true });
  } catch (err) {
    console.error("Email event ingestion error:", err);
    return NextResponse.json(
      { error: "Failed to ingest event" },
      { status: 500 }
    );
  }
}
