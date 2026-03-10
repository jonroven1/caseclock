/**
 * GET /api/data/cases?userId=demo-user
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { demoStore } from "@/lib/demo-store";
import { COLLECTIONS } from "@/lib/firestore";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? "demo-user";

  const db = await getDb();
  if (db) {
    const snapshot = await db
      .collection(COLLECTIONS.CASES)
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();
    const cases = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json(cases);
  }

  return NextResponse.json(
    demoStore.cases.filter((c) => c.userId === userId)
  );
}
