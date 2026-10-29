import { beforeEach, describe, expect, it, vi } from "vitest";
import type { forms_v1 } from "@googleapis/forms";
import { buildContentRequests, buildSettingsRequests, planItems, verifyForm } from "@/lib/forms/build-requests";
import type { CreateEvent } from "@/lib/forms/events";
import { createQuiz, resumeQuiz, type FormsApi } from "@/lib/forms/forms-service";
import { createFormRequestSchema } from "@/lib/forms/request-schema";
import {
  addField,
  addSection,
  blankField,
  defaultConfig,
  describeSettings,
  duplicateField,
  FIELD_PRESETS,
  manualSteps,
  moveField,
  moveQuestionToSection,
  moveQuestionWithinSection,
  moveSection,
  newId,
  questionTemplate,
  reconcileSections,
  removeField,
  removeQuestionBlocks,
  removeSection,
  updateField,
  updateSection,
  validateFormConfig,
  type FormConfig,
  type IdField,
} from "@/lib/quiz/form-config";
import { buildFormPlan } from "@/lib/quiz/form-plan";
import { parseQuiz } from "@/lib/quiz/parser";
import type { Quiz } from "@/lib/quiz/types";

const INPUT = [1, 2, 3, 4]
  .map((n) => `Q${n}: Question ${n}?\nOPTIONS:\nA. Yes ${n}\nB. No ${n}\nANSWER: ${n % 2 ? "A" : "B"}\nMARKS: ${n}`)
  .join("\n\n");

function quiz(input = INPUT): Quiz {
  const result = parseQuiz({ input, title: "Unit test", description: "" });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.quiz;
}

const numbers = (q: Quiz) => q.questions.map((x) => x.number);
const preset = (name: string): IdField => ({ ...structuredClone(FIELD_PRESETS.find((p) => p.name === name)!.field), id: newId() });

/** Student Details (Enrollment, Name, Mobile) + two assessment sections. */
function examConfig(q = quiz()): FormConfig {
  let config = reconcileSections(defaultConfig(), numbers(q));
  config = addField(config, preset("Enrollment No."));
  config = addField(config, preset("Student Name"));
  config = addField(config, preset("Mobile No."));
  config = addSection(config);
  const second = config.sections.at(-1)!.id;
  config = moveQuestionToSection(config, 3, second);
  config = moveQuestionToSection(config, 4, second);
  return updateSection(config, second, { title: "Part B", description: "Answer all." });
}

describe("defaults", () => {
  it("match the specification", () => {
    const config = defaultConfig();
    expect(config.quiz).toEqual({ isQuiz: true, releaseGrades: "later", showMissed: false, showCorrect: false, showPoints: false });
    expect(config.responses).toEqual({ emailCollection: "verified", sendCopy: "off", allowEditing: false, limitOneResponse: true });
    expect(config.defaults).toEqual({ required: true, defaultPoints: 1 });
    expect(config.fields).toEqual([]);
    expect(config.sections).toHaveLength(1);
  });

  it("puts every parsed question in the single default section in text order", () => {
    const config = reconcileSections(defaultConfig(), [1, 2, 3, 4]);
    expect(config.sections[0].questions).toEqual([1, 2, 3, 4]);
    expect(validateFormConfig(config, quiz()).errors).toEqual([]);
  });

  it("the default point value is used for new question templates, and imported MARKS override it", () => {
    const template = questionTemplate(1, 3);
    expect(template).toContain("MARKS: 3");
    const parsed = parseQuiz({ input: template.replace("MARKS: 3", "MARKS: 5"), title: "t" });
    expect(parsed.ok && parsed.quiz.questions[0].marks).toBe(5);
    const config = { ...reconcileSections(defaultConfig(), [1]), defaults: { required: true, defaultPoints: 1 } };
    const request = buildContentRequests(parsed.ok ? parsed.quiz : quiz(), config)[0];
    expect(request.createItem?.item?.questionItem?.question?.grading?.pointValue).toBe(5);
  });
});

