import "server-only";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import { GOOGLE_SCOPES, FORMS_SCOPE, getGoogleOAuthConfig } from "@/lib/config";

export function createOAuthClient(): OAuth2Client {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

export function buildAuthUrl(client: OAuth2Client, state: string, codeChallenge: string): string {
  return client.generateAuthUrl({
    // Online access: no refresh token is issued or stored.
    access_type: "online",
    scope: [...GOOGLE_SCOPES],
    state,
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
    include_granted_scopes: true,
    prompt: "select_account",
  });
}

export interface VerifiedGoogleUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

export async function exchangeCode(client: OAuth2Client, code: string, codeVerifier: string) {
  const { tokens } = await client.getToken({ code, codeVerifier });
  if (!tokens.access_token || !tokens.id_token) throw new Error("Google did not return the expected tokens.");

  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: getGoogleOAuthConfig().clientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw new Error("Google ID token is missing the user identity.");

  const user: VerifiedGoogleUser = {
    sub: payload.sub,
    email: payload.email,
    name: payload.name || payload.email,
    picture: payload.picture?.startsWith("https://lh3.googleusercontent.com/") ? payload.picture : undefined,
  };
  const scope = tokens.scope ?? "";
  return {
    user,
    accessToken: tokens.access_token,
    expiresAt: tokens.expiry_date ?? Date.now() + 55 * 60_000,
    scope,
    hasFormsScope: scope.split(/\s+/).includes(FORMS_SCOPE),
  };
}

export async function revokeAccessToken(accessToken: string): Promise<void> {
  try {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: accessToken }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Best effort: the session cookie is cleared regardless.
  }
}
