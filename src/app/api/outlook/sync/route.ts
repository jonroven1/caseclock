/**
 * POST /api/outlook/sync?date=YYYY-MM-DD&userId=demo-user
 * Fetches calendar events and recent mail from Microsoft Graph,
 * converts to raw events, and saves to the store.
 */

import { NextRequest, NextResponse } from "next/server";
import { getOutlookTokens, isOutlookConnected } from "@/lib/outlook-store";
import { refreshAccessToken } from "@/lib/outlook-auth";
import { setOutlookTokens } from "@/lib/outlook-store";
import { saveRawEvent } from "@/lib/event-store";
import { demoStore } from "@/lib/demo-store";
import type { RawEvent } from "@/types";

// saveRawEvent already pushes to demoStore when Firestore not configured

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function getValidAccessToken(userId: string): Promise<string | null> {
  let tokens = getOutlookTokens(userId);
  if (!tokens) return null;

  if (tokens.expiresAt <= Math.floor(Date.now() / 1000) + 300) {
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    tokens = {
      ...tokens,
      accessToken: refreshed.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + refreshed.expires_in,
    };
    setOutlookTokens(userId, tokens);
  }

  return tokens.accessToken;
}

function generateId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const userId = searchParams.get("userId") ?? "demo-user";

  const token = await getValidAccessToken(userId);
  if (!token) {
    return NextResponse.json(
      { error: "Outlook not connected. Connect in Settings first." },
      { status: 401 }
    );
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);
    const startIso = dayStart.toISOString();
    const endIso = dayEnd.toISOString();

    // Fetch calendar events for the day
    const calendarRes = await fetch(
      `${GRAPH_BASE}/me/calendarView?startDateTime=${encodeURIComponent(startIso)}&endDateTime=${encodeURIComponent(endIso)}`,
      { headers }
    );

    if (calendarRes.ok) {
      const calData = (await calendarRes.json()) as {
        value?: Array<{
          id: string;
          subject: string;
          start: { dateTime: string };
          end: { dateTime: string };
          bodyPreview?: string;
          location?: { displayName?: string };
        }>;
      };

      for (const ev of calData.value ?? []) {
        const rawEvent: RawEvent = {
          id: generateId(),
          userId,
          source: "calendar",
          type: "calendar_event",
          title: ev.subject ?? "Calendar event",
          description: ev.bodyPreview,
          timestampStart: ev.start.dateTime,
          timestampEnd: ev.end.dateTime,
          metadata: {
            location: ev.location?.displayName,
            graphId: ev.id,
          },
          confidence: 0.9,
          createdAt: new Date().toISOString(),
        };
        await saveRawEvent(rawEvent);
      }
    }

    // Fetch mail from inbox (received) - last 50, filter by date
    const mailRes = await fetch(
      `${GRAPH_BASE}/me/mailFolders/inbox/messages?$top=50&$orderby=receivedDateTime desc`,
      { headers }
    );

    if (mailRes.ok) {
      const mailData = (await mailRes.json()) as {
        value?: Array<{
          id: string;
          subject: string;
          receivedDateTime: string;
          from?: { emailAddress?: { address?: string } };
          toRecipients?: Array<{ emailAddress?: { address?: string } }>;
          internetMessageId?: string;
          hasAttachments?: boolean;
        }>;
      };

      for (const msg of mailData.value ?? []) {
        const received = new Date(msg.receivedDateTime);
        if (received >= dayStart && received <= dayEnd) {
          const rawEvent: RawEvent = {
            id: generateId(),
            userId,
            source: "email",
            type: "email_received",
            title: msg.subject ?? "Email",
            timestampStart: msg.receivedDateTime,
            metadata: {
              from: msg.from?.emailAddress?.address,
              to: msg.toRecipients?.[0]?.emailAddress?.address,
              threadId: msg.internetMessageId,
              hasAttachment: msg.hasAttachments,
              attachmentCount: msg.hasAttachments ? 1 : 0,
              graphId: msg.id,
            },
            confidence: 0.8,
            createdAt: new Date().toISOString(),
          };
          await saveRawEvent(rawEvent);
        }
      }
    }

    // Fetch sent mail for the day
    const sentRes = await fetch(
      `${GRAPH_BASE}/me/mailFolders/sentitems/messages?$top=50&$orderby=sentDateTime desc`,
      { headers }
    );

    if (sentRes.ok) {
      const sentData = (await sentRes.json()) as {
        value?: Array<{
          id: string;
          subject: string;
          sentDateTime: string;
          from?: { emailAddress?: { address?: string } };
          toRecipients?: Array<{ emailAddress?: { address?: string } }>;
          internetMessageId?: string;
          hasAttachments?: boolean;
        }>;
      };

      for (const msg of sentData.value ?? []) {
        const sent = new Date(msg.sentDateTime);
        if (sent >= dayStart && sent <= dayEnd) {
          const rawEvent: RawEvent = {
            id: generateId(),
            userId,
            source: "email",
            type: "email_reply_sent",
            title: msg.subject ?? "Email",
            timestampStart: msg.sentDateTime,
            metadata: {
              from: msg.from?.emailAddress?.address,
              to: msg.toRecipients?.[0]?.emailAddress?.address,
              threadId: msg.internetMessageId,
              hasAttachment: msg.hasAttachments,
              attachmentCount: msg.hasAttachments ? 1 : 0,
              graphId: msg.id,
            },
            confidence: 0.8,
            createdAt: new Date().toISOString(),
          };
          await saveRawEvent(rawEvent);
        }
      }
    }

    const eventCount = demoStore.rawEvents.filter(
      (e) =>
        e.userId === userId &&
        new Date(e.timestampStart).toISOString().startsWith(date)
    ).length;

    return NextResponse.json({
      success: true,
      date,
      eventsSynced: eventCount,
    });
  } catch (err) {
    console.error("Outlook sync error:", err);
    return NextResponse.json(
      { error: "Sync failed. Try reconnecting Outlook." },
      { status: 500 }
    );
  }
}
