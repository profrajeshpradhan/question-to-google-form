import { expect, test, type Page } from "@playwright/test";
import { E2E_BASE_URL } from "../playwright.config";
import { CSRF, fillEditor, mockStats, resetMock, SAMPLE, signIn } from "./helpers";

test.beforeEach(async ({ context }) => {
  await resetMock();
  await signIn(context);
});

async function toPreview(page: Page, title = "Introduction to IT Systems", input = SAMPLE) {
  await page.goto("/dashboard");
  await fillEditor(page, { title, description: "Unit 1 Assessment", input });
  await page.getByRole("button", { name: "Validate Questions" }).click();
  await expect(page.getByText("Validation successful!")).toBeVisible();
  await page.getByRole("button", { name: "View Preview" }).click();
  await expect(page.getByRole("heading", { name: "Preview Your Google Form" })).toBeVisible();
}

async function confirmCreate(page: Page, { publish = true } = {}) {
  await page.getByRole("button", { name: /Convert into Google Form/ }).click();
  const dialog = page.getByRole("dialog", { name: "Create this Google Form?" });
  await expect(dialog).toBeVisible();
  if (!publish) await dialog.getByLabel(/Publish and start accepting responses/).uncheck();
  await dialog.getByTestId("confirm-create").click();
}

test("dashboard shows the connected account, form fields and editor @mobile", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Create Your Google Form" })).toBeVisible();
  await expect(page.getByLabel("Form Title")).toBeVisible();
  await expect(page.getByLabel("Form Description")).toBeVisible();
  await expect(page.getByLabel("Paste Your Questions")).toBeVisible();
  await expect(page.getByRole("button", { name: "Validate Questions" })).toBeDisabled();
  await page.getByTestId("account-menu").click();
  await expect(page.getByRole("menu")).toContainText("e2e.teacher@example.com");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("format example modal can be copied and closed without losing input", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByLabel("Paste Your Questions").fill("my own text");
  await page.getByRole("button", { name: "View Format Example" }).click();
  const dialog = page.getByRole("dialog", { name: "Input format example" });
  await expect(dialog.getByTestId("format-example")).toContainText("FORM TITLE: Introduction to IT Systems");
  await expect(dialog.getByText(/Exactly one correct answer per question/)).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).last().click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel("Paste Your Questions")).toHaveValue("my own text");
});

test("invalid questions show question-specific errors with line numbers and keep the input", async ({ page }) => {
  await page.goto("/dashboard");
  const broken = `${SAMPLE}\n\nQ3: Missing answer?\nA. One\nB. Two\nMARKS: 1\n\nQ4: Bad answer?\nA. x\nB. y\nC. z\nD. w\nANSWER: E\nMARKS: 1\n\nQ5: Zero marks?\nA. x\nB. y\nANSWER: A\nMARKS: 0`;
  await fillEditor(page, { title: "Broken quiz", input: broken });
  await page.getByRole("button", { name: "Validate Questions" }).click();
  const errors = page.getByTestId("validation-errors");
  await expect(errors).toContainText("3 problems found");
  await expect(errors).toContainText("Q3");
  await expect(errors).toContainText("Missing ANSWER field");
  await expect(errors).toContainText("Answer E does not match any available option (A, B, C, D).");
  await expect(errors).toContainText("Marks must be greater than zero.");
  await expect(page.getByLabel("Paste Your Questions")).toHaveValue(broken);
  // Jump-to-line selects the offending line in the editor.
  await errors.getByRole("button", { name: "Line 19" }).click();
  const selected = await page.getByLabel("Paste Your Questions").evaluate((el: HTMLTextAreaElement) => el.value.slice(el.selectionStart, el.selectionEnd));
  expect(selected).toBe("Q3: Missing answer?");
});

test("missing title is reported", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByLabel("Paste Your Questions").fill("Q1: x?\nA. a\nB. b\nANSWER: A\nMARKS: 1");
  await page.getByRole("button", { name: "Validate Questions" }).click();
  await expect(page.getByTestId("validation-errors")).toContainText("Enter a Google Form title");
});

test("clear input asks for confirmation", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByLabel("Paste Your Questions").fill("something");
  await page.getByRole("button", { name: "Clear Input" }).click();
  const dialog = page.getByRole("dialog", { name: "Clear all input?" });
  await dialog.getByRole("button", { name: "Keep my input" }).click();
  await expect(page.getByLabel("Paste Your Questions")).toHaveValue("something");
  await page.getByRole("button", { name: "Clear Input" }).click();
  await page.getByRole("dialog", { name: "Clear all input?" }).getByRole("button", { name: "Clear input" }).click();
  await expect(page.getByLabel("Paste Your Questions")).toHaveValue("");
});

