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
  duplicateField,
  FIELD_TYPES,
  legacyConfig,
  moveField,
  moveQuestionToSection,
  moveQuestionWithinSection,
  moveSection,
  questionTemplate,
  reconcileSections,
  removeField,
  removeQuestionBlocks,
  removeSection,
  updateField,
  updateSection,
  validateFormConfig,
  formConfigSchema,
  withFixedSettings,
  type FormConfig,
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
const fresh = () => reconcileSections(defaultConfig(), [1, 2, 3, 4]);

/** The default two sections plus a third section "Part B" holding Q3 and Q4. */
function examConfig(): FormConfig {
  let config = addSection(fresh());
  const third = config.sections.at(-1)!.id;
  config = moveQuestionToSection(config, 3, third);
  config = moveQuestionToSection(config, 4, third);
  return updateSection(config, third, { title: "Part B", description: "Answer all." });
}

describe("defaults", () => {
  it("every new form starts with exactly two sections: Student Identification, then Questions", () => {
    const config = defaultConfig();
    expect(config.sections.map((s) => [s.kind, s.title])).toEqual([
      ["details", "Student Identification"],
      ["questions", "Questions"],
    ]);
    expect(config.fields.map((f) => [f.label, f.type, f.required])).toEqual([
      ["Enrollment No.", "short", true],
      ["Student Name (as per university records)", "short", true],
      ["Mobile No.", "short", false],
    ]);
  });

  it("uses the fixed version-one settings", () => {
    const config = defaultConfig();
    expect(config.quiz).toEqual({ isQuiz: true, releaseGrades: "later", showMissed: false, showCorrect: false, showPoints: false });
    expect(config.responses).toEqual({ emailCollection: "verified", sendCopy: "off", allowEditing: false, limitOneResponse: true });
    expect(config.defaults).toEqual({ required: true, defaultPoints: 1 });
    // Drafts saved by an older version with edited settings get the fixed settings back.
    const edited = { ...config, quiz: { ...config.quiz, isQuiz: false }, responses: { ...config.responses, emailCollection: "do_not_collect" as const } };
    expect(withFixedSettings(edited).quiz.isQuiz).toBe(true);
    expect(withFixedSettings(edited).responses.emailCollection).toBe("verified");
  });

  it("puts every parsed question into the Questions section in text order", () => {
    const config = fresh();
    expect(config.sections[1].questions).toEqual([1, 2, 3, 4]);
    expect(validateFormConfig(config, quiz()).errors).toEqual([]);
  });

  it("question templates use 1 mark, and imported MARKS always win", () => {
    const template = questionTemplate(1, defaultConfig().defaults.defaultPoints);
    expect(template).toContain("MARKS: 1");
    const parsed = parseQuiz({ input: template.replace("MARKS: 1", "MARKS: 5"), title: "t" });
    if (!parsed.ok) throw new Error("template should parse");
    const request = buildContentRequests(parsed.quiz, reconcileSections(legacyConfig(), [1]))[0];
    expect(request.createItem?.item?.questionItem?.question?.grading?.pointValue).toBe(5);
  });

  it("preserves option order exactly as pasted", () => {
    const mcq = planItems(quiz(), fresh()).find((i) => i.question === 1)!.item;
    expect(mcq.questionItem?.question?.choiceQuestion?.options).toEqual([{ value: "A. Yes 1" }, { value: "B. No 1" }]);
    expect(mcq.questionItem?.question?.choiceQuestion).not.toHaveProperty("shuffle");
  });
});