describe("identification fields", () => {
  it("adds a Student Details section before the questions on the first field", () => {
    const config = addField(reconcileSections(defaultConfig(), [1, 2, 3, 4]), preset("Enrollment No."));
    expect(config.sections.map((s) => s.kind)).toEqual(["details", "questions"]);
    expect(config.sections[0].title).toBe("Student Details");
  });

  it("edits, duplicates, reorders and deletes fields", () => {
    let config = addField(defaultConfig(), preset("Enrollment No."));
    config = addField(config, preset("Mobile No."));
    const [a, b] = config.fields;
    config = updateField(config, a.id, { required: false, description: "As on your ID card" });
    expect(config.fields[0]).toMatchObject({ required: false, description: "As on your ID card" });

    config = duplicateField(config, a.id);
    expect(config.fields.map((f) => f.label)).toEqual(["Enrollment No.", "Enrollment No. (copy)", "Mobile No."]);
    expect(config.fields[1].id).not.toBe(a.id);

    config = moveField(config, b.id, -1);
    expect(config.fields.map((f) => f.label)).toEqual(["Enrollment No.", "Mobile No.", "Enrollment No. (copy)"]);
    expect(moveField(config, a.id, -1)).toEqual(config); // already first

    config = removeField(removeField(removeField(config, a.id), b.id), config.fields[2].id);
    expect(config.fields).toEqual([]);
    expect(config.sections.some((s) => s.kind === "details")).toBe(false);
  });

  it("supports arbitrary custom fields, not only the presets", () => {
    let config = reconcileSections(defaultConfig(), [1, 2, 3, 4]);
    for (const label of ["University Seat No.", "Batch", "Department", "Semester"]) {
      config = addField(config, { ...blankField(), label });
    }
    expect(validateFormConfig(config, quiz()).errors).toEqual([]);
    expect(planItems(quiz(), config).map((i) => i.label).slice(1, 5)).toEqual([
      "Field “University Seat No.”", "Field “Batch”", "Field “Department”", "Field “Semester”",
    ]);
  });

  it("rejects empty and duplicate labels", () => {
    let config = reconcileSections(defaultConfig(), [1, 2, 3, 4]);
    config = addField(config, { ...blankField(), label: "  " });
    config = addField(config, { ...blankField(), label: "Roll No." });
    config = addField(config, { ...blankField(), label: "roll  no." });
    const codes = validateFormConfig(config, quiz()).errors.map((e) => e.code);
    expect(codes).toEqual(["FIELD_LABEL_MISSING", "FIELD_LABEL_DUPLICATE"]);
  });

  it("validates length and pattern rules, and only on short-answer fields", () => {
    const base = reconcileSections(defaultConfig(), [1, 2, 3, 4]);
    const check = (field: Partial<IdField>) => validateFormConfig(addField(base, { ...blankField(), label: "X", ...field }), quiz()).errors.map((e) => e.code);
    expect(check({ validation: { kind: "length", min: 10, max: 10 } })).toEqual([]);
    expect(check({ validation: { kind: "length", min: 12, max: 10 } })).toEqual(["FIELD_VALIDATION"]);
    expect(check({ validation: { kind: "length", min: null, max: null } })).toEqual(["FIELD_VALIDATION"]);
    expect(check({ validation: { kind: "pattern", pattern: "^\\d{10}$" } })).toEqual([]);
    expect(check({ validation: { kind: "pattern", pattern: "([" } })).toEqual(["FIELD_VALIDATION"]);
    expect(check({ type: "number", validation: { kind: "pattern", pattern: "x" } })).toEqual(["FIELD_VALIDATION"]);
    // Changing the type resets rules that do not apply.
    const id = addField(base, { ...blankField(), id: "f1", label: "X", validation: { kind: "pattern", pattern: "x" } });
    expect(updateField(id, "f1", { type: "number" }).fields[0].validation).toEqual({ kind: "none" });
  });

  it("validates dropdown options", () => {
    const base = reconcileSections(defaultConfig(), [1, 2, 3, 4]);
    const check = (options: string[]) =>
      validateFormConfig(addField(base, { ...blankField(), label: "Division", type: "dropdown", options }), quiz()).errors.map((e) => e.code);
    expect(check(["A", "B"])).toEqual([]);
    expect(check([])).toEqual(["FIELD_OPTIONS"]);
    expect(check(["A", " "])).toEqual(["FIELD_OPTIONS"]);
    expect(check(["A", "a"])).toEqual(["FIELD_OPTIONS"]);
  });

  it("creates number and phone fields as text so leading zeros and prefixes are preserved", () => {
    let config = reconcileSections(defaultConfig(), [1, 2, 3, 4]);
    config = addField(config, { ...blankField(), label: "Enrollment No.", type: "number" });
    config = addField(config, { ...blankField(), label: "Division", type: "dropdown", options: ["01", "007", "+91"] });
    const items = planItems(quiz(), config);
    const enrollment = items.find((i) => i.label === "Field “Enrollment No.”")!.item;
    expect(enrollment.questionItem?.question).toEqual({ required: true, textQuestion: { paragraph: false } });
    const division = items.find((i) => i.label === "Field “Division”")!.item;
    expect(division.questionItem?.question?.choiceQuestion).toEqual({ type: "DROP_DOWN", options: [{ value: "01" }, { value: "007" }, { value: "+91" }] });
    // Number validation can't be set through the API, so it becomes a manual step.
    expect(manualSteps(config, { publish: true })).toContain("Question “Enrollment No.” → ⋮ → Response validation → Number → Is number");
  });

  it("required and optional fields are sent as such, without grading", () => {
    const items = planItems(quiz(), examConfig());
    const fields = items.filter((i) => i.label.startsWith("Field"));
    expect(fields.map((f) => f.item.questionItem?.question?.required)).toEqual([true, true, false]);
    expect(fields.every((f) => !f.item.questionItem?.question?.grading)).toBe(true);
  });
});

