/**
 * Unified data store - Firestore when configured, else demo store.
 * All app data flows through here for consistent Firebase persistence.
 */

import { getDb } from "@/lib/firebase-admin";
import { getMockRawEvents } from "@/lib/firebase-admin";
import { demoStore } from "@/lib/demo-store";
import { COLLECTIONS } from "@/lib/firestore";
import type {
  Case,
  Contact,
  RawEvent,
  SuggestedEntry,
  TimeEntry,
  UserSettings,
} from "@/types";

export async function getCases(userId: string): Promise<Case[]> {
  const db = await getDb();
  if (db) {
    const snap = await db
      .collection(COLLECTIONS.CASES)
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Case));
  }
  return demoStore.cases.filter((c) => c.userId === userId);
}

export async function getContacts(
  userId: string,
  caseId?: string
): Promise<Contact[]> {
  const db = await getDb();
  if (db) {
    let q = db
      .collection(COLLECTIONS.CONTACTS)
      .where("userId", "==", userId);
    if (caseId) q = q.where("caseId", "==", caseId) as typeof q;
    const snap = await q.orderBy("name", "asc").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Contact));
  }
  let contacts = demoStore.contacts.filter((c) => c.userId === userId);
  if (caseId) contacts = contacts.filter((c) => c.caseId === caseId);
  return contacts;
}

export async function getRawEventsByIds(
  userId: string,
  ids: string[]
): Promise<RawEvent[]> {
  if (ids.length === 0) return [];
  const db = await getDb();
  if (db) {
    const results = await Promise.all(
      ids.map((id) =>
        db.collection(COLLECTIONS.RAW_EVENTS).doc(id).get()
      )
    );
    return results
      .filter((d) => d.exists)
      .map((d) => ({ id: d.id, ...d.data() } as RawEvent))
      .filter((e) => e.userId === userId);
  }
  const mock = getMockRawEvents();
  const source = mock.length > 0 ? mock : demoStore.rawEvents;
  const idSet = new Set(ids);
  return source.filter((e) => e.userId === userId && idSet.has(e.id));
}

export async function getRawEvents(
  userId: string,
  date: string
): Promise<RawEvent[]> {
  const db = await getDb();
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);

  if (db) {
    const snap = await db
      .collection(COLLECTIONS.RAW_EVENTS)
      .where("userId", "==", userId)
      .get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as RawEvent))
      .filter((e) => {
        const t = new Date(e.timestampStart).getTime();
        return t >= dayStart.getTime() && t <= dayEnd.getTime();
      })
      .sort(
        (a, b) =>
          new Date(a.timestampStart).getTime() -
          new Date(b.timestampStart).getTime()
      );
  }

  const mock = getMockRawEvents();
  const source = mock.length > 0 ? mock : demoStore.rawEvents;
  return source
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
}

export async function getSuggestedEntries(
  userId: string,
  date: string
): Promise<SuggestedEntry[]> {
  const db = await getDb();
  if (db) {
    const snap = await db
      .collection(COLLECTIONS.SUGGESTED_ENTRIES)
      .where("userId", "==", userId)
      .where("date", "==", date)
      .orderBy("startTime", "asc")
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SuggestedEntry));
  }
  return demoStore.suggestedEntries.filter(
    (e) => e.userId === userId && e.date === date
  );
}

export async function getTimeEntries(
  userId: string,
  date: string
): Promise<TimeEntry[]> {
  const db = await getDb();
  if (db) {
    const snap = await db
      .collection(COLLECTIONS.TIME_ENTRIES)
      .where("userId", "==", userId)
      .where("date", "==", date)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TimeEntry));
  }
  return demoStore.timeEntries.filter(
    (e) => e.userId === userId && e.date === date
  );
}

