/**
 * GET /api/data/events?date=YYYY-MM-DD&userId=demo-user
 * Returns raw events for a given day
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { getMockRawEvents } from "@/lib/firebase-admin";
import { demoStore } from "@/lib/demo-store";
import { COLLECTIONS } from "@/lib/firestore";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const userId = searchParams.get("userId") ?? "demo-user";

  if (!date) {
    return NextResponse.json(
      { error: "Missing date parameter" },
      { status: 400 }
    );
  }

  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);

  const db = await getDb();
  if (db) {
    const snapshot = await db
      .collection(COLLECTIONS.RAW_EVENTS)
      .where("userId", "==", userId)
      .get();

    const events = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>))
      .filter((e) => {
        const ts = e.timestampStart as string | undefined;
        const t = new Date(ts ?? 0).getTime();
        return t >= dayStart.getTime() && t <= dayEnd.getTime();
      })
      .sort(
        (a, b) =>
          new Date((a.timestampStart as string) ?? 0).getTime() -
          new Date((b.timestampStart as string) ?? 0).getTime()
      );
    return NextResponse.json(events);
  }

  const mock = getMockRawEvents();
  const allEvents = mock.length > 0 ? mock : demoStore.rawEvents;
  const filtered = allEvents
    .filter((e) => e.userId === userId)
    .filter((e) => {
      const t = new Date(e.timestampStart).getTime();
      return t >= dayStart.getTime() && t <= dayEnd.getTime();
    })
    .sort(
      (a, b) =>
        new Date(a.timestampStart).getTime() -
        new Date(b.timestampStart).getTime()
    );
  return NextResponse.json(filtered);
}
