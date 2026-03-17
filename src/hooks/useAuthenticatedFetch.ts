"use client";

import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns fetchWithAuth that adds X-User-Id header for user-scoped API calls.
 * Use this for all data/outlook API requests.
 */
export function useAuthenticatedFetch() {
  const { user } = useAuth();

  const fetchWithAuth = useCallback(
    async (url: string, options?: RequestInit) => {
      const headers = new Headers(options?.headers);
      if (user?.uid) {
        headers.set("X-User-Id", user.uid);
      }
      return fetch(url, { ...options, headers, credentials: "include" });
    },
    [user?.uid]
  );

  return { fetchWithAuth, userId: user?.uid };
}
