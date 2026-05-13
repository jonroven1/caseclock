/**
 * Shared Outlook → Microsoft Graph token refresh and optional /me email hydration.
 */

import type { NextRequest, NextResponse } from "next/server";
import {
  getOutlookTokens,
  setOutlookTokensInResponse,
} from "@/lib/outlook-store";
import { refreshAccessToken } from "@/lib/outlook-auth";
import { getSettings, saveSettings } from "@/lib/data-store";
import type { OutlookTokens } from "@/lib/outlook-store";

export const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export async function getOutlookGraphAccessToken(
  request: NextRequest,
  userId: string
): Promise<{ accessToken: string; refreshed: boolean; tokens?: OutlookTokens } | null> {
  let tokens = await getOutlookTokens(userId, request);
  if (!tokens) return null;

  let refreshed = false;
  if (tokens.expiresAt <= Math.floor(Date.now() / 1000) + 300) {
    const data = await refreshAccessToken(tokens.refreshToken);
    tokens = {
      ...tokens,
      accessToken: data.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
    };
    refreshed = true;
  }

  if (!tokens.email) {
    try {
      const meRes = await fetch(`${GRAPH_BASE}/me`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      if (meRes.ok) {
        const me = (await meRes.json()) as { mail?: string; userPrincipalName?: string };
        const email = me.mail ?? me.userPrincipalName;
        if (email) {
          tokens = { ...tokens, email };
          refreshed = true;
          const settings = await getSettings(userId);
          if (!settings.userEmail) {
            await saveSettings({ ...settings, userEmail: email });
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  return { accessToken: tokens.accessToken, refreshed, tokens };
}

export async function persistRefreshedOutlookTokens(
  response: NextResponse,
  request: NextRequest,
  userId: string,
  refreshed: boolean,
  tokens: OutlookTokens | undefined
): Promise<void> {
  if (refreshed && tokens) {
    await setOutlookTokensInResponse(response, request, userId, tokens);
  }
}
