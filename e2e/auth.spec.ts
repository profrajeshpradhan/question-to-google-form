import { expect, test } from "@playwright/test";
import { E2E_BASE_URL } from "../playwright.config";
import { CSRF, signIn } from "./helpers";

test.describe("Google sign-in (OAuth initiation and callback)", () => {
  test("login page explains permissions and links to policies @mobile", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in to Question to Google Form" })).toBeVisible();
    await expect(page.getByText("Only the Google Drive files you use with this app")).toBeVisible();
    await expect(page.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    await expect(page.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    await expect(page.getByRole("link", { name: "← Cancel" })).toHaveAttribute("href", "/");
  });

  test("starts a real authorization-code flow with PKCE, state and minimal scopes", async ({ request }) => {
    const res = await request.get("/api/auth/google", { maxRedirects: 0 });
    expect(res.status()).toBe(303);
    const location = new URL(res.headers()["location"]);
    expect(location.origin).toBe("https://accounts.google.com");
    const p = location.searchParams;
    expect(p.get("client_id")).toBe("e2e-test-client.apps.googleusercontent.com");
    expect(p.get("redirect_uri")).toBe(`${E2E_BASE_URL}/api/auth/google/callback`);
    expect(p.get("response_type")).toBe("code");
    expect(p.get("access_type")).toBe("online");
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(p.get("state")).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(p.get("scope")?.split(" ").sort()).toEqual(["email", "https://www.googleapis.com/auth/drive.file", "openid", "profile"]);
    const cookie = res.headers()["set-cookie"];
    expect(cookie).toContain("qgf_oauth=");
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
  });

  test("sign-in button shows a loading state and navigates to Google", async ({ page }) => {
    let googleRequested = "";
    await page.route("https://accounts.google.com/**", async (route) => {
      googleRequested = route.request().url();
      await route.fulfill({ status: 200, contentType: "text/html", body: "<title>Google</title><p>Google sign-in (stub)</p>" });
    });
    await page.goto("/login");
    const button = page.getByTestId("google-sign-in");
    await button.click();
    await expect(page.getByText("Google sign-in (stub)")).toBeVisible();
    expect(googleRequested).toContain("client_id=e2e-test-client");
  });

  test("denied consent returns to a clear retry screen", async ({ page }) => {
    await page.goto("/api/auth/google/callback?error=access_denied&state=x");
    await expect(page).toHaveURL(/\/login\?error=access_denied/);
    await expect(page.getByText("Sign-in was cancelled", { exact: true })).toBeVisible();
    await expect(page.getByTestId("google-sign-in")).toContainText("Try again with Google");
  });

  test("callback rejects a mismatched state", async ({ page }) => {
    await page.request.get("/api/auth/google", { maxRedirects: 0 }); // sets the OAuth transaction cookie
    await page.goto("/api/auth/google/callback?code=abc&state=not-the-right-state");
    await expect(page).toHaveURL(/error=state_mismatch/);
    await expect(page.getByText("Sign-in could not be verified")).toBeVisible();
  });

  test("callback without the OAuth cookie is rejected as expired", async ({ page }) => {
    await page.goto("/api/auth/google/callback?code=abc&state=abc");
    await expect(page).toHaveURL(/error=state_expired/);
  });

  test("callback with missing parameters is rejected", async ({ page }) => {
    await page.goto("/api/auth/google/callback");
    await expect(page).toHaveURL(/error=oauth_error/);
    await expect(page.getByText("Google sign-in couldn't be completed")).toBeVisible();
  });

  test("dashboard requires sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("expired session is sent to sign in with an explanation", async ({ page, context }) => {
    await signIn(context, { expiresInMs: 30_000 });
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/error=session_expired/);
    await expect(page.getByText("Your session has expired")).toBeVisible();
  });

  test("signed-in users skip the login page and the session API hides the token", async ({ page, context }) => {
    await signIn(context);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard$/);
    const session = await (await page.request.get("/api/auth/session")).json();
    expect(session).toMatchObject({ authenticated: true, user: { email: "e2e.teacher@example.com", name: "E2E Teacher" }, csrfToken: CSRF });
    expect(JSON.stringify(session)).not.toContain("e2e-access-token");
    // The session cookie is HTTP-only: page scripts cannot read it.
    expect(await page.evaluate(() => document.cookie)).not.toContain("qgf_session");
  });

  test("sign out clears the session", async ({ page, context }) => {
    await signIn(context);
    await page.goto("/dashboard");
    await page.getByRole("navigation", { name: "Dashboard" }).getByRole("button", { name: "Sign Out" }).click();
    await expect(page).toHaveURL(/error=signed_out/);
    await expect(page.getByText("You've been signed out")).toBeVisible();
    const session = await (await page.request.get("/api/auth/session")).json();
    expect(session.authenticated).toBe(false);
  });

  test("logout requires the CSRF token", async ({ context, request }) => {
    await signIn(context);
    const cookies = await context.cookies();
    const res = await request.post("/api/auth/logout", {
      headers: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "), origin: E2E_BASE_URL },
    });
    expect(res.status()).toBe(403);
  });
});