export async function getSettings(userId: string): Promise<UserSettings> {
  const db = await getDb();
  if (db) {
    const doc = await db
      .collection(COLLECTIONS.SETTINGS)
      .doc(userId)
      .get();
    if (doc.exists) {
      return doc.data() as UserSettings;
    }
  }
  return (
    demoStore.settings[userId] ?? {
      userId,
      roundCallsToTenth: true,
      defaultReplyTenths: 0.1,
      defaultTravelBilling: 0.5,
      autoApproveCalendarEvents: false,
      timezone: "America/New_York",
    }
  );
}

export async function saveCase(c: Case): Promise<void> {
  const db = await getDb();
  if (db) {
    await db.collection(COLLECTIONS.CASES).doc(c.id).set(c);
  } else {
    const idx = demoStore.cases.findIndex((x) => x.id === c.id);
    if (idx >= 0) demoStore.cases[idx] = c;
    else demoStore.cases.push(c);
  }
}

export async function saveSuggestedEntry(e: SuggestedEntry): Promise<void> {
  const db = await getDb();
  if (db) {
    await db.collection(COLLECTIONS.SUGGESTED_ENTRIES).doc(e.id).set(e);
  } else {
    const idx = demoStore.suggestedEntries.findIndex((x) => x.id === e.id);
    if (idx >= 0) demoStore.suggestedEntries[idx] = e;
    else demoStore.suggestedEntries.push(e);
  }
}

export async function deleteSuggestedEntries(ids: string[]): Promise<void> {
  const db = await getDb();
  if (db) {
    const batch = db.batch();
    for (const id of ids) {
      batch.delete(db.collection(COLLECTIONS.SUGGESTED_ENTRIES).doc(id));
    }
    await batch.commit();
  } else {
    demoStore.suggestedEntries = demoStore.suggestedEntries.filter(
      (e) => !ids.includes(e.id)
    );
  }
}

export async function saveTimeEntry(e: TimeEntry): Promise<void> {
  const db = await getDb();
  if (db) {
    await db.collection(COLLECTIONS.TIME_ENTRIES).doc(e.id).set(e);
  } else {
    demoStore.timeEntries.push(e);
  }
}

export async function saveSettings(s: UserSettings): Promise<void> {
  const db = await getDb();
  if (db) {
    await db.collection(COLLECTIONS.SETTINGS).doc(s.userId).set(s);
  } else {
    demoStore.settings[s.userId] = s;
  }
}

export async function saveContact(c: Contact): Promise<void> {
  const db = await getDb();
  if (db) {
    await db.collection(COLLECTIONS.CONTACTS).doc(c.id).set(c);
  } else {
    const idx = demoStore.contacts.findIndex((x) => x.id === c.id);
    if (idx >= 0) demoStore.contacts[idx] = c;
    else demoStore.contacts.push(c);
  }
}

export async function saveRawEvent(e: RawEvent): Promise<void> {
  const db = await getDb();
  if (db) {
    await db.collection(COLLECTIONS.RAW_EVENTS).doc(e.id).set(e);
  } else {
    demoStore.rawEvents.push(e);
  }
}

/** Check if a raw event with this graphId already exists for the user (prevents duplicate sync) */
export async function hasRawEventByGraphId(
  userId: string,
  graphId: string
): Promise<boolean> {
  if (!graphId) return false;
  const db = await getDb();
  if (db) {
    const snap = await db
      .collection(COLLECTIONS.RAW_EVENTS)
      .where("userId", "==", userId)
      .where("metadata.graphId", "==", graphId)
      .limit(1)
      .get();
    return !snap.empty;
  }
  const mock = getMockRawEvents();
  const source = mock.length > 0 ? mock : demoStore.rawEvents;
  return source.some(
    (e) => e.userId === userId && e.metadata?.graphId === graphId
  );
}

export async function getSuggestedEntryById(
  id: string
): Promise<SuggestedEntry | null> {
  const db = await getDb();
  if (db) {
    const doc = await db.collection(COLLECTIONS.SUGGESTED_ENTRIES).doc(id).get();
    return doc.exists ? ({ id: doc.id, ...doc.data() } as SuggestedEntry) : null;
  }
  return demoStore.suggestedEntries.find((e) => e.id === id) ?? null;
}
