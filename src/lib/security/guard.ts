import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getBaseUrl } from "@/lib/config";
import { evaluateSessionCookie, sessionCookieName, type Session } from "@/lib/auth/session";
import { safeEqual } from "@/lib/auth/seal";

export type ApiErrorCode =
  | "unauthenticated"
  | "session_expired"
  | "csrf_failed"
  | "rate_limited"
  | "invalid_request"
  | "validation_failed"
  | "payload_too_large"
  | "server_misconfigured"
  | "google_permission_denied"
  | "google_api_disabled"
  | "google_quota"
  | "google_not_found"
  | "google_unavailable"
  | "google_error"
  | "resume_unsafe";

export function apiError(code: ApiErrorCode, message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Rejects cross-site requests: the Origin (or Referer) must match the app's own origin. */
export function isSameOrigin(request: NextRequest): boolean {
  const expected = new URL(getBaseUrl()).origin;
  const origin = request.headers.get("origin");
  if (origin) return origin === expected;
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === expected;
    } catch {
      return false;
    }
  }
  // Browsers always send Origin on cross-site POSTs; a request with neither header
  // is not a browser CSRF vector, but the CSRF token check below still applies.
  return true;
}

/**
 * Guard for state-changing API routes: session must be active, the request must
 * come from our origin, and the double-submit CSRF token must match the session.
 */
export function requireSessionForMutation(request: NextRequest): { session: Session } | { response: NextResponse } {
  if (!isSameOrigin(request)) {
    return { response: apiError("csrf_failed", "Request origin is not allowed.", 403) };
  }
  const state = evaluateSessionCookie(request.cookies.get(sessionCookieName())?.value);
  if (state.status === "none") {
    return { response: apiError("unauthenticated", "Please sign in with Google to continue.", 401) };
  }
  if (state.status === "expired") {
    return { response: apiError("session_expired", "Your Google session has expired. Please reconnect your Google account.", 401) };
  }
  const token = request.headers.get("x-csrf-token") ?? "";
  if (!token || !safeEqual(token, state.session.csrf)) {
    return { response: apiError("csrf_failed", "Security check failed. Please reload the page and try again.", 403) };
  }
  return { session: state.session };
}
