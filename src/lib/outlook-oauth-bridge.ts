/** Survives full-page Microsoft redirects; clears after OAuth + sync settles on sign-out. */
export const OUTLOOK_OAUTH_UID_KEY = "caseclock_outlook_oauth_uid";

export function stashOutlookOAuthUserId(uid: string): void {
  try {
    sessionStorage.setItem(OUTLOOK_OAUTH_UID_KEY, uid);
  } catch {
    /* quota / privacy mode */
  }
}

export function clearOutlookOAuthBridge(): void {
  try {
    sessionStorage.removeItem(OUTLOOK_OAUTH_UID_KEY);
  } catch {
    /* ignore */
  }
}

export function readStoredOutlookOAuthUid(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return sessionStorage.getItem(OUTLOOK_OAUTH_UID_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Prefer live Firebase uid; fallback to stash from Connect click (covers slow IndexedDB hydrate). */
export function resolveAuthUserId(firebaseUid: string | undefined): string | undefined {
  return firebaseUid ?? readStoredOutlookOAuthUid();
}
