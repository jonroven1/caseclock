/**
 * GET /api/outlook/status
 * Returns whether Outlook is connected for the user.
 * Requires X-User-Id header or userId query.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  isOutlookConnected,
  getOutlookConnectionDiagnostics,
} from "@/lib/outlook-store";
import { getUserIdFromRequest } from "@/lib/api";

export async function GET(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connected = await isOutlookConnected(userId, request);
  const diagnostics = await getOutlookConnectionDiagnostics(userId, request);
  return NextResponse.json({ connected, diagnostics });
}
