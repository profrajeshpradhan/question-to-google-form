import type { FailureCode } from "./events";

export interface MappedGoogleError {
  code: FailureCode;
  message: string;
  /** HTTP status from Google, if any (for minimal logging only). */
  status?: number;
}

interface GoogleishError {
  status?: number;
  code?: number | string;
  message?: string;
  response?: { status?: number; data?: { error?: { message?: string; status?: string; details?: { reason?: string }[]; errors?: { reason?: string }[] } } };
}

/** Maps a Google API error (gaxios) to a safe, teacher-friendly failure. */
export function mapGoogleError(error: unknown): MappedGoogleError {
  const e = (error ?? {}) as GoogleishError;
  const status = e.response?.status ?? e.status ?? (typeof e.code === "number" ? e.code : undefined);
  const body = e.response?.data?.error;
  const reasons = [
    body?.status,
    ...(body?.details ?? []).map((d) => d.reason),
    ...(body?.errors ?? []).map((d) => d.reason),
  ].filter(Boolean) as string[];
  const googleMessage = (body?.message ?? "").slice(0, 300);
  const has = (needle: string) => reasons.some((r) => r.toUpperCase().includes(needle)) || googleMessage.includes(needle);

  if (status === 401) {
    return { code: "session_expired", status, message: "Your Google session has expired or access was revoked. Please reconnect your Google account." };
  }
  if (status === 403 && (has("SERVICE_DISABLED") || has("accessNotConfigured") || /has not been used|is disabled/i.test(googleMessage))) {
    return { code: "google_api_disabled", status, message: "The Google Forms API is not enabled for this application's Google Cloud project. The site administrator needs to enable it." };
  }
  if (status === 429 || has("RESOURCE_EXHAUSTED") || has("RATE_LIMIT")) {
    return { code: "google_quota", status: status ?? 429, message: "Google's usage limit was reached. Please wait a minute and try again." };
  }
  if (status === 403) {
    return {
      code: "google_permission_denied",
      status,
      message: has("SCOPE") || has("insufficient")
        ? "Google did not grant permission to create forms. Reconnect and allow access to Google Forms files."
        : "Google denied permission for this action. Your account administrator may restrict Google Forms or third-party apps.",
    };
  }
  if (status === 404) {
    return { code: "google_not_found", status, message: "The form could not be found. It may have been deleted, or it was not created by this app." };
  }
  if (status === undefined || status >= 500) {
    return { code: "google_unavailable", status, message: "Google Forms could not be reached. Check your connection and try again." };
  }
  return {
    code: "google_error",
    status,
    message: googleMessage ? `Google Forms rejected the request: ${googleMessage}` : "Google Forms rejected the request.",
  };
}
