import { beforeEach, describe, expect, it, vi } from "vitest";
import type { forms_v1 } from "@googleapis/forms";
import { createQuiz, resumeQuiz, type FormsApi } from "@/lib/forms/forms-service";
import { buildQuestionRequests, buildSettingsRequests, editUrlFor, verifyForm } from "@/lib/forms/build-requests";
import type { CreateEvent } from "@/lib/forms/events";
import { parseQuiz, SAMPLE_INPUT } from "@/lib/quiz/parser";
import type { Quiz } from "@/lib/quiz/types";

function sampleQuiz(): Quiz {
  const result = parseQuiz({ input: SAMPLE_INPUT });
  if (!result.ok) throw new Error("sample should parse");
  return result.quiz;
}

/** In-memory fake of the Google Forms API that applies batchUpdate requests like Google does. */
class FakeForms implements FormsApi {
  form: forms_v1.Schema$Form | null = null;
  calls: string[] = [];
  failOn: Partial<Record<"create" | "batch1" | "batch2" | "get" | "publish", unknown>> = {};
  private batchCount = 0;
  tamper?: (form: forms_v1.Schema$Form) => void;

  async create(title: string) {
    this.calls.push("create");
    if (this.failOn.create) throw this.failOn.create;
    this.form = { formId: "FORM_ID_1234567890", info: { title, documentTitle: title }, items: [], settings: {}, responderUri: "https://docs.google.com/forms/d/e/RESP/viewform", publishSettings: { publishState: { isPublished: false, isAcceptingResponses: false } } };
    return structuredClone(this.form);
  }
  async batchUpdate(formId: string, requests: forms_v1.Schema$Request[]) {
    this.batchCount += 1;
    this.calls.push(`batch${this.batchCount}`);
    const key = `batch${this.batchCount}` as "batch1" | "batch2";
    if (this.failOn[key]) throw this.failOn[key];
    if (!this.form || formId !== this.form.formId) throw { response: { status: 404 } };
    for (const r of requests) {
      if (r.updateSettings) this.form.settings = { ...this.form.settings, quizSettings: { isQuiz: r.updateSettings.settings?.quizSettings?.isQuiz ?? false } };
      if (r.updateFormInfo) this.form.info = { ...this.form.info, description: r.updateFormInfo.info?.description };
      if (r.createItem) this.form.items!.splice(r.createItem.location?.index ?? 0, 0, { itemId: `i${this.form.items!.length}`, ...r.createItem.item });
    }
  }
  async get(formId: string) {
    this.calls.push("get");
    if (this.failOn.get) throw this.failOn.get;
    if (!this.form || formId !== this.form.formId) throw { response: { status: 404 } };
    const copy = structuredClone(this.form);
    this.tamper?.(copy);
    return copy;
  }
  async publish() {
    this.calls.push("publish");
    if (this.failOn.publish) throw this.failOn.publish;
    this.form!.publishSettings = { publishState: { isPublished: true, isAcceptingResponses: true } };
  }
}

const collect = () => {
  const events: CreateEvent[] = [];
  return { events, emit: (e: CreateEvent) => events.push(e) };
};

describe("request builders", () => {
  it("builds quiz settings and description requests with update masks", () => {
    expect(buildSettingsRequests(sampleQuiz())).toEqual([
      { updateSettings: { settings: { quizSettings: { isQuiz: true } }, updateMask: "quizSettings.isQuiz" } },
      { updateFormInfo: { info: { description: "Unit 1 Assessment" }, updateMask: "description" } },
    ]);
    expect(buildSettingsRequests({ ...sampleQuiz(), description: "" })).toHaveLength(1);
  });

  it("builds graded RADIO questions in order with integer points and one answer key", () => {
    const requests = buildQuestionRequests(sampleQuiz());
    expect(requests).toHaveLength(2);
    expect(requests[0]).toEqual({
      createItem: {
        item: {
          title: "What does CPU stand for?",
          questionItem: {
            question: {
              required: true,
              choiceQuestion: {
                type: "RADIO",
                options: [
                  { value: "A. Central Processing Unit" },
                  { value: "B. Computer Personal Unit" },
                  { value: "C. Central Program Utility" },
                  { value: "D. Control Processing User" },
                ],
              },
              grading: { pointValue: 2, correctAnswers: { answers: [{ value: "A. Central Processing Unit" }] } },
            },
          },
        },
        location: { index: 0 },
      },
    });
    expect(requests[1].createItem?.location?.index).toBe(1);
    expect(requests[1].createItem?.item?.questionItem?.question?.grading?.correctAnswers?.answers?.[0].value).toBe("B. HTML");
  });

  it("uses the documented edit URL format", () => {
    expect(editUrlFor("abc_DEF-123")).toBe("https://docs.google.com/forms/d/abc_DEF-123/edit");
  });
});

