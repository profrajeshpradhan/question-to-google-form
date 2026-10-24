import "server-only";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { getSessionSecret, shouldUseSecureCookies } from "@/lib/config";
import type { PublicSession } from "./public-session";
import { seal, unseal } from "./seal";

/**
 * Stateless sessions: the Google access token lives inside an encrypted,
 * HTTP-only cookie. No database, no refresh token (offline access is never
 * requested), so a session ends when Google's access token expires (~1 hour).
 */

export interface Session {
  v: 1;
  sub: string;
  email: string;
  name: string;
  picture?: string;
  accessToken: string;
  /** Epoch milliseconds when the access token expires. */
  expiresAt: number;
  /** Per-session CSRF token, sent back by the browser in the x-csrf-token header. */
  csrf: string;
  scope: string;
}

export type { PublicSession };

export type SessionState =
  | { status: "active"; session: Session }
  | { status: "expired" }
  | { status: "none" };

/** Treat the token as expired slightly early so an API call never starts with a dying token. */
export const EXPIRY_SKEW_MS = 60_000;
const SESSION_PURPOSE = "session";
const OAUTH_PURPOSE = "oauth";

export function sessionCookieName(): string {
  return shouldUseSecureCookies() ? "__Host-qgf_session" : "qgf_session";
}

export function oauthCookieName(): string {
  return shouldUseSecureCookies() ? "__Host-qgf_oauth" : "qgf_oauth";
}

export function sealSession(session: Session, secret = getSessionSecret()): string {
  return seal(session, secret, SESSION_PURPOSE);
}

export function evaluateSessionCookie(value: string | undefined, now = Date.now(), secret = getSessionSecret()): SessionState {
  if (!value) return { status: "none" };
  const session = unseal<Session>(value, secret, SESSION_PURPOSE);
  if (!session || session.v !== 1 || !session.accessToken || !session.csrf) return { status: "none" };
  if (session.expiresAt - EXPIRY_SKEW_MS <= now) return { status: "expired" };
  return { status: "active", session };
}

export async function getSessionState(): Promise<SessionState> {
  const store = await cookies();
  return evaluateSessionCookie(store.get(sessionCookieName())?.value);
}

export function toPublicSession(session: Session): PublicSession {
  return {
    user: { email: session.email, name: session.name, picture: session.picture },
    expiresAt: session.expiresAt,
    csrfToken: session.csrf,
  };
}

const baseCookie = () => ({
  httpOnly: true,
  secure: shouldUseSecureCookies(),
  sameSite: "lax" as const,
  path: "/",
});

export function setSessionCookie(response: NextResponse, session: Session) {
  const maxAge = Math.max(60, Math.floor((session.expiresAt - Date.now()) / 1000));
  response.cookies.set(sessionCookieName(), sealSession(session), { ...baseCookie(), maxAge });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(sessionCookieName(), "", { ...baseCookie(), maxAge: 0 });
}

/** Short-lived OAuth transaction (state + PKCE verifier) bound to this browser. */
export interface OAuthTransaction {
  state: string;
  codeVerifier: string;
  createdAt: number;
}

export const OAUTH_TRANSACTION_TTL_MS = 10 * 60_000;

export function setOAuthCookie(response: NextResponse, tx: OAuthTransaction) {
  response.cookies.set(oauthCookieName(), seal(tx, getSessionSecret(), OAUTH_PURPOSE), {
    ...baseCookie(),
    maxAge: OAUTH_TRANSACTION_TTL_MS / 1000,
  });
}

export function readOAuthCookie(value: string | undefined, now = Date.now()): OAuthTransaction | null {
  const tx = unseal<OAuthTransaction>(value, getSessionSecret(), OAUTH_PURPOSE);
  if (!tx || typeof tx.state !== "string" || typeof tx.codeVerifier !== "string") return null;
  if (now - tx.createdAt > OAUTH_TRANSACTION_TTL_MS) return null;
  return tx;
}

export function clearOAuthCookie(response: NextResponse) {
  response.cookies.set(oauthCookieName(), "", { ...baseCookie(), maxAge: 0 });
}
