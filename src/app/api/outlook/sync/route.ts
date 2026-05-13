/**
 * POST /api/outlook/sync
 * Fetches calendar events and mail from Microsoft Graph.
 * Query params:
 *   - date=YYYY-MM-DD (single day, default: today)
 *   - startDate=YYYY-MM-DD&endDate=YYYY-MM-DD (date range)
 *   - days=N (sync past N days including today)
 * Requires X-User-Id header or userId query.
 *
 * Email engagement: Graph does not expose “first opened at”. We approximate:
 * - email_read_estimated when a synced inbox row goes from observed unread→read.
 * - email_draft_edited when a draft’s lastModified advances between syncs (interval spans touches).
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api";
import { saveRawEvent } from "@/lib/event-store";
import {
  hasRawEventByGraphId,
  findRawEventByGraphId,
  mergeRawEventMetadata,
  getOutlookDraftSnapshots,
  saveOutlookDraftSnapshots,
  hasRawEventByDocId,
} from "@/lib/data-store";
import type { RawEvent } from "@/types";
import {
  GRAPH_BASE,
  getOutlookGraphAccessToken,
  persistRefreshedOutlookTokens,
} from "@/lib/outlook-token-session";
import { getOutlookConnectionDiagnostics } from "@/lib/outlook-store";
import { outlookStableEventDocId } from "@/lib/outlook-engagement-ids";

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

type GraphMailMessage = {
  id: string;
  subject?: string;
  createdDateTime?: string;
  receivedDateTime?: string;
  sentDateTime?: string;
  from?: { emailAddress?: { address?: string } };
  toRecipients?: Array<{ emailAddress?: { address?: string } }>;
  internetMessageId?: string;
  hasAttachments?: boolean;
  conversationId?: string;
  isRead?: boolean;
  lastModifiedDateTime?: string;
};

type GraphDraftResponse = {
  value?: GraphMailMessage[];
  "@odata.nextLink"?: string;
};

export async function POST(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const { startDate, endDate } = parseDateRange(searchParams);

  const tokenResult = await getOutlookGraphAccessToken(request, userId);
  if (!tokenResult) {
    const diagnostics = await getOutlookConnectionDiagnostics(
      userId,
      request
    );
    return NextResponse.json(
      {
        error: "Outlook not connected. Connect in Settings first.",
        code: "NO_OUTLOOK_TOKENS",
        diagnostics,
      },
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

    const graphMailFields =
      "id,subject,receivedDateTime,sentDateTime,from,toRecipients,internetMessageId,hasAttachments,conversationId,isRead,lastModifiedDateTime";

    const inboxFilter = `receivedDateTime ge ${startIso} and receivedDateTime le ${endIso}`;
    const mailRes = await fetch(
      `${GRAPH_BASE}/me/mailFolders/inbox/messages?$select=${graphMailFields}&$top=500&$filter=${encodeURIComponent(inboxFilter)}&$orderby=receivedDateTime desc`,
      { headers }
    );

    if (mailRes.ok) {
      const mailData = (await mailRes.json()) as { value?: GraphMailMessage[] };

      for (const msg of mailData.value ?? []) {
        const existed = await hasRawEventByGraphId(userId, msg.id);

        const commonMeta = {
          from: msg.from?.emailAddress?.address,
          to: msg.toRecipients?.[0]?.emailAddress?.address,
          threadId: msg.internetMessageId,
          hasAttachment: msg.hasAttachments,
          attachmentCount: msg.hasAttachments ? 1 : 0,
          graphId: msg.id,
          conversationId: msg.conversationId,
          isReadOutlook: msg.isRead ?? false,
          outlookLastModified: msg.lastModifiedDateTime,
        };

        if (!existed) {
          const rawEvent: RawEvent = {
            id: generateId(),
            userId,
            source: "email",
            type: "email_received",
            title: msg.subject ?? "Email",
            timestampStart: msg.receivedDateTime ?? "",
            metadata: commonMeta,
            confidence: 0.8,
            createdAt: new Date().toISOString(),
          };
          await saveRawEvent(rawEvent);
          eventCount++;
          continue;
        }

        const received = await findRawEventByGraphId(
          userId,
          msg.id,
          "email_received"
        );
        if (!received) continue;

        const metaPrev = received.metadata ?? {};
        const prevObserved = metaPrev.isReadOutlook;

        await mergeRawEventMetadata(userId, received.id, {
          conversationId:
            msg.conversationId ??
            (metaPrev.conversationId as string | undefined),
          isReadOutlook: msg.isRead ?? false,
          outlookLastModified: msg.lastModifiedDateTime ?? metaPrev.outlookLastModified,
        });

        const wasDefinitelyUnread =
          typeof prevObserved === "boolean" ? prevObserved === false : false;
        const nowRead = msg.isRead === true;

        if (wasDefinitelyUnread && nowRead) {
          const subject = msg.subject ?? "Email";
          const readDocId = outlookStableEventDocId("eread", userId, [msg.id]);
          const alreadyRecorded = await hasRawEventByDocId(userId, readDocId);
          if (!alreadyRecorded) {
            const readAtGuess =
              msg.lastModifiedDateTime ?? new Date().toISOString();
            const rawRead: RawEvent = {
              id: readDocId,
              userId,
              source: "email",
              type: "email_read_estimated",
              title: `Read · ${subject}`,
              description:
                "Inferred unread→read between syncs (Microsoft Graph has no precise open timestamp). Uses lastModified or sync time as a coarse anchor.",
              timestampStart: readAtGuess,
              metadata: {
                readOfGraphId: msg.id,
                conversationId: msg.conversationId,
                graphLastModifiedAt: msg.lastModifiedDateTime,
                from: msg.from?.emailAddress?.address,
              },
              confidence: 0.55,
              createdAt: new Date().toISOString(),
            };
            await saveRawEvent(rawRead);
            eventCount++;
          }
        }
      }
    }

    const sentFilter = `sentDateTime ge ${startIso} and sentDateTime le ${endIso}`;
    const sentRes = await fetch(
      `${GRAPH_BASE}/me/mailFolders/sentitems/messages?$select=${graphMailFields}&$top=500&$filter=${encodeURIComponent(sentFilter)}&$orderby=sentDateTime desc`,
      { headers }
    );

    if (sentRes.ok) {
      const sentData = (await sentRes.json()) as {
        value?: GraphMailMessage[];
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
          timestampStart: msg.sentDateTime ?? "",
          metadata: {
            from: msg.from?.emailAddress?.address,
            to: msg.toRecipients?.[0]?.emailAddress?.address,
            threadId: msg.internetMessageId,
            hasAttachment: msg.hasAttachments,
            attachmentCount: msg.hasAttachments ? 1 : 0,
            graphId: msg.id,
            conversationId: msg.conversationId,
          },
          confidence: 0.8,
          createdAt: new Date().toISOString(),
        };
        await saveRawEvent(rawEvent);
        eventCount++;
      }
    }

    const prevDraftSnapshots = await getOutlookDraftSnapshots(userId);
    const draftSelect =
      "id,subject,createdDateTime,lastModifiedDateTime,sentDateTime,receivedDateTime,conversationId";
    let draftsUrl: string | null =
      `${GRAPH_BASE}/me/mailFolders/drafts/messages?$select=${draftSelect}&$top=250&$orderby=lastModifiedDateTime desc`;

    const nextSnapshots: Record<string, string> = {};

    while (draftsUrl) {
      const dRes = await fetch(draftsUrl, { headers });
      if (!dRes.ok) break;
      const dJson = (await dRes.json()) as GraphDraftResponse;
      const nowIso = new Date().toISOString();

      for (const d of dJson.value ?? []) {
        const lm = d.lastModifiedDateTime ?? d.createdDateTime ?? nowIso;
        const prevLm = prevDraftSnapshots[d.id];

        nextSnapshots[d.id] = lm;

        if (
          typeof prevLm === "string" &&
          prevLm !== lm &&
          new Date(prevLm).getTime() !== new Date(lm).getTime()
        ) {
          const docId = outlookStableEventDocId("edraftev", userId, [
            d.id,
            prevLm,
            lm,
          ]);
          if (!(await hasRawEventByDocId(userId, docId))) {
            const subj = d.subject ?? "(no subject)";
            const draftEv: RawEvent = {
              id: docId,
              userId,
              source: "email",
              type: "email_draft_edited",
              title: `Draft edited · ${subj}`,
              description:
                "Interval between successive draft saves seen on Outlook sync (approximate authoring time slice).",
              timestampStart: prevLm < lm ? prevLm : lm,
              timestampEnd: prevLm < lm ? lm : prevLm,
              metadata: {
                draftGraphId: d.id,
                conversationId: d.conversationId,
              },
              confidence: 0.5,
              createdAt: new Date().toISOString(),
            };
            await saveRawEvent(draftEv);
            eventCount++;
          }
        }
      }

      draftsUrl = dJson["@odata.nextLink"] ?? null;
    }

    await saveOutlookDraftSnapshots(userId, nextSnapshots);

    const response = NextResponse.json({
      success: true,
      startDate,
      endDate,
      eventsSynced: eventCount,
    });
    await persistRefreshedOutlookTokens(
      response,
      request,
      userId,
      tokenResult.refreshed,
      tokenResult.tokens
    );
    return response;
  } catch (err) {
    console.error("Outlook sync error:", err);
    return NextResponse.json(
      { error: "Sync failed. Try reconnecting Outlook." },
      { status: 500 }
    );
  }
}
