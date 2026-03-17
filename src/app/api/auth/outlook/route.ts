/**
 * GET /api/auth/outlook?userId=...
 * Initiates Microsoft OAuth - redirects to Microsoft login.
 * userId must be provided (authenticated user's uid).
 */

import { NextRequest, NextResponse } from "next/server";
import { getOutlookAuthUrl } from "@/lib/outlook-auth";
import { getUserIdFromRequest } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.redirect(
        new URL("/login?error=unauthorized", request.url)
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
    const redirectUri = `${baseUrl}/api/auth/outlook/callback`;

    const authUrl = getOutlookAuthUrl(redirectUri, userId);

    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("Outlook auth init error:", err);
    return NextResponse.redirect(
      new URL("/settings?outlook_error=config", request.url)
    );
  }
}