describe("sections", () => {
  it("adds, renames, reorders and deletes sections", () => {
    let config = reconcileSections(defaultConfig(), [1, 2, 3, 4]);
    config = addSection(config);
    const id = config.sections[1].id;
    config = updateSection(config, id, { title: "Part B" });
    expect(config.sections.map((s) => s.title)).toEqual(["Assessment Questions", "Part B"]);
    config = moveSection(config, id, -1);
    expect(config.sections.map((s) => s.title)).toEqual(["Part B", "Assessment Questions"]);
    const removed = removeSection(config, id, "discard");
    expect(removed.config.sections.map((s) => s.title)).toEqual(["Assessment Questions"]);
    expect(removed.discarded).toEqual([]);
  });

  it("moves questions between sections and reorders within a section", () => {
    let config = examConfig();
    const [, a, b] = config.sections;
    expect(a.questions).toEqual([1, 2]);
    expect(b.questions).toEqual([3, 4]);
    config = moveQuestionWithinSection(config, 4, -1);
    expect(config.sections[2].questions).toEqual([4, 3]);
    config = moveQuestionToSection(config, 1, b.id);
    expect(config.sections[1].questions).toEqual([2]);
    expect(config.sections[2].questions).toEqual([4, 3, 1]);
    expect(validateFormConfig(config, quiz()).errors).toEqual([]);
  });

  it("never silently loses questions when a section is deleted", () => {
    const config = examConfig();
    const [, a, b] = config.sections;
    const moved = removeSection(config, b.id, { moveTo: a.id });
    expect(moved.config.sections.find((s) => s.id === a.id)!.questions).toEqual([1, 2, 3, 4]);
    expect(moved.discarded).toEqual([]);

    const discarded = removeSection(config, b.id, "discard");
    expect(discarded.discarded).toEqual([3, 4]);
    // The caller removes discarded questions from the text explicitly.
    const input = removeQuestionBlocks(INPUT, quiz(), discarded.discarded);
    expect(numbers(quiz(input))).toEqual([1, 2]);
    expect(input).toContain("MARKS: 2");

    // The last questions section can't be removed, and an unknown target changes nothing.
    const single = reconcileSections(defaultConfig(), [1, 2, 3, 4]);
    expect(removeSection(single, single.sections[0].id, "discard").config).toBe(single);
    expect(removeSection(config, b.id, { moveTo: "nope" }).config).toBe(config);
  });

  it("deleting the Student Details section removes its fields (after confirmation in the UI)", () => {
    const config = examConfig();
    const result = removeSection(config, config.sections[0].id, "discard");
    expect(result.config.fields).toEqual([]);
    expect(result.config.sections.every((s) => s.kind === "questions")).toBe(true);
  });

  it("reconcile keeps teacher assignments, drops removed questions and places new ones after their predecessor", () => {
    const config = examConfig();
    const after = reconcileSections(config, [1, 2, 3, 4, 5]);
    expect(after.sections[2].questions).toEqual([3, 4, 5]);
    const removed = reconcileSections(config, [1, 3, 4]);
    expect(removed.sections[1].questions).toEqual([1]);
    expect(reconcileSections(config, [1, 2, 3, 4])).toBe(config);
  });

  it("flags empty sections and assignment mistakes", () => {
    const empty = addSection(reconcileSections(defaultConfig(), [1, 2, 3, 4]));
    expect(validateFormConfig(empty, quiz()).errors.map((e) => e.code)).toEqual(["SECTION_EMPTY"]);

    const broken = structuredClone(examConfig());
    broken.sections[1].questions.push(3); // Q3 now in two sections
    broken.sections[2].questions = broken.sections[2].questions.filter((n) => n !== 4); // Q4 nowhere
    broken.sections[2].questions.push(9); // unknown
    const messages = validateFormConfig(broken, quiz()).errors.map((e) => e.message);
    expect(messages).toEqual([
      "Not assigned to a section: Q4.",
      "Assigned to more than one section: Q3.",
      "Sections refer to questions that are not in your text: Q9.",
    ]);
  });

  it("builds items in section order with page breaks for sections 2..N", () => {
    const requests = buildContentRequests(quiz(), examConfig());
    const shape = requests.map((r) => {
      const item = r.createItem!.item!;
      const kind = item.pageBreakItem ? "pageBreak" : item.textItem ? "text" : item.questionItem?.question?.textQuestion ? "short" : "mcq";
      return `${r.createItem!.location!.index}:${kind}:${item.title}`;
    });
    expect(shape).toEqual([
      "0:text:Student Details",
      "1:short:Enrollment No.",
      "2:short:Student Name (as per university records)",
      "3:short:Mobile No.",
      "4:pageBreak:Assessment Questions",
      "5:mcq:Question 1?",
      "6:mcq:Question 2?",
      "7:pageBreak:Part B",
      "8:mcq:Question 3?",
      "9:mcq:Question 4?",
    ]);
    expect(requests[7].createItem?.item?.description).toBe("Answer all.");
    expect(requests[4].createItem?.item).not.toHaveProperty("description");
  });

  it("puts instructions first and gives a single section no extra heading", () => {
    const config = { ...reconcileSections(defaultConfig(), [1, 2, 3, 4]), instructions: "No calculators." };
    const items = planItems(quiz(), config).map((i) => i.item);
    expect(items[0]).toEqual({ title: "Instructions", description: "No calculators.", textItem: {} });
    expect(items.slice(1).every((i) => i.questionItem)).toBe(true);
  });

  it("the plan used by the preview matches the created order and totals", () => {
    const plan = buildFormPlan(quiz(), moveQuestionWithinSection(examConfig(), 4, -1));
    expect(plan.sections.map((s) => s.questions.map((q) => q.number))).toEqual([[], [1, 2], [4, 3]]);
    expect(plan.questionCount).toBe(4);
    expect(plan.totalMarks).toBe(10);
  });
});