describe("identification fields", () => {
  it("adds, edits, duplicates, reorders and deletes fields", () => {
    let config = fresh();
    const [enrollment, name, mobile] = config.fields;
    config = addField(config, { ...blankField(), id: "seat", label: "University Seat No." }, enrollment.id);
    expect(config.fields.map((f) => f.label)).toEqual(["Enrollment No.", "University Seat No.", "Student Name (as per university records)", "Mobile No."]);

    config = updateField(config, mobile.id, { required: true, label: "Mobile No. (with country code)" });
    expect(config.fields[3]).toMatchObject({ required: true, label: "Mobile No. (with country code)" });

    config = duplicateField(config, enrollment.id);
    expect(config.fields[1]).toMatchObject({ label: "Enrollment No. (copy)" });
    expect(config.fields[1].id).not.toBe(enrollment.id);

    config = moveField(config, name.id, -1);
    expect(config.fields.map((f) => f.label)).toEqual([
      "Enrollment No.", "Enrollment No. (copy)", "Student Name (as per university records)", "University Seat No.", "Mobile No. (with country code)",
    ]);
    expect(moveField(config, enrollment.id, -1)).toEqual(config); // already first

    for (const f of config.fields) config = removeField(config, f.id);
    expect(config.fields).toEqual([]);
    // The section stays (two default sections), but an empty one is flagged.
    expect(config.sections.map((s) => s.kind)).toEqual(["details", "questions"]);
    expect(validateFormConfig(config, quiz()).errors.map((e) => e.code)).toEqual(["SECTION_EMPTY"]);
  });

  it("recreates the Student Identification section if a field is added after it was deleted", () => {
    const withoutDetails = removeSection(fresh(), "details", "discard").config;
    expect(withoutDetails.sections.map((s) => s.kind)).toEqual(["questions"]);
    const config = addField(withoutDetails, { ...blankField(), label: "Roll No." });
    expect(config.sections.map((s) => [s.kind, s.title])).toEqual([
      ["details", "Student Identification"],
      ["questions", "Questions"],
    ]);
  });

  it("rejects empty and duplicate labels", () => {
    let config = fresh();
    config = addField(config, { ...blankField(), label: "  " });
    config = addField(config, { ...blankField(), label: "Roll No." });
    config = addField(config, { ...blankField(), label: "roll  no." });
    const codes = validateFormConfig(config, quiz()).errors.map((e) => e.code);
    expect(codes).toEqual(["FIELD_LABEL_MISSING", "FIELD_LABEL_DUPLICATE"]);
  });

  it("changing the type sets up or clears options", () => {
    let config = addField(fresh(), { ...blankField(), id: "f1", label: "Batch" });
    config = updateField(config, "f1", { type: "dropdown" });
    expect(config.fields.at(-1)!.options).toEqual(["Option 1"]);
    config = updateField(config, "f1", { type: "date" });
    expect(config.fields.at(-1)!.options).toEqual([]);
  });

  it("validates choice options", () => {
    const check = (options: string[]) =>
      validateFormConfig(addField(fresh(), { ...blankField(), label: "Division", type: "dropdown", options }), quiz()).errors.map((e) => e.code);
    expect(check(["A", "B"])).toEqual([]);
    expect(check([])).toEqual(["FIELD_OPTIONS"]);
    expect(check(["A", " "])).toEqual(["FIELD_OPTIONS"]);
    expect(check(["A", "a"])).toEqual(["FIELD_OPTIONS"]);
  });

  it("creates every field type as the matching Google Forms question, without grading", () => {
    let config = fresh();
    for (const type of FIELD_TYPES) {
      config = addField(config, { ...blankField(type), label: `F-${type}`, required: true, options: type === "choice" || type === "checkbox" || type === "dropdown" ? ["01", "+91"] : [] });
    }
    const byLabel = Object.fromEntries(planItems(quiz(), config).map((i) => [i.label, i.item.questionItem?.question]));
    expect(byLabel["Field “F-short”"]).toEqual({ required: true, textQuestion: { paragraph: false } });
    expect(byLabel["Field “F-paragraph”"]).toEqual({ required: true, textQuestion: { paragraph: true } });
    expect(byLabel["Field “F-choice”"]).toEqual({ required: true, choiceQuestion: { type: "RADIO", options: [{ value: "01" }, { value: "+91" }] } });
    expect(byLabel["Field “F-checkbox”"]?.choiceQuestion?.type).toBe("CHECKBOX");
    expect(byLabel["Field “F-dropdown”"]?.choiceQuestion?.type).toBe("DROP_DOWN");
    expect(byLabel["Field “F-date”"]).toEqual({ required: true, dateQuestion: { includeYear: true, includeTime: false } });
    expect(byLabel["Field “F-time”"]).toEqual({ required: true, timeQuestion: { duration: false } });
  });

  it("required and optional default fields are sent as such", () => {
    const fields = planItems(quiz(), fresh()).filter((i) => i.label.startsWith("Field"));
    expect(fields.map((f) => f.item.questionItem?.question?.required)).toEqual([true, true, false]);
  });
});

