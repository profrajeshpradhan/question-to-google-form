import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getBaseUrl, getRateLimits, isOAuthConfigured } from "@/lib/config";
import { createOAuthClient, exchangeCode, revokeAccessToken } from "@/lib/auth/google-oauth";
import { clearOAuthCookie, oauthCookieName, readOAuthCookie, setSessionCookie } from "@/lib/auth/session";
import { randomToken, safeEqual } from "@/lib/auth/seal";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

const callbackSchema = z.object({
  code: z.string().min(1).max(2048),
  state: z.string().min(1).max(256),
});

/** GET /api/auth/google/callback — validates state, exchanges the code and starts a session. */
export async function GET(request: NextRequest) {
  const base = isOAuthConfigured() ? getBaseUrl() : request.nextUrl.origin;
  const redirectTo = (path: string) => {
    const response = NextResponse.redirect(new URL(path, base), 303);
    clearOAuthCookie(response);
    return response;
  };
  if (!isOAuthConfigured()) return redirectTo("/login?error=config_missing");

  const limits = getRateLimits();
  if (!rateLimit(`auth:${clientIp(request.headers)}`, limits.authPerIp, limits.authWindowMs).allowed) {
    return redirectTo("/login?error=rate_limited");
  }

  const params = request.nextUrl.searchParams;
  const googleError = params.get("error");
  if (googleError) {
    return redirectTo(googleError === "access_denied" ? "/login?error=access_denied" : "/login?error=oauth_error");
  }

  const parsed = callbackSchema.safeParse({ code: params.get("code"), state: params.get("state") });
  if (!parsed.success) return redirectTo("/login?error=oauth_error");

  const tx = readOAuthCookie(request.cookies.get(oauthCookieName())?.value);
  if (!tx) return redirectTo("/login?error=state_expired");
  if (!safeEqual(tx.state, parsed.data.state)) return redirectTo("/login?error=state_mismatch");

  try {
    const result = await exchangeCode(createOAuthClient(), parsed.data.code, tx.codeVerifier);
    if (!result.hasFormsScope) {
      // The teacher unticked the Google Forms permission on the consent screen.
      await revokeAccessToken(result.accessToken);
      return redirectTo("/login?error=scope_denied");
    }
    const response = redirectTo("/dashboard");
    setSessionCookie(response, {
      v: 1,
      ...result.user,
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
      csrf: randomToken(24),
      scope: result.scope,
    });
    return response;
  } catch {
    console.warn("[auth] code exchange failed");
    return redirectTo("/login?error=oauth_error");
  }
}
