/**
 * GET /api/data/contacts?caseId=optional
 * Requires X-User-Id header or userId query (authenticated user)
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api";
import { getContacts } from "@/lib/data-store";

export async function GET(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const caseId = searchParams.get("caseId") ?? undefined;

  const contacts = await getContacts(userId, caseId);
  return NextResponse.json(contacts);
}
