/**
 * GET /api/outlook/status?userId=demo-user
 * Returns whether Outlook is connected for the user
 */

import { NextRequest, NextResponse } from "next/server";
import { isOutlookConnected } from "@/lib/outlook-store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? "demo-user";

  return NextResponse.json({
    connected: isOutlookConnected(userId),
  });
}
