/**
 * GET /api/auth/outlook
 * Initiates Microsoft OAuth - redirects to Microsoft login
 */

import { NextRequest, NextResponse } from "next/server";
import { getOutlookAuthUrl } from "@/lib/outlook-auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") ?? "demo-user";

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
