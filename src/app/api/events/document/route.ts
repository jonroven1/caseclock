/**
 * Webhook: Ingest document open events
 * POST /api/events/document
 */

import { NextRequest, NextResponse } from "next/server";
import { saveRawEvent } from "@/lib/event-store";
import type { DocumentEventPayload, RawEvent } from "@/types";

function generateId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DocumentEventPayload;
    const { documentName, documentType, action, timestamp, metadata } = body;

    if (!documentName || !timestamp) {
      return NextResponse.json(
        { error: "Missing required fields: documentName, timestamp" },
        { status: 400 }
      );
    }

    const rawEvent: RawEvent = {
      id: generateId(),
      userId: "demo-user",
      source: "document",
      type: "document_open",
      title: documentName,
      description: documentType,
      timestampStart: new Date(timestamp).toISOString(),
      metadata: {
        ...metadata,
        documentType,
        action: action ?? "open",
      },
      confidence: 0.6,
      createdAt: new Date().toISOString(),
    };

    await saveRawEvent(rawEvent);

    return NextResponse.json({ id: rawEvent.id, success: true });
  } catch (err) {
    console.error("Document event ingestion error:", err);
    return NextResponse.json(
      { error: "Failed to ingest event" },
      { status: 500 }
    );
  }
}
