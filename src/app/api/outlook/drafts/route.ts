/**
 * GET /api/outlook/drafts
 * Lists draft messages from Microsoft Graph with created/modified timestamps.
 * Requires X-User-Id header or userId query (same as /api/outlook/sync).
 *
 * Query:
 *   - top=N (page size, default 100, max 500 per Graph page — we follow @odata.nextLink)
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api";
import {
  GRAPH_BASE,
  getOutlookGraphAccessToken,
  persistRefreshedOutlookTokens,
} from "@/lib/outlook-token-session";

type GraphDraftMessage = {
  id: string;
  subject?: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
};

type GraphDraftListResponse = {
  value?: GraphDraftMessage[];
  "@odata.nextLink"?: string;
};

export async function GET(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokenResult = await getOutlookGraphAccessToken(request, userId);
  if (!tokenResult) {
    return NextResponse.json(
      { error: "Outlook not connected. Connect in Settings first." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const topParam = searchParams.get("top");
  const pageTop = Math.min(500, Math.max(1, parseInt(topParam ?? "100", 10) || 100));

  const headers = {
    Authorization: `Bearer ${tokenResult.accessToken}`,
    "Content-Type": "application/json",
  };

  const select =
    "id,subject,createdDateTime,lastModifiedDateTime,sentDateTime,receivedDateTime";
  let url: string | null =
    `${GRAPH_BASE}/me/mailFolders/drafts/messages?$select=${select}&$top=${pageTop}&$orderby=lastModifiedDateTime desc`;

  const drafts: GraphDraftMessage[] = [];
  const errors: string[] = [];

  try {
    while (url) {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const body = await res.text();
        errors.push(`Graph ${res.status}: ${body.slice(0, 500)}`);
        break;
      }
      const data = (await res.json()) as GraphDraftListResponse;
      for (const msg of data.value ?? []) {
        drafts.push(msg);
      }
      url = data["@odata.nextLink"] ?? null;
    }

    let mailbox: string | undefined;
    try {
      const meRes = await fetch(`${GRAPH_BASE}/me?$select=mail,userPrincipalName`, {
        headers,
      });
      if (meRes.ok) {
        const me = (await meRes.json()) as {
          mail?: string;
          userPrincipalName?: string;
        };
        mailbox = me.mail ?? me.userPrincipalName;
      }
    } catch {
      /* ignore */
    }

    const response = NextResponse.json({
      mailbox,
      count: drafts.length,
      drafts: drafts.map((d) => ({
        subject: d.subject ?? "(no subject)",
        createdDateTime: d.createdDateTime,
        lastModifiedDateTime: d.lastModifiedDateTime,
      })),
      errors: errors.length ? errors : undefined,
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
    console.error("Outlook drafts error:", err);
    return NextResponse.json(
      { error: "Failed to load drafts. Try reconnecting Outlook." },
      { status: 500 }
    );
  }
}
