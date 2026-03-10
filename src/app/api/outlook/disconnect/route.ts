/**
 * POST /api/outlook/disconnect?userId=demo-user
 * Disconnects Outlook and clears stored tokens
 */

import { NextRequest, NextResponse } from "next/server";
import { clearOutlookTokens } from "@/lib/outlook-store";

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? "demo-user";

  clearOutlookTokens(userId);

  return NextResponse.json({ success: true });
}