describe("sections", () => {
  it("adds sections inline after a given section, renames, reorders and deletes them", () => {
    let config = addSection(fresh(), "details");
    expect(config.sections.map((s) => s.title)).toEqual(["Student Identification", "Untitled section", "Questions"]);
    const id = config.sections[1].id;
    config = updateSection(config, id, { title: "Part B" });
    config = moveSection(config, id, 1);
    expect(config.sections.map((s) => s.title)).toEqual(["Student Identification", "Questions", "Part B"]);
    const removed = removeSection(config, id, "discard");
    expect(removed.config.sections.map((s) => s.title)).toEqual(["Student Identification", "Questions"]);
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
    const two = fresh();
    expect(removeSection(two, "questions", "discard").config).toBe(two);
    expect(removeSection(config, b.id, { moveTo: "nope" }).config).toBe(config);
  });

  it("deleting Student Identification removes its fields (after confirmation in the UI)", () => {
    const result = removeSection(examConfig(), "details", "discard");
    expect(result.config.fields).toEqual([]);
    expect(result.config.sections.every((s) => s.kind === "questions")).toBe(true);
  });

  it("reconcile keeps teacher assignments, drops removed questions and places new ones after their predecessor", () => {
    const config = examConfig();
    expect(reconcileSections(config, [1, 2, 3, 4, 5]).sections[2].questions).toEqual([3, 4, 5]);
    expect(reconcileSections(config, [1, 3, 4]).sections[1].questions).toEqual([1]);
    expect(reconcileSections(config, [1, 2, 3, 4])).toBe(config);
  });

  it("flags empty sections and assignment mistakes", () => {
    const empty = addSection(fresh());
    expect(validateFormConfig(empty, quiz()).errors.map((e) => e.code)).toEqual(["SECTION_EMPTY"]);

    const broken = structuredClone(examConfig());
    broken.sections[1].questions.push(3); // Q3 now in two sections
    broken.sections[2].questions = broken.sections[2].questions.filter((n) => n !== 4); // Q4 nowhere
    broken.sections[2].questions.push(9); // unknown
    expect(validateFormConfig(broken, quiz()).errors.map((e) => e.message)).toEqual([
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
      "0:text:Student Identification",
      "1:short:Enrollment No.",
      "2:short:Student Name (as per university records)",
      "3:short:Mobile No.",
      "4:pageBreak:Questions",
      "5:mcq:Question 1?",
      "6:mcq:Question 2?",
      "7:pageBreak:Part B",
      "8:mcq:Question 3?",
      "9:mcq:Question 4?",
    ]);
    expect(requests[0].createItem?.item?.description).toBe("Please provide the following details.");
    expect(requests[7].createItem?.item?.description).toBe("Answer all.");
    expect(requests[4].createItem?.item).not.toHaveProperty("description");
  });

  it("a single section gets no extra heading", () => {
    const items = planItems(quiz(), reconcileSections(legacyConfig(), [1, 2, 3, 4])).map((i) => i.item);
    expect(items.every((i) => i.questionItem)).toBe(true);
  });

  it("the plan used by the preview matches the created order and totals", () => {
    const plan = buildFormPlan(quiz(), moveQuestionWithinSection(examConfig(), 4, -1));
    expect(plan.sections.map((s) => s.questions.map((q) => q.number))).toEqual([[], [1, 2], [4, 3]]);
    expect(plan.sections[0].fields).toHaveLength(3);
    expect(plan.questionCount).toBe(4);
    expect(plan.totalMarks).toBe(10);
  });
});

describe("fixed settings", () => {
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

  it("the server forces the fixed settings whatever the client sends", () => {
    const tampered = { ...fresh(), quiz: { ...fresh().quiz, isQuiz: false }, responses: { ...fresh().responses, emailCollection: "do_not_collect" as const } };
    const fixed = withFixedSettings(tampered);
    expect(buildSettingsRequests({ ...quiz(), description: "" }, fixed)[0].updateSettings?.settings).toEqual({
      quizSettings: { isQuiz: true },
      emailCollectionType: "VERIFIED",
    });
  });

  it("drafts with response-validation rules from the previous version still load (rules are ignored)", () => {
    const old = structuredClone(defaultConfig()) as unknown as { fields: Record<string, unknown>[] };
    old.fields[0].validation = { category: "length", operator: "max", value: "10", value2: "", errorText: "" };
    const parsed = formConfigSchema.safeParse(old);
    expect(parsed.success && parsed.data.fields[0]).not.toHaveProperty("validation");
  });

  it("MCQs are required", () => {
    expect(buildContentRequests(quiz(), fresh()).filter((r) => r.createItem?.item?.questionItem?.question?.grading).every((r) => r.createItem?.item?.questionItem?.question?.required)).toBe(true);
  });

  it("the server schema rejects malformed configs and the removed instructions field is ignored", () => {
    const body = { title: "t", input: INPUT, config: { ...defaultConfig(), responses: { ...defaultConfig().responses, emailCollection: "everyone" } } };
    expect(createFormRequestSchema.safeParse(body).success).toBe(false);
    const parsed = createFormRequestSchema.safeParse({ ...body, config: { ...defaultConfig(), instructions: "x" } });
    expect(parsed.success && parsed.data.config).not.toHaveProperty("instructions");
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
