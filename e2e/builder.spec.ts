import { expect, test } from "@playwright/test";
import { fillEditor, lastMockForm, mockStats, resetMock, SAMPLE, signIn } from "./helpers";

test.beforeEach(async ({ context }) => {
  await resetMock();
  await signIn(context);
});

const SAMPLE_4 = `${SAMPLE}

Q3: Which unit stores data permanently?
OPTIONS:
A. RAM
B. Hard disk
ANSWER: B
MARKS: 2

Q4: Which device is used for input?
OPTIONS:
A. Monitor
B. Keyboard
ANSWER: B
MARKS: 1`;

test("builds a sectioned exam with student fields, previews it and creates it in order", async ({ page }) => {
  await page.goto("/dashboard");
  await fillEditor(page, { title: "Mid-term Exam", input: SAMPLE_4 });

  // Student identification: quick-add three fields and a custom one.
  const idCard = page.getByTestId("identification-card");
  await idCard.getByRole("button", { name: /Student Identification/ }).click();
  await idCard.getByRole("button", { name: "+ Enrollment No." }).click();
  await idCard.getByRole("button", { name: "+ Student Name" }).click();
  await idCard.getByRole("button", { name: "+ Mobile No." }).click();
  await idCard.getByRole("button", { name: "Add Identification Field" }).click();
  await idCard.getByLabel("Field label").last().fill("University Seat No.");
  await expect(idCard.getByTestId("id-field")).toHaveCount(4);
  await idCard.getByRole("button", { name: "Move University Seat No. up" }).click();
  await expect(idCard.getByTestId("id-field").nth(2)).toContainText("University Seat No.");

  // Sections: Student Details was created automatically; add Part B and move Q3, Q4 there.
  const sections = page.getByTestId("sections");
  await expect(sections.getByTestId("section")).toHaveCount(2);
  await sections.getByRole("button", { name: "Add Section" }).click();
  await sections.getByLabel("Section 3 title").fill("Part B");
  await sections.getByLabel("Move Q3 to section").selectOption({ label: "Part B" });
  await sections.getByLabel("Move Q4 to section").selectOption({ label: "Part B" });
  await expect(sections.getByTestId("section").nth(2).getByTestId("section-question")).toHaveCount(2);

  // Preview straight from the action bar.
  await page.getByTestId("action-bar").getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("heading", { name: "Preview Your Google Form" })).toBeVisible();
  await expect(page.getByTestId("preview-section")).toHaveCount(3);
  await expect(page.getByTestId("preview-field")).toHaveCount(4);
  await expect(page.getByTestId("preview-section").nth(2)).toContainText("Part B");
  await expect(page.getByTestId("preview-section").nth(2).getByTestId("preview-question")).toHaveCount(2);
  await expect(page.getByText("Total questions: 4 | Total marks: 6")).toBeVisible();
  const summary = page.getByTestId("settings-summary");
  await expect(summary.locator('[data-status="auto"]')).toContainText("Collect email addresses");
  await expect(summary.locator('[data-status="manual"]')).toContainText("Release grades");
  await expect(summary.locator('[data-status="manual"]')).toContainText("Limit to 1 response");
  await expect(summary.locator('[data-status="auto"]')).not.toContainText("Release grades");

  await page.getByRole("button", { name: /Convert into Google Form/ }).click();
  await page.getByRole("dialog", { name: "Create this Google Form?" }).getByTestId("confirm-create").click();
  await expect(page.getByTestId("success-title")).toBeVisible();
  await expect(page.getByTestId("manual-checklist")).toContainText("Settings → Quizzes → Release grades → Later, after manual review");
  await expect(page.getByTestId("verified-settings")).toContainText("Collect email addresses: Verified");

  const form = await lastMockForm();
  expect(form.settings?.emailCollectionType).toBe("VERIFIED");
  const outline = form.items.map((item) => `${item.pageBreakItem ? "page" : item.textItem ? "text" : "q"}:${item.title}`);
  expect(outline).toEqual([
    "text:Student Details",
    "q:Enrollment No.",
    "q:Student Name (as per university records)",
    "q:University Seat No.",
    "q:Mobile No.",
    "page:Assessment Questions",
    "q:What does CPU stand for?",
    "q:Which language is used for web page structure?",
    "page:Part B",
    "q:Which unit stores data permanently?",
    "q:Which device is used for input?",
  ]);
  expect((await mockStats()).creates).toBe(1);
});

