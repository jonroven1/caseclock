/**
 * Event store - writes raw events to Firestore or demo store
 */

import { getDb, addMockRawEvent } from "./firebase-admin";
import { demoStore } from "./demo-store";
import { COLLECTIONS } from "./firestore";
import type { RawEvent } from "@/types";

export async function saveRawEvent(event: RawEvent): Promise<void> {
  const db = await getDb();
  if (db) {
    await db.collection(COLLECTIONS.RAW_EVENTS).doc(event.id).set(event);
  } else {
    addMockRawEvent(event);
    demoStore.rawEvents.push(event);
  }
}