describe("quiz settings", () => {
  it("applies quiz mode and verified email collection through updateSettings", () => {
    expect(buildSettingsRequests({ ...quiz(), description: "" }, defaultConfig())).toEqual([
      {
        updateSettings: {
          settings: { quizSettings: { isQuiz: true }, emailCollectionType: "VERIFIED" },
          updateMask: "quizSettings.isQuiz,emailCollectionType",
        },
      },
    ]);
  });

  it("never marks settings the API can't set as applied", () => {
    const reports = describeSettings(defaultConfig(), { publish: true });
    const status = Object.fromEntries(reports.map((r) => [r.key, r.status]));
    expect(status).toMatchObject({
      isQuiz: "auto",
      grading: "auto",
      emailCollection: "auto",
      publish: "auto",
      releaseGrades: "manual",
      showMissed: "manual",
      showCorrect: "manual",
      showPoints: "manual",
      sendCopy: "manual",
      allowEditing: "manual",
      limitOneResponse: "manual",
      access: "needs_auth",
      globalDefaults: "unsupported",
    });
    expect(manualSteps(defaultConfig(), { publish: true })).toContain("Settings → Quizzes → Release grades → Later, after manual review");
  });

  it("reflects the teacher's choices in the settings summary", () => {
    const config = defaultConfig();
    config.quiz.releaseGrades = "immediately";
    config.quiz.showCorrect = true;
    config.responses.emailCollection = "responder_input";
    const values = Object.fromEntries(describeSettings(config, { publish: false }).map((r) => [r.key, r.value]));
    expect(values).toMatchObject({ releaseGrades: "Immediately after each submission", showCorrect: "On", emailCollection: "Responder input", publish: "No (draft)" });
  });

  it("quiz mode off creates ungraded questions and warns the teacher", () => {
    const config = reconcileSections(defaultConfig(), [1, 2, 3, 4]);
    config.quiz.isQuiz = false;
    expect(validateFormConfig(config, quiz()).warnings.map((w) => w.code)).toContain("QUIZ_OFF");
    expect(buildContentRequests(quiz(), config).every((r) => !r.createItem?.item?.questionItem?.question?.grading)).toBe(true);
    expect(describeSettings(config, { publish: true }).some((r) => r.key === "releaseGrades")).toBe(false);
  });

  it("questions follow the 'required by default' setting", () => {
    const config = reconcileSections(defaultConfig(), [1, 2, 3, 4]);
    config.defaults.required = false;
    expect(buildContentRequests(quiz(), config).every((r) => r.createItem?.item?.questionItem?.question?.required === false)).toBe(true);
  });

  it("the server schema rejects malformed settings", () => {
    const body = { title: "t", input: INPUT, config: { ...defaultConfig(), responses: { ...defaultConfig().responses, emailCollection: "everyone" } } };
    expect(createFormRequestSchema.safeParse(body).success).toBe(false);
    expect(createFormRequestSchema.safeParse({ ...body, config: defaultConfig() }).success).toBe(true);
  });
});

