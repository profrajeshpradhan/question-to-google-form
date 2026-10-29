import type { BrowserContext, Page } from "@playwright/test";
import { seal } from "../src/lib/auth/seal";
import { E2E_BASE_URL, E2E_SESSION_SECRET } from "../playwright.config";

export const SAMPLE = `Q1: What does CPU stand for?
OPTIONS:
A. Central Processing Unit
B. Computer Personal Unit
C. Central Program Utility
D. Control Processing User
ANSWER: A
MARKS: 2

Q2: Which language is used for web page structure?
OPTIONS:
A. Python
B. HTML
C. SQL
D. C
ANSWER: B
MARKS: 1`;

export const CSRF = "e2e-csrf-token";

/**
 * Signs the browser in by setting an encrypted session cookie exactly like the
 * OAuth callback does (same format and secret as the test server). The Google
 * access token is a placeholder accepted only by the local mock Forms API.
 */
export async function signIn(context: BrowserContext, overrides: { expiresInMs?: number } = {}) {
  const value = seal(
    {
      v: 1,
      sub: "e2e-user-1",
      email: "e2e.teacher@example.com",
      name: "E2E Teacher",
      accessToken: "e2e-access-token",
      expiresAt: Date.now() + (overrides.expiresInMs ?? 30 * 60_000),
      csrf: CSRF,
      scope: "openid email profile https://www.googleapis.com/auth/drive.file",
    },
    E2E_SESSION_SECRET,
    "session",
  );
  await context.addCookies([{ name: "qgf_session", value, url: E2E_BASE_URL, httpOnly: true, sameSite: "Lax" }]);
}

export async function resetMock() {
  await fetch("http://127.0.0.1:4010/__reset", { method: "POST" });
}

export async function mockStats(): Promise<{ creates: number; batchUpdates: number; gets: number; publishes: number }> {
  return (await fetch("http://127.0.0.1:4010/__stats")).json();
}

/** The most recently created form as stored by the mock Forms API. */
export async function lastMockForm(): Promise<{ settings?: { emailCollectionType?: string; quizSettings?: { isQuiz?: boolean } }; items: Record<string, unknown>[] }> {
  return (await fetch("http://127.0.0.1:4010/__last")).json();
}

export async function fillEditor(page: Page, { title, input, description = "" }: { title: string; input: string; description?: string }) {
  await page.getByLabel("Form Title").fill(title);
  if (description) await page.getByLabel("Form Description").fill(description);
  await page.getByLabel("Paste Your Questions").fill(input);
}
