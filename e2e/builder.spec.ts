import { expect, test, type Page } from "@playwright/test";
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

const bar = (page: Page) => page.getByTestId("action-bar");
const status = (page: Page) => page.getByTestId("flow-status");

test("one canvas: no Quiz Settings, no instructions, no API jargon, two default sections @mobile", async ({ page }) => {
  await page.goto("/dashboard");
  const body = page.locator("main");
  await expect(body).not.toContainText("Quiz Settings");
  await expect(body).not.toContainText(/Introductory instructions/i);
  await expect(body).not.toContainText(/Forms API|doesn.t prove/i);
  await expect(page.getByPlaceholder("Description (optional)", { exact: true })).toHaveCount(0);
  await expect(body).not.toContainText(/Response validation/i);
  await expect(page.getByLabel("Collect email addresses")).toHaveCount(0);

  const sections = page.getByTestId("section");
  await expect(sections).toHaveCount(2);
  await expect(sections.nth(0)).toHaveAttribute("data-kind", "details");
  await expect(page.getByLabel("Section 1 title")).toHaveValue("Student Identification");
  await expect(sections.nth(1)).toHaveAttribute("data-kind", "questions");
  await expect(page.getByLabel("Section 2 title")).toHaveValue("Questions");
  await expect(sections.nth(1).getByLabel("Paste Your Questions")).toBeVisible();
  await expect(sections.nth(0).getByLabel("Field label")).toHaveCount(3);
  await expect(sections.nth(0).getByLabel("Field label").nth(0)).toHaveValue("Enrollment No.");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("creation needs a current validation and preview; edits make them stale", async ({ page }) => {
  await page.goto("/dashboard");
  await fillEditor(page, { title: "Quiz", input: SAMPLE });
  await expect(bar(page).getByRole("button", { name: "Preview Form" })).toBeDisabled();
  await expect(bar(page).getByRole("button", { name: "Convert into Google Form" })).toBeDisabled();

  await bar(page).getByRole("button", { name: "Validate Questions" }).click();
  await expect(status(page)).toHaveAttribute("data-status", "validated");
  await expect(bar(page).getByRole("button", { name: "Convert into Google Form" })).toBeDisabled();

  // Editing questions after validation makes it stale.
  await page.getByLabel("Paste Your Questions").fill(SAMPLE.replace("MARKS: 2", "MARKS: 3"));
  await expect(status(page)).toHaveAttribute("data-status", "validation-stale");
  await expect(page.getByTestId("validation-stale")).toBeVisible();
  await expect(bar(page).getByRole("button", { name: "Preview Form" })).toBeDisabled();

  await bar(page).getByRole("button", { name: "Validate Questions" }).click();
  await bar(page).getByRole("button", { name: "Preview Form" }).click();
  await expect(page.getByText("Total questions: 2 | Total marks: 4")).toBeVisible();
  await page.getByRole("button", { name: "Back to Editor" }).click();
  await expect(status(page)).toHaveAttribute("data-status", "previewed");
  await expect(bar(page).getByRole("button", { name: "Convert into Google Form" })).toBeEnabled();

  // Editing a field after preview blocks creation until validated and previewed again.
  await page.getByLabel("Field label").nth(2).fill("Phone No.");
  await expect(bar(page).getByRole("button", { name: "Convert into Google Form" })).toBeDisabled();
  await bar(page).getByRole("button", { name: "Validate Questions" }).click();
  await expect(status(page)).toHaveAttribute("data-status", "preview-stale");
  await expect(bar(page).getByRole("button", { name: "Convert into Google Form" })).toBeDisabled();
  expect((await mockStats()).creates).toBe(0);
});

test("fields and sections are edited inline and the created form matches", async ({ page }) => {
  await page.goto("/dashboard");
  await fillEditor(page, { title: "Mid-term Exam", input: SAMPLE_4 });
  const details = page.getByTestId("section").nth(0);

  // Edit, add, change type, toggle required, duplicate, reorder and delete fields.
  await details.getByLabel("Field label").nth(2).fill("Mobile No. (optional)");
  await details.getByRole("button", { name: "Add Field", exact: true }).click();
  await details.getByLabel("Field label").last().fill("Batch");
  await details.getByRole("button", { name: "Field type for Batch" }).click();
  await details.getByRole("menuitemradio", { name: "Dropdown" }).click();
  await details.getByLabel("Batch option 1", { exact: true }).fill("B1");
  await details.getByRole("button", { name: "Add option" }).click();
  await details.getByLabel("Batch option 2", { exact: true }).fill("B2");
  await details.getByRole("switch", { name: "Required: Batch" }).check();
  await details.getByRole("button", { name: "Add Paragraph field" }).click();
  await details.getByLabel("Field label").last().fill("Remarks");
  await details.getByRole("button", { name: "Duplicate Remarks" }).click();
  await expect(details.getByLabel("Field label")).toHaveCount(6);
  await details.getByRole("button", { name: "Delete Remarks (copy)" }).click();
  await details.getByRole("button", { name: "Move Batch up" }).click();
  await expect(details.getByTestId("id-field")).toHaveCount(5);

  // Add a section inline and move Q3 and Q4 into it.
  await page.getByRole("button", { name: "Add Section", exact: true }).click();
  await expect(page.getByTestId("section")).toHaveCount(3);
  await page.getByLabel("Section 3 title").fill("Part B");
  await page.getByLabel("Move Q3 to section").selectOption({ label: "Part B" });
  await page.getByLabel("Move Q4 to section").selectOption({ label: "Part B" });
  await expect(page.getByTestId("section").nth(2).getByTestId("question-card")).toHaveCount(2);

  await bar(page).getByRole("button", { name: "Validate Questions" }).click();
  await expect(page.getByTestId("validation-summary")).toContainText("6Total marks");
  await bar(page).getByRole("button", { name: "Preview Form" }).click();
  await expect(page.getByTestId("preview-section")).toHaveCount(3);
  await expect(page.getByTestId("preview-field")).toHaveCount(5);
  await expect(page.getByTestId("settings-summary")).toHaveCount(0);
  await page.getByRole("button", { name: /Convert into Google Form/ }).click();
  await page.getByRole("dialog", { name: "Create this Google Form?" }).getByTestId("confirm-create").click();
  await expect(page.getByTestId("success-title")).toBeVisible();
  await expect(page.getByTestId("manual-checklist")).toHaveCount(0);
  await expect(page.getByText("You may change your Google Form Settings & Response validation as per Your Requirements.")).toBeVisible();
  // Donation appeal sits after the respondent link and before "Create Another Form".
  const donation = page.getByTestId("donation");
  await expect(donation.getByRole("img", { name: /Satyam Education Charitable Trust/ })).toBeVisible();
  const order = await page.evaluate(() => {
    const y = (el: Element | null) => el?.getBoundingClientRect().top ?? -1;
    return [
      y(document.querySelector('[data-testid="responder-link"]')),
      y(document.querySelector('[data-testid="donation"]')),
      y([...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Create Another Form")) ?? null),
    ];
  });
  expect(order[0]).toBeLessThan(order[1]);
  expect(order[1]).toBeLessThan(order[2]);

  const form = await lastMockForm();
  expect(form.settings?.emailCollectionType).toBe("VERIFIED");
  expect(form.settings?.quizSettings?.isQuiz).toBe(true);
  type Item = { title?: string; pageBreakItem?: object; textItem?: object; questionItem?: { question: { required?: boolean; choiceQuestion?: { type: string; options: { value: string }[] }; textQuestion?: { paragraph?: boolean } } } };
  const items = form.items as Item[];
  expect(items.map((i) => `${i.pageBreakItem ? "page" : i.textItem ? "text" : "q"}:${i.title}`)).toEqual([
    "text:Student Identification",
    "q:Enrollment No.",
    "q:Student Name (as per university records)",
    "q:Batch",
    "q:Mobile No. (optional)",
    "q:Remarks",
    "page:Questions",
    "q:What does CPU stand for?",
    "q:Which language is used for web page structure?",
    "page:Part B",
    "q:Which unit stores data permanently?",
    "q:Which device is used for input?",
  ]);
  expect(items[3].questionItem?.question).toMatchObject({ required: true, choiceQuestion: { type: "DROP_DOWN", options: [{ value: "B1" }, { value: "B2" }] } });
  expect(items[5].questionItem?.question.textQuestion?.paragraph).toBe(true);
  expect((await mockStats()).creates).toBe(1);
});

test("deleting a section with questions asks where they go and never drops them silently", async ({ page }) => {
  await page.goto("/dashboard");
  await fillEditor(page, { title: "Quiz", input: SAMPLE_4 });
  await page.getByRole("button", { name: "Add Section", exact: true }).click();
  await page.getByLabel("Move Q4 to section").selectOption({ label: "Untitled section" });
  await page.getByRole("button", { name: "Delete Untitled section" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete “Untitled section”?" });
  await expect(dialog).toContainText("It contains 1 question");
  await dialog.getByRole("button", { name: "Move questions and delete section" }).click();
  await expect(page.getByTestId("section")).toHaveCount(2);
  await expect(page.getByTestId("question-card")).toHaveCount(4);

  // Explicitly deleting the questions removes them from the pasted text.
  await page.getByRole("button", { name: "Add Section", exact: true }).click();
  await page.getByLabel("Move Q4 to section").selectOption({ label: "Untitled section" });
  await page.getByRole("button", { name: "Delete Untitled section" }).click();
  await page.getByRole("dialog").getByLabel("Delete the questions too").check();
  await page.getByRole("dialog").getByRole("button", { name: "Delete section and questions" }).click();
  await expect(page.getByLabel("Paste Your Questions")).not.toHaveValue(/Q4:/);
  await expect(page.getByTestId("question-card")).toHaveCount(3);
});

test("field problems block validation with short messages", async ({ page }) => {
  await page.goto("/dashboard");
  await fillEditor(page, { title: "Quiz", input: SAMPLE });
  await page.getByLabel("Field label").nth(1).fill("enrollment no.");
  await page.getByRole("button", { name: "Add Section", exact: true }).click();
  await bar(page).getByRole("button", { name: "Validate Questions" }).click();
  const errors = page.getByTestId("validation-errors");
  await expect(errors).toContainText("Two fields have the same label");
  await expect(errors).toContainText("has no questions");
  await expect(status(page)).toHaveAttribute("data-status", "invalid");
});

test("fields and sections survive a reload", async ({ page }) => {
  await page.goto("/dashboard");
  await fillEditor(page, { title: "Quiz", input: SAMPLE });
  await page.getByLabel("Field label").nth(0).fill("Roll No.");
  await page.getByRole("button", { name: "Add Section", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Field label").nth(0)).toHaveValue("Roll No.");
  await expect(page.getByTestId("section")).toHaveCount(3);
});