/** Minimal Forms API fake that applies requests like Google does. */
class FakeForms implements FormsApi {
  form: forms_v1.Schema$Form | null = null;
  calls: string[] = [];
  failBatch?: { at: number; error: unknown };
  publishResult?: forms_v1.Schema$PublishSettings;
  private batches = 0;

  async create(title: string) {
    this.calls.push("create");
    this.form = { formId: "FORM_ID_SECTIONS_1", info: { title }, items: [], settings: {}, responderUri: "https://docs.google.com/forms/d/e/R/viewform" };
    return structuredClone(this.form);
  }
  async batchUpdate(_formId: string, requests: forms_v1.Schema$Request[]) {
    this.batches += 1;
    this.calls.push(`batch${this.batches}`);
    if (this.failBatch?.at === this.batches) throw this.failBatch.error;
    for (const r of requests) {
      if (r.updateSettings) this.form!.settings = structuredClone(r.updateSettings.settings!);
      if (r.updateFormInfo) this.form!.info = { ...this.form!.info, description: r.updateFormInfo.info?.description };
      if (r.createItem) {
        const index = r.createItem.location!.index!;
        if (index > this.form!.items!.length) throw { response: { status: 400, data: { error: { message: "index out of range" } } } };
        this.form!.items!.splice(index, 0, structuredClone(r.createItem.item!));
      }
    }
  }
  async get() {
    this.calls.push("get");
    return structuredClone(this.form!);
  }
  async publish() {
    this.calls.push("publish");
    return this.publishResult ?? { publishState: { isPublished: true, isAcceptingResponses: true } };
  }
}

