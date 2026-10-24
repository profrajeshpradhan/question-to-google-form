import { beforeEach, describe, expect, it } from "vitest";
import { randomToken, safeEqual, seal, unseal } from "@/lib/auth/seal";
import { evaluateSessionCookie, sealSession, EXPIRY_SKEW_MS, type Session } from "@/lib/auth/session";
import { mapGoogleError } from "@/lib/forms/errors";
import { clientIp, rateLimit, resetRateLimits } from "@/lib/security/rate-limit";
import { createFormRequestSchema, formIdSchema } from "@/lib/forms/request-schema";

const SECRET = "test-secret-test-secret-test-secret-1234";

const session = (overrides: Partial<Session> = {}): Session => ({
  v: 1,
  sub: "123",
  email: "teacher@example.com",
  name: "Teacher",
  accessToken: "ya29.token",
  expiresAt: Date.now() + 3_600_000,
  csrf: "csrf-token",
  scope: "openid",
  ...overrides,
});

describe("seal / unseal", () => {
  it("round-trips and hides the plaintext", () => {
    const token = seal({ hello: "world" }, SECRET, "p");
    expect(token).not.toContain("world");
    expect(unseal(token, SECRET, "p")).toEqual({ hello: "world" });
  });

  it("rejects a wrong key, wrong purpose or tampering", () => {
    const token = seal({ a: 1 }, SECRET, "p");
    expect(unseal(token, `${SECRET}x`, "p")).toBeNull();
    expect(unseal(token, SECRET, "other")).toBeNull();
    const bytes = Buffer.from(token, "base64url");
    bytes[bytes.length - 1] ^= 1;
    expect(unseal(bytes.toString("base64url"), SECRET, "p")).toBeNull();
    expect(unseal("garbage", SECRET, "p")).toBeNull();
    expect(unseal(undefined, SECRET, "p")).toBeNull();
  });

  it("produces unique random tokens and compares safely", () => {
    expect(randomToken()).not.toBe(randomToken());
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("session cookie evaluation", () => {
  it("returns active / expired / none", () => {
    expect(evaluateSessionCookie(sealSession(session(), SECRET), Date.now(), SECRET).status).toBe("active");
    const expired = sealSession(session({ expiresAt: Date.now() + EXPIRY_SKEW_MS - 1 }), SECRET);
    expect(evaluateSessionCookie(expired, Date.now(), SECRET).status).toBe("expired");
    expect(evaluateSessionCookie(undefined, Date.now(), SECRET).status).toBe("none");
    expect(evaluateSessionCookie("tampered", Date.now(), SECRET).status).toBe("none");
  });
});

describe("rate limiting", () => {
  beforeEach(() => resetRateLimits());
  it("allows up to the limit then blocks until the window resets", () => {
    const now = 1_000_000;
    expect(rateLimit("k", 2, 1000, now).allowed).toBe(true);
    expect(rateLimit("k", 2, 1000, now).allowed).toBe(true);
    const blocked = rateLimit("k", 2, 1000, now + 10);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
    expect(rateLimit("k", 2, 1000, now + 1001).allowed).toBe(true);
  });
  it("reads the first forwarded IP", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("Google error mapping", () => {
  it.each([
    [{ response: { status: 401 } }, "session_expired"],
    [{ response: { status: 403, data: { error: { status: "PERMISSION_DENIED", details: [{ reason: "SERVICE_DISABLED" }] } } } }, "google_api_disabled"],
    [{ response: { status: 403, data: { error: { message: "Request had insufficient authentication scopes." } } } }, "google_permission_denied"],
    [{ response: { status: 403 } }, "google_permission_denied"],
    [{ response: { status: 429 } }, "google_quota"],
    [{ response: { status: 404 } }, "google_not_found"],
    [{ response: { status: 500 } }, "google_unavailable"],
    [new Error("socket hang up"), "google_unavailable"],
    [{ response: { status: 400, data: { error: { message: "Invalid value" } } } }, "google_error"],
  ])("maps %j", (error, code) => {
    expect(mapGoogleError(error).code).toBe(code);
  });
});

describe("request schemas", () => {
  it("validates the create request and defaults publish to true", () => {
    const parsed = createFormRequestSchema.parse({ title: "T", input: "Q1: x" });
    expect(parsed.publish).toBe(true);
    expect(createFormRequestSchema.safeParse({ title: "T", input: "" }).success).toBe(false);
    expect(createFormRequestSchema.safeParse({ title: 5, input: "x" }).success).toBe(false);
  });
  it("validates form IDs", () => {
    expect(formIdSchema.safeParse("1FAIpQLSf_abc-DEF123").success).toBe(true);
    expect(formIdSchema.safeParse("../etc/passwd").success).toBe(false);
    expect(formIdSchema.safeParse("short").success).toBe(false);
  });
});