test("validation summary and preview match the parsed questions", async ({ page }) => {
  await page.goto("/dashboard");
  await fillEditor(page, { title: "Introduction to IT Systems", description: "Unit 1 Assessment", input: SAMPLE });
  await page.getByRole("button", { name: "Validate Questions" }).click();
  const summary = page.getByTestId("validation-summary");
  await expect(summary).toContainText("2Questions");
  await expect(summary).toContainText("8Options");
  await expect(summary).toContainText("3Total marks");
  await expect(page.getByText("4 options · Answer: A · 2 marks")).toBeVisible();
  await expect(page.getByText("4 options · Answer: B · 1 mark")).toBeVisible();

  // Edit Input keeps the content, then come back.
  await page.getByRole("button", { name: "Edit Input" }).click();
  await expect(page.getByLabel("Paste Your Questions")).toHaveValue(SAMPLE);
  await page.getByRole("button", { name: "Validate Questions" }).click();
  await page.getByRole("button", { name: "View Preview" }).click();

  await expect(page.getByTestId("preview-title")).toHaveText("Introduction to IT Systems");
  await expect(page.getByText("Total questions: 2 | Total marks: 3")).toBeVisible();
  const questions = page.getByTestId("preview-question");
  await expect(questions).toHaveCount(2);
  await expect(questions.nth(0)).toContainText("(2 marks)");
  await expect(questions.nth(0).locator("li", { hasText: "Correct answer" })).toContainText("A. Central Processing Unit");
  await expect(questions.nth(1).locator("li", { hasText: "Correct answer" })).toContainText("B. HTML");

  // Cancel in the confirmation dialog does not create anything.
  await page.getByRole("button", { name: /Convert into Google Form/ }).click();
  await page.getByRole("dialog", { name: "Create this Google Form?" }).getByRole("button", { name: "Cancel" }).click();
  expect((await mockStats()).creates).toBe(0);
});

test("creates, verifies and publishes the quiz, then shows real links", async ({ page }) => {
  await toPreview(page);
  await confirmCreate(page);
  await expect(page.getByTestId("success-title")).toBeVisible();
  await expect(page.getByText("Published · accepting responses")).toBeVisible();
  const edit = page.getByTestId("edit-link");
  await expect(edit).toHaveAttribute("href", /^https:\/\/docs\.google\.com\/forms\/d\/MOCKFORM\d+abcdef\/edit$/);
  await expect(edit).toHaveAttribute("target", "_blank");
  await expect(page.getByTestId("responder-link")).toHaveAttribute("href", /\/viewform$/);
  await expect(page.locator("dl").filter({ hasText: "Questions created" })).toContainText("2");
  expect(await mockStats()).toEqual({ creates: 1, batchUpdates: 2, gets: 1, publishes: 1 });

  // Copy edit link.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy Open in Google Forms (Edit)" }).click();
  await expect(page.getByRole("button", { name: "Copy Open in Google Forms (Edit)" })).toContainText("Copied");

  // Create another form resets the editor and the draft.
  await page.getByRole("button", { name: "Create Another Form" }).click();
  await expect(page.getByLabel("Paste Your Questions")).toHaveValue("");
  await page.reload();
  await expect(page.getByLabel("Paste Your Questions")).toHaveValue("");
});

test("can create an unpublished draft", async ({ page }) => {
  await toPreview(page);
  await confirmCreate(page, { publish: false });
  await expect(page.getByTestId("success-title")).toBeVisible();
  await expect(page.getByText("Unpublished draft", { exact: true })).toBeVisible();
  await expect(page.getByText("Respondent link not active yet")).toBeVisible();
  expect((await mockStats()).publishes).toBe(0);
});

test("shows real progress steps while creating", async ({ page }) => {
  await toPreview(page);
  // Slow down the stream so the in-progress screen is observable.
  await page.route("**/api/forms", async (route) => {
    const response = await route.fetch();
    await new Promise((r) => setTimeout(r, 800));
    await route.fulfill({ response });
  });
  await confirmCreate(page);
  await expect(page.getByRole("heading", { name: "Creating your Google Form" })).toBeVisible();
  await expect(page.getByText("Please keep this page open while your form is being created.")).toBeVisible();
  await expect(page.getByTestId("success-title")).toBeVisible();
});

test("failure before a form exists offers a safe retry and explains the API problem", async ({ page }) => {
  await toPreview(page, "[fail-create-disabled] Quiz");
  await confirmCreate(page);
  const failure = page.getByTestId("failure");
  await expect(failure).toContainText("The form couldn't be created");
  await expect(failure).toContainText("Google Forms API is not enabled");
  await expect(page.getByTestId("partial-edit-link")).toHaveCount(0);
  await expect(failure.locator('[data-step="create"]')).toHaveAttribute("data-status", "failed");
  expect((await mockStats()).creates).toBe(0);
});

test("partial failure shows the existing form and finishes it without a duplicate", async ({ page }) => {
  await toPreview(page, "[fail-questions] Quiz");
  await confirmCreate(page);
  const failure = page.getByTestId("failure");
  await expect(failure).toContainText("Your form was created, but not finished");
  await expect(failure).toContainText("Form ID: MOCKFORM");
  await expect(page.getByTestId("partial-edit-link")).toHaveAttribute("href", /docs\.google\.com\/forms\/d\/MOCKFORM\d+abcdef\/edit/);
  await expect(failure.locator('[data-step="create"]')).toHaveAttribute("data-status", "done");
  await expect(failure.locator('[data-step="questions"]')).toHaveAttribute("data-status", "failed");

  await page.getByRole("button", { name: "Finish this form" }).click();
  await expect(page.getByTestId("success-title")).toBeVisible();
  const stats = await mockStats();
  expect(stats.creates).toBe(1);
  expect(stats.publishes).toBe(1);
});

