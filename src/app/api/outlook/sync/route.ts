/**
 * POST /api/outlook/sync
 * Fetches calendar events and mail from Microsoft Graph.
 * Query params:
 *   - date=YYYY-MM-DD (single day, default: today)
 *   - startDate=YYYY-MM-DD&endDate=YYYY-MM-DD (date range)
 *   - days=N (sync past N days including today)
 * Requires X-User-Id header or userId query.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api";
import {
  getOutlookTokens,
  setOutlookTokensInResponse,
} from "@/lib/outlook-store";
import { refreshAccessToken } from "@/lib/outlook-auth";
import { saveRawEvent } from "@/lib/event-store";
import { hasRawEventByGraphId, getSettings, saveSettings } from "@/lib/data-store";
import type { OutlookTokens } from "@/lib/outlook-store";
import type { RawEvent } from "@/types";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function getValidAccessToken(
  request: NextRequest,
  userId: string
): Promise<{ accessToken: string; refreshed: boolean; tokens?: OutlookTokens } | null> {
  let tokens = await getOutlookTokens(userId, request);
  if (!tokens) return null;

  let refreshed = false;
  if (tokens.expiresAt <= Math.floor(Date.now() / 1000) + 300) {
    const data = await refreshAccessToken(tokens.refreshToken);
    tokens = {
      ...tokens,
      accessToken: data.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
    };
    refreshed = true;
  }

  // Fetch user email from Graph if not stored (for case email matching)
  if (!tokens.email) {
    try {
      const meRes = await fetch(`${GRAPH_BASE}/me`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      if (meRes.ok) {
        const me = (await meRes.json()) as { mail?: string; userPrincipalName?: string };
        const email = me.mail ?? me.userPrincipalName;
        if (email) {
          tokens = { ...tokens, email };
          refreshed = true; // persist updated tokens
          const settings = await getSettings(userId);
          if (!settings.userEmail) {
            await saveSettings({ ...settings, userEmail: email });
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  return { accessToken: tokens.accessToken, refreshed, tokens };
}

function generateId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function parseDateRange(searchParams: URLSearchParams): {
  startDate: string;
  endDate: string;
} {
  const today = new Date().toISOString().slice(0, 10);
  const days = searchParams.get("days");
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const dateParam = searchParams.get("date") ?? today;

  if (days) {
    const n = Math.min(90, Math.max(1, parseInt(days, 10) || 7));
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (n - 1));
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }
  if (startDateParam && endDateParam) {
    return {
      startDate: startDateParam,
      endDate: endDateParam,
    };
  }
  return { startDate: dateParam, endDate: dateParam };
}

export async function POST(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const { startDate, endDate } = parseDateRange(searchParams);

  const tokenResult = await getValidAccessToken(request, userId);
  if (!tokenResult) {
    return NextResponse.json(
      { error: "Outlook not connected. Connect in Settings first." },
      { status: 401 }
    );
  }

  const headers = {
    Authorization: `Bearer ${tokenResult.accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    const rangeStart = new Date(`${startDate}T00:00:00`);
    const rangeEnd = new Date(`${endDate}T23:59:59`);
    const startIso = rangeStart.toISOString();
    const endIso = rangeEnd.toISOString();
    let eventCount = 0;

    // Fetch calendar events for the range
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
        const exists = await hasRawEventByGraphId(userId, ev.id);
        if (exists) continue;
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
        eventCount++;
      }
    }

    // Fetch mail from inbox - filter by date range
    const inboxFilter = `receivedDateTime ge ${startIso} and receivedDateTime le ${endIso}`;
    const mailRes = await fetch(
      `${GRAPH_BASE}/me/mailFolders/inbox/messages?$top=500&$filter=${encodeURIComponent(inboxFilter)}&$orderby=receivedDateTime desc`,
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
        const exists = await hasRawEventByGraphId(userId, msg.id);
        if (exists) continue;
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
        eventCount++;
      }
    }

    // Fetch sent mail - filter by date range
    const sentFilter = `sentDateTime ge ${startIso} and sentDateTime le ${endIso}`;
    const sentRes = await fetch(
      `${GRAPH_BASE}/me/mailFolders/sentitems/messages?$top=500&$filter=${encodeURIComponent(sentFilter)}&$orderby=sentDateTime desc`,
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
        const exists = await hasRawEventByGraphId(userId, msg.id);
        if (exists) continue;
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
        eventCount++;
      }
    }

    const response = NextResponse.json({
      success: true,
      startDate,
      endDate,
      eventsSynced: eventCount,
    });
    if (tokenResult.refreshed && tokenResult.tokens) {
      await setOutlookTokensInResponse(
        response,
        request,
        userId,
        tokenResult.tokens
      );
    }
    return response;
  } catch (err) {
    console.error("Outlook sync error:", err);
    return NextResponse.json(
      { error: "Sync failed. Try reconnecting Outlook." },
      { status: 500 }
    );
  }
}
