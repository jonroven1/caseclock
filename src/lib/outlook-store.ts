/**
 * Store for Outlook/Microsoft OAuth tokens per user.
 * Persists to Firestore when configured, else cookies for serverless.
 */

import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/firestore";

export interface OutlookTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
  email?: string;
}

const COOKIE_NAME = "outlook_tokens";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function getSecret(): string {
  return (
    process.env.OUTLOOK_COOKIE_SECRET ||
    process.env.CRYPTO_SECRET ||
    "dev-secret-change-in-production"
  );
}

function sign(payload: string): string {
  const secret = getSecret();
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${sig}.${Buffer.from(payload, "utf8").toString("base64url")}`;
}

function verify(signed: string): string | null {
  const dot = signed.indexOf(".");
  if (dot < 0) return null;
  const sig = signed.slice(0, dot);
  const payload = signed.slice(dot + 1);
  const expected = createHmac("sha256", getSecret())
    .update(Buffer.from(payload, "base64url").toString("utf8"))
    .digest("base64url");
  try {
    if (timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return Buffer.from(payload, "base64url").toString("utf8");
    }
  } catch {
    return null;
  }
  return null;
}

type TokenMap = Record<string, OutlookTokens>;

function getTokenMapFromRequest(request: NextRequest): TokenMap {
  const raw = request.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return {};
  const json = verify(raw);
  if (!json) return {};
  try {
    return JSON.parse(json) as TokenMap;
  } catch {
    return {};
  }
}

/** Read tokens - Firestore first, then cookie, then null */
export async function getOutlookTokens(
  userId: string,
  request?: NextRequest
): Promise<OutlookTokens | null> {
  const db = await getDb();
  if (db) {
    const doc = await db
      .collection(COLLECTIONS.OUTLOOK_TOKENS)
      .doc(userId)
      .get();
    if (doc.exists) {
      return doc.data() as OutlookTokens;
    }
  }

  if (request) {
    const map = getTokenMapFromRequest(request);
    return map[userId] ?? null;
  }
  return null;
}

/** Write tokens - Firestore when configured, else cookie */
export async function setOutlookTokensInResponse(
  response: NextResponse,
  request: NextRequest,
  userId: string,
  tokens: OutlookTokens
): Promise<void> {
  const db = await getDb();
  if (db) {
    await db.collection(COLLECTIONS.OUTLOOK_TOKENS).doc(userId).set(tokens);
  }

  const map = getTokenMapFromRequest(request);
  map[userId] = tokens;
  const signed = sign(JSON.stringify(map));
  response.cookies.set(COOKIE_NAME, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

/** Clear tokens - Firestore and cookie */
export async function clearOutlookTokensInResponse(
  response: NextResponse,
  request: NextRequest,
  userId: string
): Promise<void> {
  const db = await getDb();
  if (db) {
    await db.collection(COLLECTIONS.OUTLOOK_TOKENS).doc(userId).delete();
  }

  const map = getTokenMapFromRequest(request);
  delete map[userId];
  const hasOthers = Object.keys(map).length > 0;
  const signed = hasOthers ? sign(JSON.stringify(map)) : "";
  response.cookies.set(COOKIE_NAME, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: hasOthers ? COOKIE_MAX_AGE : 0,
    path: "/",
  });
}

export function setOutlookTokens(userId: string, tokens: OutlookTokens): void {
  // Sync write for callback - fire and forget
  getDb().then((db) => {
    if (db) {
      db.collection(COLLECTIONS.OUTLOOK_TOKENS).doc(userId).set(tokens);
    }
  });
}

export function clearOutlookTokens(userId: string): void {
  getDb().then((db) => {
    if (db) {
      db.collection(COLLECTIONS.OUTLOOK_TOKENS).doc(userId).delete();
    }
  });
}

export async function isOutlookConnected(
  userId: string,
  request?: NextRequest
): Promise<boolean> {
  const t = await getOutlookTokens(userId, request);
  if (!t) return false;
  return t.expiresAt > Date.now() / 1000 + 300;
}