describe("createQuiz", () => {
  let api: FakeForms;
  beforeEach(() => {
    api = new FakeForms();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("creates, configures, verifies and publishes a real quiz structure", async () => {
    const { events, emit } = collect();
    const result = await createQuiz(api, sampleQuiz(), { publish: true }, emit);
    expect(api.calls).toEqual(["create", "batch1", "batch2", "get", "publish"]);
    expect(result).toEqual({
      formId: "FORM_ID_1234567890",
      title: "Introduction to IT Systems",
      editUrl: "https://docs.google.com/forms/d/FORM_ID_1234567890/edit",
      responderUrl: "https://docs.google.com/forms/d/e/RESP/viewform",
      published: true,
      questionCount: 2,
      totalMarks: 3,
    });
    const steps = events.filter((e) => e.type === "step").map((e) => e.type === "step" && `${e.step}:${e.status}`);
    expect(steps).toEqual([
      "create:active", "create:done", "quiz:active", "quiz:done", "questions:active", "questions:done",
      "verify:active", "verify:done", "publish:active", "publish:done",
    ]);
    expect(events.at(-1)?.type).toBe("result");
    expect(verifyForm(api.form!, sampleQuiz())).toEqual([]);
  });

  it("skips publishing when not requested", async () => {
    const { events, emit } = collect();
    const result = await createQuiz(api, sampleQuiz(), { publish: false }, emit);
    expect(api.calls).not.toContain("publish");
    expect(result?.published).toBe(false);
    expect(events).toContainEqual({ type: "step", step: "publish", status: "skipped" });
  });

  it("reports failure before a form exists without a form ID", async () => {
    api.failOn.create = { response: { status: 403, data: { error: { status: "PERMISSION_DENIED", message: "Google Forms API has not been used in project 1 before or it is disabled." } } } };
    const { events, emit } = collect();
    expect(await createQuiz(api, sampleQuiz(), { publish: true }, emit)).toBeNull();
    const error = events.find((e) => e.type === "error");
    expect(error).toMatchObject({ type: "error", error: { code: "google_api_disabled", step: "create", resumable: false } });
    expect(error?.type === "error" && error.error.formId).toBeUndefined();
  });

  it("reports a partial failure with the existing form and never creates a second form", async () => {
    api.failOn.batch2 = { response: { status: 503 } };
    const { events, emit } = collect();
    expect(await createQuiz(api, sampleQuiz(), { publish: true }, emit)).toBeNull();
    expect(api.calls.filter((c) => c === "create")).toHaveLength(1);
    expect(events).toContainEqual({ type: "form", formId: "FORM_ID_1234567890", editUrl: editUrlFor("FORM_ID_1234567890") });
    expect(events.at(-1)).toMatchObject({
      type: "error",
      error: { code: "google_unavailable", step: "questions", formId: "FORM_ID_1234567890", resumable: true },
    });
  });

  it("maps an expired token to session_expired", async () => {
    api.failOn.create = { response: { status: 401 } };
    const { events, emit } = collect();
    await createQuiz(api, sampleQuiz(), { publish: true }, emit);
    expect(events.at(-1)).toMatchObject({ type: "error", error: { code: "session_expired" } });
  });

  it("does not report success or publish when verification finds a mismatch", async () => {
    api.tamper = (form) => {
      form.items![1].questionItem!.question!.grading!.pointValue = 5;
    };
    const { events, emit } = collect();
    expect(await createQuiz(api, sampleQuiz(), { publish: true }, emit)).toBeNull();
    expect(api.calls).not.toContain("publish");
    expect(events.some((e) => e.type === "result")).toBe(false);
    expect(events.at(-1)).toMatchObject({ type: "error", error: { code: "verification_failed", details: ["Q2: Marks should be 1."] } });
  });

  it("reports publish failure as resumable with the form link", async () => {
    api.failOn.publish = { response: { status: 500 } };
    const { events, emit } = collect();
    await createQuiz(api, sampleQuiz(), { publish: true }, emit);
    expect(events.at(-1)).toMatchObject({ type: "error", error: { step: "publish", resumable: true, formId: "FORM_ID_1234567890" } });
  });
});

describe("resumeQuiz", () => {
  let api: FakeForms;
  beforeEach(() => {
    api = new FakeForms();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("adds questions to an empty existing form without calling create", async () => {
    api.failOn.batch2 = { response: { status: 503 } };
    await createQuiz(api, sampleQuiz(), { publish: true }, () => {});
    api.failOn = {};
    api.calls = [];
    const { events, emit } = collect();
    const result = await resumeQuiz(api, "FORM_ID_1234567890", sampleQuiz(), { publish: true }, emit);
    expect(result?.published).toBe(true);
    expect(api.calls).not.toContain("create");
    expect(events).toContainEqual({ type: "step", step: "quiz", status: "skipped" });
    expect(verifyForm(api.form!, sampleQuiz())).toEqual([]);
  });

  it("only publishes when the questions were already added", async () => {
    api.failOn.publish = { response: { status: 500 } };
    await createQuiz(api, sampleQuiz(), { publish: true }, () => {});
    api.failOn = {};
    api.calls = [];
    const result = await resumeQuiz(api, "FORM_ID_1234567890", sampleQuiz(), { publish: true }, () => {});
    expect(result?.published).toBe(true);
    expect(api.calls).toEqual(["get", "get", "publish"]);
  });

  it("refuses to modify a form whose questions differ", async () => {
    await createQuiz(api, sampleQuiz(), { publish: false }, () => {});
    const other = { ...sampleQuiz(), questions: sampleQuiz().questions.slice(0, 1) };
    const { events, emit } = collect();
    expect(await resumeQuiz(api, "FORM_ID_1234567890", other, { publish: true }, emit)).toBeNull();
    expect(events.at(-1)).toMatchObject({ type: "error", error: { code: "resume_unsafe", resumable: false } });
  });

  it("reports a missing form as not found", async () => {
    const { events, emit } = collect();
    await resumeQuiz(api, "MISSING_FORM_123", sampleQuiz(), { publish: true }, emit);
    expect(events.at(-1)).toMatchObject({ type: "error", error: { code: "google_not_found", resumable: false } });
  });
});
