"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  readStoredOutlookOAuthUid,
} from "@/lib/outlook-oauth-bridge";

/**
 * Ensures Firebase uid is carried as a query param (fallback if headers strip on redirects).
 */
function withOutlookUserId(url: string, uid: string | undefined): string {
  if (typeof window === "undefined" || !uid || !url.startsWith("/api/outlook")) {
    return url;
  }
  const u = new URL(url, window.location.origin);
  if (!u.searchParams.has("userId")) {
    u.searchParams.set("userId", uid);
  }
  return `${u.pathname}${u.search}`;
}

/**
 * Returns fetchWithAuth that adds X-User-Id header for user-scoped API calls.
 * Outlook routes also get ?userId= so /api/outlook/sync works after OAuth redirect
 * when auth hydration briefly lags behind the first POST.
 */
export function useAuthenticatedFetch() {
  const { user, loading: authLoading } = useAuth();
  /** Avoid reading sessionStorage before mount (hydration-safe). */
  const [storedUid, setStoredUid] = useState<string | undefined>(undefined);
  useEffect(() => {
    setStoredUid(readStoredOutlookOAuthUid());
  }, []);
  /** Refresh stash when Firebase user changes (cross-tab logout is irrelevant). */
  useEffect(() => {
    setStoredUid(readStoredOutlookOAuthUid());
  }, [user?.uid]);

  const bridgedUid = user?.uid ?? storedUid ?? undefined;

  const fetchWithAuth = useCallback(
    async (url: string, options?: RequestInit) => {
      const uid = user?.uid ?? readStoredOutlookOAuthUid();
      const resolved = withOutlookUserId(url, uid);
      const headers = new Headers(options?.headers);
      if (uid) {
        headers.set("X-User-Id", uid);
      }
      return fetch(resolved, { ...options, headers, credentials: "include" });
    },
    [user?.uid]
  );

  return { fetchWithAuth, userId: bridgedUid, authLoading };
}
