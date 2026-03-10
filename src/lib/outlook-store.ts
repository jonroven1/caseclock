/**
 * Store for Outlook/Microsoft OAuth tokens per user.
 * In production, persist to Firestore.
 */

export interface OutlookTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
  email?: string;
}

const tokensByUser = new Map<string, OutlookTokens>();

export function getOutlookTokens(userId: string): OutlookTokens | null {
  return tokensByUser.get(userId) ?? null;
}

export function setOutlookTokens(userId: string, tokens: OutlookTokens): void {
  tokensByUser.set(userId, tokens);
}

export function clearOutlookTokens(userId: string): void {
  tokensByUser.delete(userId);
}

export function isOutlookConnected(userId: string): boolean {
  const t = tokensByUser.get(userId);
  if (!t) return false;
  // Consider expired if within 5 min of expiry
  return t.expiresAt > Date.now() / 1000 + 300;
}
