/**
 * POST /api/outlook/disconnect
 * Disconnects Outlook and clears stored tokens.
 * Requires X-User-Id header or userId query.
 */

import { NextRequest, NextResponse } from "next/server";
import { clearOutlookTokensInResponse } from "@/lib/outlook-store";
import { getUserIdFromRequest } from "@/lib/api";

export async function POST(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  await clearOutlookTokensInResponse(response, request, userId);
  return response;
}
