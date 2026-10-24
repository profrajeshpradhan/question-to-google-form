import { expect, test } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders hero, features, how it works, example, FAQ and footer @mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Turn Your Questions into Google Forms in Seconds");
    await expect(page.getByText("Paste your multiple-choice questions, validate your answers, and create a quiz directly in your Google account.")).toBeVisible();
    await expect(page.getByTestId("google-sign-in").first()).toHaveAttribute("href", "/api/auth/google");
    await expect(page.getByRole("link", { name: "See How It Works" })).toBeVisible();

    for (const feature of [
      "Paste questions in one textbox",
      "Automatically validate answers and marks",
      "Create a quiz in your Google account",
      "No application question history",
    ]) {
      await expect(page.getByRole("heading", { name: feature })).toBeVisible();
    }
    for (const step of ["Paste your questions", "Validate and preview your quiz", "Create and share your Google Form"]) {
      await expect(page.locator("#how-it-works").getByRole("heading", { name: step })).toBeVisible();
    }
    await expect(page.getByText("Which language is used for web page structure?").last()).toBeVisible();
    for (const q of [
      "Do I need a Google account?",
      "Will the form be created in my own account?",
      "Can I assign marks?",
      "Does the app save my questions?",
      "Why does Google ask for permissions?",
      "What happens if form creation fails?",
    ]) {
      await expect(page.locator("#faq").getByText(q)).toBeVisible();
    }
    const footer = page.getByRole("contentinfo");
    for (const link of ["Privacy Policy", "Terms of Service", "Support", "How It Works"]) {
      await expect(footer.getByRole("link", { name: link })).toBeVisible();
    }
  });

  test("has no horizontal scrolling on a phone @mobile", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    for (const path of ["/", "/login", "/privacy", "/support"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test("mobile navigation menu opens and links to sections @mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Open menu" });
    await expect(toggle).toBeVisible();
    await toggle.click();
    const nav = page.getByRole("navigation", { name: "Mobile" });
    await expect(nav.getByRole("link", { name: "Get Started" })).toBeVisible();
    await nav.getByRole("link", { name: "FAQ" }).click();
    await expect(page).toHaveURL(/#faq$/);
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeHidden();
  });

  test("desktop navigation shows How It Works, FAQ and Get Started", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "How It Works" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "FAQ" })).toBeVisible();
    await nav.getByRole("link", { name: "Get Started" }).click();
    // Not signed in: Get Started leads to the sign-in screen.
    await expect(page).toHaveURL(/\/login$/);
  });

  test("FAQ items expand", async ({ page }) => {
    await page.goto("/#faq");
    await page.locator("#faq").getByText("Can I assign marks?").click();
    await expect(page.getByText(/Google Forms quizzes use whole-number points/)).toBeVisible();
  });

  test("legal and support pages render", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
    await expect(page.getByText(/Google API Services User Data Policy/).first()).toBeVisible();
    await page.goto("/terms");
    await expect(page.getByRole("heading", { level: 1, name: "Terms of Service" })).toBeVisible();
    await page.goto("/support");
    await expect(page.getByRole("heading", { level: 1, name: "Support" })).toBeVisible();
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: "You’re offline" })).toBeVisible();
  });
});

test.describe("PWA", () => {
  test("serves a valid manifest, icons and service worker", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest).toMatchObject({ name: "Question to Google Form", short_name: "Q2Form", display: "standalone", theme_color: "#673AB7" });
    for (const icon of manifest.icons) {
      const res = await request.get(icon.src);
      expect(res.status(), icon.src).toBe(200);
      expect(res.headers()["content-type"]).toContain("image/png");
    }
    const sw = await request.get("/sw.js");
    expect(sw.status()).toBe(200);
    expect(sw.headers()["cache-control"]).toContain("no-store");
    const body = await sw.text();
    expect(body).toContain("NEVER_CACHE");
    expect(body).toContain("/^\\/api\\//");
  });

  test("registers the service worker and serves the offline page when offline", async ({ page, context }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // Reload so the page is controlled by the active worker.
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await context.setOffline(true);
    await page.goto("/dashboard").catch(() => undefined);
    await expect(page.getByRole("heading", { name: "You’re offline" })).toBeVisible();
    await context.setOffline(false);
  });
});

test.describe("Security headers", () => {
  test("are set on pages and APIs are not cached", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
    const api = await request.get("/api/auth/session");
    expect(api.headers()["cache-control"]).toContain("no-store");
    expect(await api.json()).toEqual({ authenticated: false, status: "none" });
  });
});
