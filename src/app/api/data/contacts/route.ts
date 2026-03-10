/**
 * GET /api/data/contacts?userId=demo-user&caseId=optional
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { demoStore } from "@/lib/demo-store";
import { COLLECTIONS } from "@/lib/firestore";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? "demo-user";
  const caseId = searchParams.get("caseId");

  const db = await getDb();
  if (db) {
    let q = db
      .collection(COLLECTIONS.CONTACTS)
      .where("userId", "==", userId);
    if (caseId) q = q.where("caseId", "==", caseId) as typeof q;
    const snapshot = await q.orderBy("name", "asc").get();
    const contacts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json(contacts);
  }

  let contacts = demoStore.contacts.filter((c) => c.userId === userId);
  if (caseId) contacts = contacts.filter((c) => c.caseId === caseId);
  return NextResponse.json(contacts);
}
