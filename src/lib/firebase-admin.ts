/**
 * Firebase Admin SDK for server-side (API routes)
 * When not configured, uses in-memory mock for demo.
 *
 * Production (e.g. Vercel): set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL,
 * FIREBASE_ADMIN_PRIVATE_KEY (private key env may use "\\n" for newlines).
 *
 * Local: optional FIREBASE_ADMIN_SDK_JSON_PATH=my-key.json relative to repo root —
 * gitignore *-firebase-adminsdk*.json; never commit the JSON file.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { RawEvent } from "@/types";

const mockRawEvents: Map<string, RawEvent> = new Map();

export function getMockRawEvents(): RawEvent[] {
  return Array.from(mockRawEvents.values());
}

export function addMockRawEvent(event: RawEvent): void {
  mockRawEvents.set(event.id, event);
}

let db: import("@google-cloud/firestore").Firestore | null = null;

type Cred = { projectId: string; clientEmail: string; privateKey: string };

function normalizePrivateKey(raw: string): string {
  return raw.replace(/\\n/g, "\n");
}

function loadCredentialFromRepoJson(): Cred | null {
  const rel = process.env.FIREBASE_ADMIN_SDK_JSON_PATH?.trim();
  if (!rel) return null;
  try {
    const full = join(process.cwd(), rel);
    if (!existsSync(full)) return null;
    const j = JSON.parse(readFileSync(full, "utf8")) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    const projectId = j.project_id ?? "";
    const clientEmail = j.client_email ?? "";
    const privateKey = j.private_key ?? "";
    if (!projectId || !clientEmail || !privateKey) return null;
    return { projectId, clientEmail, privateKey };
  } catch {
    return null;
  }
}

function resolveCredentials(): Cred | null {
  const fromFile = loadCredentialFromRepoJson();
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID?.trim() ||
    fromFile?.projectId ||
    "";
  const clientEmail =
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim() ||
    fromFile?.clientEmail ||
    "";
  const pkEnv = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.trim();
  const privateKey = pkEnv
    ? normalizePrivateKey(pkEnv)
    : fromFile?.privateKey
      ? normalizePrivateKey(fromFile.privateKey)
      : "";
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

async function initFirebaseAdmin(): Promise<typeof db> {
  if (db) return db;
  const cred = resolveCredentials();
  if (!cred) {
    return null;
  }
  try {
    const { getApps, initializeApp, cert } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    if (getApps().length === 0) {
      initializeApp({
        projectId: cred.projectId,
        credential: cert({
          projectId: cred.projectId,
          clientEmail: cred.clientEmail,
          privateKey: cred.privateKey,
        }),
      });
    }
    db = getFirestore();
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      /* settings() may only apply once per process */
    }
    return db;
  } catch (e) {
    console.warn("Firebase Admin init failed:", e);
    return null;
  }
}

export async function getDb() {
  return initFirebaseAdmin();
}
