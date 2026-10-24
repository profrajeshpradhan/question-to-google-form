import "server-only";

/**
 * Server-side configuration. Never import this file from client components:
 * it reads secrets from the environment.
 */

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  // Non-sensitive scope: per-file access limited to forms this app creates.
  // Accepted by forms.create, forms.batchUpdate, forms.get and forms.setPublishSettings.
  "https://www.googleapis.com/auth/drive.file",
] as const;

export const FORMS_SCOPE = "https://www.googleapis.com/auth/drive.file";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function getBaseUrl(): string {
  const raw = process.env.APP_BASE_URL?.trim();
  if (!raw) throw new ConfigError("APP_BASE_URL is not set.");
  return raw.replace(/\/+$/, "");
}

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length < 32) throw new ConfigError("SESSION_SECRET must be set to at least 32 characters.");
  return secret;
}

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new ConfigError("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set.");
  return { clientId, clientSecret, redirectUri: `${getBaseUrl()}/api/auth/google/callback` };
}

export function isOAuthConfigured(): boolean {
  try {
    getGoogleOAuthConfig();
    getSessionSecret();
    return true;
  } catch {
    return false;
  }
}

export function shouldUseSecureCookies(): boolean {
  try {
    return getBaseUrl().startsWith("https://");
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

/**
 * Optional override of the Google Forms API root URL, used ONLY by the automated
 * end-to-end tests to talk to a local mock server. It is ignored unless
 * ALLOW_TEST_OVERRIDES=1 and never honoured on a Vercel production deployment.
 */
export function getFormsApiRootUrl(): string | undefined {
  if (process.env.ALLOW_TEST_OVERRIDES !== "1" || process.env.VERCEL_ENV === "production") return undefined;
  return process.env.GOOGLE_FORMS_API_ROOT_URL_TEST_ONLY || undefined;
}

function intFromEnv(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getRateLimits() {
  return {
    /** OAuth start/callback attempts per IP per window. */
    authPerIp: intFromEnv("RATE_LIMIT_AUTH_PER_IP", 20),
    authWindowMs: 10 * 60_000,
    /** Form creations per signed-in user per window. */
    createPerUser: intFromEnv("RATE_LIMIT_CREATE_PER_USER", 10),
    /** Form creations per IP per window (shared networks such as schools get headroom). */
    createPerIp: intFromEnv("RATE_LIMIT_CREATE_PER_IP", 60),
    createWindowMs: 60 * 60_000,
  };
}
