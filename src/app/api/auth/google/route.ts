import { NextResponse, type NextRequest } from "next/server";
import { ConfigError, getBaseUrl, getRateLimits, isOAuthConfigured } from "@/lib/config";
import { buildAuthUrl, createOAuthClient } from "@/lib/auth/google-oauth";
import { setOAuthCookie } from "@/lib/auth/session";
import { randomToken } from "@/lib/auth/seal";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

/** GET /api/auth/google — starts the OAuth 2.0 authorization-code flow (with PKCE). */
export async function GET(request: NextRequest) {
  const loginUrl = (error: string) => {
    let base: string;
    try {
      base = getBaseUrl();
    } catch {
      base = request.nextUrl.origin;
    }
    return NextResponse.redirect(new URL(`/login?error=${error}`, base), 303);
  };

  if (!isOAuthConfigured()) return loginUrl("config_missing");

  const limits = getRateLimits();
  const limit = rateLimit(`auth:${clientIp(request.headers)}`, limits.authPerIp, limits.authWindowMs);
  if (!limit.allowed) return loginUrl("rate_limited");

  try {
    const client = createOAuthClient();
    const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
    if (!codeChallenge) throw new Error("PKCE challenge unavailable");
    const state = randomToken(24);
    const response = NextResponse.redirect(buildAuthUrl(client, state, codeChallenge), 303);
    setOAuthCookie(response, { state, codeVerifier, createdAt: Date.now() });
    return response;
  } catch (error) {
    console.warn("[auth] start failed", error instanceof ConfigError ? error.message : "unexpected");
    return loginUrl(error instanceof ConfigError ? "config_missing" : "oauth_error");
  }
}