test("deleting a section with questions asks where they go and never drops them silently", async ({ page }) => {
  await page.goto("/dashboard");
  await fillEditor(page, { title: "Quiz", input: SAMPLE_4 });
  const sections = page.getByTestId("sections");
  await sections.getByRole("button", { name: "Add Section" }).click();
  await sections.getByLabel("Move Q4 to section").selectOption({ label: "Section 2" });
  await sections.getByRole("button", { name: "Delete Section 2" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete “Section 2”?" });
  await expect(dialog).toContainText("It contains 1 question");
  await dialog.getByRole("button", { name: "Move questions and delete section" }).click();
  await expect(sections.getByTestId("section")).toHaveCount(1);
  await expect(sections.getByTestId("section-question")).toHaveCount(4);

  // Explicitly deleting the questions removes them from the pasted text.
  await sections.getByRole("button", { name: "Add Section" }).click();
  await sections.getByLabel("Move Q4 to section").selectOption({ label: "Section 2" });
  await sections.getByRole("button", { name: "Delete Section 2" }).click();
  await page.getByRole("dialog").getByLabel("Delete the questions too").check();
  await page.getByRole("dialog").getByRole("button", { name: "Delete section and questions" }).click();
  await expect(page.getByLabel("Paste Your Questions")).not.toHaveValue(/Q4:/);
  await expect(sections.getByTestId("section-question")).toHaveCount(3);
});

test("configuration problems block creation with clear messages", async ({ page }) => {
  await page.goto("/dashboard");
  await fillEditor(page, { title: "Quiz", input: SAMPLE });
  const idCard = page.getByTestId("identification-card");
  await idCard.getByRole("button", { name: /Student Identification/ }).click();
  await idCard.getByRole("button", { name: "Add Identification Field" }).click();
  await idCard.getByRole("button", { name: "Add Identification Field" }).click();
  await idCard.getByLabel("Field label").first().fill("Roll No.");
  await idCard.getByLabel("Field label").last().fill("roll no.");
  await page.getByTestId("sections").getByRole("button", { name: "Add Section" }).click();
  await page.getByRole("button", { name: "Validate Questions" }).click();
  const errors = page.getByTestId("validation-errors");
  await expect(errors).toContainText("have the same label");
  await expect(errors).toContainText("has no questions");
  expect((await mockStats()).creates).toBe(0);
});

test("settings survive a reload and are applied to the created form", async ({ page }) => {
  await page.goto("/dashboard");
  await fillEditor(page, { title: "Quiz", input: SAMPLE });
  const settings = page.getByTestId("quiz-settings");
  await settings.getByRole("button", { name: /Quiz Settings/ }).click();
  await settings.getByLabel("Collect email addresses").selectOption("do_not_collect");
  await settings.getByRole("switch", { name: "Limit to 1 response" }).uncheck();
  await page.reload();
  await page.getByTestId("quiz-settings").getByRole("button", { name: /Quiz Settings/ }).click();
  await expect(page.getByLabel("Collect email addresses")).toHaveValue("do_not_collect");
  await expect(page.getByRole("switch", { name: "Limit to 1 response" })).not.toBeChecked();

  await page.getByRole("button", { name: "Validate Questions" }).click();
  await page.getByRole("button", { name: "View Preview" }).click();
  await expect(page.getByTestId("settings-summary")).toContainText("Do not collect");
  await page.getByRole("button", { name: /Convert into Google Form/ }).click();
  await page.getByRole("dialog", { name: "Create this Google Form?" }).getByTestId("confirm-create").click();
  await expect(page.getByTestId("success-title")).toBeVisible();
  expect((await lastMockForm()).settings?.emailCollectionType).toBeUndefined();
});
