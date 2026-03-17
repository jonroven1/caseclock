/**
 * GET /api/auth/outlook/callback
 * Microsoft redirects here after user signs in. Exchange code for tokens.
 */

import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/outlook-auth";
import { setOutlookTokensInResponse } from "@/lib/outlook-store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (!state) {
    return NextResponse.redirect(
      new URL("/settings?outlook_error=missing_state", request.url)
    );
  }

  if (error) {
    console.error("Outlook OAuth error:", error);
    return NextResponse.redirect(
      new URL(`/settings?outlook_error=${error}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/settings?outlook_error=no_code", request.url)
    );
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
    const redirectUri = `${baseUrl}/api/auth/outlook/callback`;

    const data = await exchangeCodeForTokens(code, redirectUri);

    const userId = state;
    let userEmail: string | undefined;
    try {
      const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (meRes.ok) {
        const me = (await meRes.json()) as { mail?: string; userPrincipalName?: string };
        userEmail = me.mail ?? me.userPrincipalName;
      }
    } catch {
      /* ignore */
    }

    const tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
      ...(userEmail && { email: userEmail }),
    };

    const response = NextResponse.redirect(
      new URL("/settings?outlook_connected=1", request.url)
    );
    await setOutlookTokensInResponse(response, request, userId, tokens);
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Outlook callback error:", msg);
    const url = new URL("/settings", request.url);
    url.searchParams.set("outlook_error", "exchange_failed");
    url.searchParams.set("error_detail", msg.slice(0, 200));
    return NextResponse.redirect(url);
  }
}
