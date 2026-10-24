import { NextResponse, type NextRequest } from "next/server";
import { revokeAccessToken } from "@/lib/auth/google-oauth";
import { clearSessionCookie, evaluateSessionCookie, sessionCookieName } from "@/lib/auth/session";
import { safeEqual } from "@/lib/auth/seal";
import { apiError, isSameOrigin } from "@/lib/security/guard";

/** POST /api/auth/logout — revokes the Google token and clears the session cookie. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return apiError("csrf_failed", "Request origin is not allowed.", 403);
  const state = evaluateSessionCookie(request.cookies.get(sessionCookieName())?.value);
  if (state.status === "active") {
    const token = request.headers.get("x-csrf-token") ?? "";
    if (!safeEqual(token, state.session.csrf)) {
      return apiError("csrf_failed", "Security check failed. Please reload the page and try again.", 403);
    }
    await revokeAccessToken(state.session.accessToken);
  }
  // Expired or missing sessions are simply cleared.
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  clearSessionCookie(response);
  return response;
}
