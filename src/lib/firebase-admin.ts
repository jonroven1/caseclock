/**
 * Firebase Admin SDK for server-side (API routes)
 * When not configured, uses in-memory mock for demo
 */

import type { RawEvent } from "@/types";

// In-memory store for demo when Firebase Admin is not configured
const mockRawEvents: Map<string, RawEvent> = new Map();

export function getMockRawEvents(): RawEvent[] {
  return Array.from(mockRawEvents.values());
}

export function addMockRawEvent(event: RawEvent): void {
  mockRawEvents.set(event.id, event);
}

// Firebase Admin - lazy init
let db: import("@google-cloud/firestore").Firestore | null = null;

async function initFirebaseAdmin(): Promise<typeof db> {
  if (db) return db;
  if (
    !process.env.FIREBASE_ADMIN_PROJECT_ID ||
    !process.env.FIREBASE_ADMIN_PRIVATE_KEY
  ) {
    return null;
  }
  try {
    const { getApps, initializeApp, cert } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    if (getApps().length === 0) {
      initializeApp({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        credential: cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "").replace(
            /\\n/g,
            "\n"
          ),
        }),
      });
    }
    db = getFirestore();
    return db;
  } catch (e) {
    console.warn("Firebase Admin init failed:", e);
    return null;
  }
}

export async function getDb() {
  return initFirebaseAdmin();
}