test("going back after a partial failure offers to finish the earlier form", async ({ page }) => {
  await toPreview(page, "[fail-questions] Quiz");
  await confirmCreate(page);
  await page.getByRole("button", { name: "Back to preview" }).click();
  await expect(page.getByText("You have an unfinished form from an earlier attempt")).toBeVisible();
  await page.getByRole("button", { name: "Finish that form instead" }).click();
  await expect(page.getByTestId("success-title")).toBeVisible();
  expect((await mockStats()).creates).toBe(1);
});

test("revoked Google access asks the teacher to reconnect and keeps the input", async ({ page }) => {
  await toPreview(page, "[fail-auth] Quiz");
  await confirmCreate(page);
  await expect(page.getByRole("heading", { name: "Please reconnect your Google account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Reconnect Google account" }).first()).toHaveAttribute("href", "/api/auth/google");
  await page.reload();
  await expect(page.getByLabel("Paste Your Questions")).toHaveValue(SAMPLE);
  await expect(page.getByText("Your previous input in this tab was restored.")).toBeVisible();
});

test("session expiring while the page is open shows a reconnect banner", async ({ page }) => {
  await page.clock.install();
  await page.goto("/dashboard");
  await page.getByLabel("Paste Your Questions").fill(SAMPLE);
  await page.clock.fastForward("45:00");
  await expect(page.getByText("Your Google session has expired")).toBeVisible();
  await expect(page.getByTestId("reconnect")).toHaveAttribute("href", "/api/auth/google");
  await expect(page.getByLabel("Paste Your Questions")).toHaveValue(SAMPLE);
});

test("session that ended on the server is handled when creating", async ({ page, context }) => {
  await toPreview(page);
  await context.clearCookies();
  await confirmCreate(page);
  await expect(page.getByRole("heading", { name: "Please reconnect your Google account" })).toBeVisible();
  expect((await mockStats()).creates).toBe(0);
});

test("offline state disables form creation", async ({ page, context }) => {
  await toPreview(page);
  await context.setOffline(true);
  await expect(page.getByText("You're offline").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Convert into Google Form/ })).toBeDisabled();
  await context.setOffline(false);
  await expect(page.getByRole("button", { name: /Convert into Google Form/ })).toBeEnabled();
});

test("draft survives a page reload", async ({ page }) => {
  await page.goto("/dashboard");
  await fillEditor(page, { title: "Kept title", input: "Q1: kept" });
  await page.reload();
  await expect(page.getByLabel("Form Title")).toHaveValue("Kept title");
  await expect(page.getByLabel("Paste Your Questions")).toHaveValue("Q1: kept");
});

test.describe("Forms API protection", () => {
  const body = { title: "T", description: "", input: SAMPLE, publish: true };

  test("rejects requests without a CSRF token or from another origin", async ({ page }) => {
    await page.goto("/dashboard");
    const noToken = await page.request.post("/api/forms", { data: body, headers: { origin: E2E_BASE_URL } });
    expect(noToken.status()).toBe(403);
    const crossSite = await page.request.post("/api/forms", { data: body, headers: { origin: "https://evil.example", "x-csrf-token": CSRF } });
    expect(crossSite.status()).toBe(403);
    expect((await mockStats()).creates).toBe(0);
  });

  test("re-validates input on the server", async ({ page }) => {
    await page.goto("/dashboard");
    const res = await page.request.post("/api/forms", {
      data: { ...body, input: "Q1: x?\nA. a\nB. b\nANSWER: Z\nMARKS: 1" },
      headers: { origin: E2E_BASE_URL, "x-csrf-token": CSRF },
    });
    expect(res.status()).toBe(422);
    const json = await res.json();
    expect(json.error.code).toBe("validation_failed");
    expect(json.error.issues[0].code).toBe("ANSWER_NOT_FOUND");
    expect((await mockStats()).creates).toBe(0);
  });

  test("rejects malformed bodies and oversize input", async ({ page }) => {
    await page.goto("/dashboard");
    const headers = { origin: E2E_BASE_URL, "x-csrf-token": CSRF };
    expect((await page.request.post("/api/forms", { data: "not json", headers: { ...headers, "content-type": "application/json" } })).status()).toBe(400);
    expect((await page.request.post("/api/forms", { data: { title: 1 }, headers })).status()).toBe(400);
    expect((await page.request.post("/api/forms", { data: { ...body, input: "x".repeat(100_001) }, headers })).status()).toBe(400);
    expect((await page.request.post("/api/forms/..%2F..%2Fetc/resume", { data: body, headers })).status()).toBe(400);
  });

  test("unauthenticated API calls get 401", async ({ request }) => {
    const res = await request.post("/api/forms", { data: body, headers: { origin: E2E_BASE_URL } });
    expect(res.status()).toBe(401);
  });
});
