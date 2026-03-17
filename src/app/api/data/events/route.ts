/**
 * GET /api/data/events?date=YYYY-MM-DD
 * Returns raw events for a given day. Requires X-User-Id header or userId query.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api";
import { getRawEvents } from "@/lib/data-store";

export async function GET(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json(
      { error: "Missing date parameter" },
      { status: 400 }
    );
  }

  const events = await getRawEvents(userId, date);
  return NextResponse.json(events);
}
