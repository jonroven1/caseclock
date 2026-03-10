/**
 * GET /api/auth/outlook/callback
 * Microsoft redirects here after user signs in. Exchange code for tokens.
 */

import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/outlook-auth";
import { setOutlookTokens } from "@/lib/outlook-store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state") ?? "demo-user";
  const error = searchParams.get("error");

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
    setOutlookTokens(userId, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
    });

    return NextResponse.redirect(
      new URL("/settings?outlook_connected=1", request.url)
    );
  } catch (err) {
    console.error("Outlook callback error:", err);
    return NextResponse.redirect(
      new URL("/settings?outlook_error=exchange_failed", request.url)
    );
  }
}