describe("creating a sectioned exam", () => {
  let api: FakeForms;
  const events: CreateEvent[] = [];
  const emit = (e: CreateEvent) => events.push(e);
  beforeEach(() => {
    api = new FakeForms();
    events.length = 0;
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("creates, verifies and publishes every section, field and question", async () => {
    const result = await createQuiz(api, quiz(), examConfig(), { publish: true }, emit);
    expect(result).toMatchObject({ published: true, questionCount: 4, totalMarks: 10, sectionCount: 3, fieldCount: 3 });
    expect(api.form!.settings?.emailCollectionType).toBe("VERIFIED");
    expect(verifyForm(api.form!, quiz(), examConfig())).toEqual([]);
  });

  it("verification catches a changed field or missing section", async () => {
    await createQuiz(api, quiz(), examConfig(), { publish: false }, emit);
    const form = structuredClone(api.form!);
    form.items![1].questionItem!.question!.required = false;
    expect(verifyForm(form, quiz(), examConfig())).toEqual([{ message: "Field “Enrollment No.”: Should be required." }]);
    form.items!.splice(7, 1);
    expect(verifyForm(form, quiz(), examConfig())[0].message).toMatch(/^Expected 10 items/);
    form.settings!.emailCollectionType = "DO_NOT_COLLECT";
    expect(verifyForm(form, quiz(), examConfig()).map((p) => p.message)).toContain("The email collection setting does not match.");
  });

  it("does not report publication when Google does not confirm it", async () => {
    api.publishResult = { publishState: { isPublished: false, isAcceptingResponses: false } };
    expect(await createQuiz(api, quiz(), examConfig(), { publish: true }, emit)).toBeNull();
    expect(events.at(-1)).toMatchObject({ type: "error", error: { code: "verification_failed", step: "publish", formId: "FORM_ID_SECTIONS_1", resumable: true } });
  });

  it("reports quota and permission failures with the existing form and resumes without duplicates", async () => {
    api.failBatch = { at: 2, error: { response: { status: 429, data: { error: { status: "RESOURCE_EXHAUSTED" } } } } };
    expect(await createQuiz(api, quiz(), examConfig(), { publish: true }, emit)).toBeNull();
    expect(events.at(-1)).toMatchObject({ type: "error", error: { code: "google_quota", step: "questions", formId: "FORM_ID_SECTIONS_1", resumable: true } });
    expect(api.form!.items).toEqual([]); // atomic batch: nothing half-written

    api.failBatch = undefined;
    api.calls = [];
    const result = await resumeQuiz(api, "FORM_ID_SECTIONS_1", quiz(), examConfig(), { publish: true }, emit);
    expect(result?.sectionCount).toBe(3);
    expect(api.calls).not.toContain("create");
    expect(events).toContainEqual({ type: "step", step: "quiz", status: "skipped" });
  });

  it("maps a missing-scope permission error", async () => {
    api.failBatch = { at: 1, error: { response: { status: 403, data: { error: { status: "PERMISSION_DENIED", message: "Request had insufficient authentication scopes." } } } } };
    await createQuiz(api, quiz(), examConfig(), { publish: true }, emit);
    expect(events.at(-1)).toMatchObject({ type: "error", error: { code: "google_permission_denied", step: "quiz", resumable: true } });
  });

  it("refuses to resume onto a form whose sections differ", async () => {
    await createQuiz(api, quiz(), examConfig(), { publish: false }, emit);
    const other = removeSection(examConfig(), examConfig().sections[0].id, "discard").config;
    expect(await resumeQuiz(api, "FORM_ID_SECTIONS_1", quiz(), other, { publish: true }, emit)).toBeNull();
    expect(events.at(-1)).toMatchObject({ type: "error", error: { code: "resume_unsafe" } });
  });
});
