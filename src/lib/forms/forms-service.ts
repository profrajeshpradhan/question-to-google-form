import type { forms_v1 } from "@googleapis/forms";
import type { Quiz } from "@/lib/quiz/types";
import { summarizeQuiz } from "@/lib/quiz/parser";
import { buildQuestionRequests, buildSettingsRequests, editUrlFor, verifyForm } from "./build-requests";
import { mapGoogleError } from "./errors";
import type { CreateEvent, CreateFailure, CreateResult, StepId } from "./events";

/** The subset of the Google Forms API this app uses. */
export interface FormsApi {
  create(title: string): Promise<forms_v1.Schema$Form>;
  batchUpdate(formId: string, requests: forms_v1.Schema$Request[]): Promise<void>;
  get(formId: string): Promise<forms_v1.Schema$Form>;
  publish(formId: string): Promise<void>;
}

export interface RunOptions {
  /** Publish (and accept responses) after verification succeeds. */
  publish: boolean;
}

type Emit = (event: CreateEvent) => void;

class StepFailure extends Error {
  constructor(readonly failure: CreateFailure) {
    super(failure.message);
  }
}

/**
 * Creates a Google Forms quiz in the signed-in teacher's account.
 *
 * Order of operations:
 *  1. forms.create (unpublished, so nobody can respond to a half-built form)
 *  2. batchUpdate: enable quiz mode + description
 *  3. batchUpdate: all questions with options, answer keys and points (atomic)
 *  4. forms.get: verify every question, answer key and point value
 *  5. forms.setPublishSettings: publish and accept responses (optional)
 *
 * Steps 2–5 never create another form, so a failure after step 1 is reported
 * with the existing form's ID and can be resumed with {@link resumeQuiz}.
 */
export async function createQuiz(api: FormsApi, quiz: Quiz, options: RunOptions, emit: Emit): Promise<CreateResult | null> {
  let formId: string | undefined;
  let responderUrl: string | null = null;

  try {
    const created = await step(emit, "create", undefined, () => api.create(quiz.title));
    if (!created.formId) {
      throw new StepFailure({ code: "google_error", message: "Google did not return a form ID.", step: "create", resumable: false });
    }
    formId = created.formId;
    responderUrl = created.responderUri ?? null;
    emit({ type: "form", formId, editUrl: editUrlFor(formId) });

    await step(emit, "quiz", formId, () => api.batchUpdate(formId!, buildSettingsRequests(quiz)));
    await step(emit, "questions", formId, () => api.batchUpdate(formId!, buildQuestionRequests(quiz)));
    return await finish(api, quiz, options, emit, formId, responderUrl);
  } catch (error) {
    emitFailure(emit, error, formId, responderUrl);
    return null;
  }
}

/**
 * Continues a partially created quiz on the SAME form (no duplicate is created).
 * Only proceeds when the form is empty or already exactly matches the quiz.
 */
export async function resumeQuiz(api: FormsApi, formId: string, quiz: Quiz, options: RunOptions, emit: Emit): Promise<CreateResult | null> {
  let responderUrl: string | null = null;
  try {
    const form = await step(emit, "create", formId, () => api.get(formId));
    responderUrl = form.responderUri ?? null;
    emit({ type: "form", formId, editUrl: editUrlFor(formId) });

    const questionItems = (form.items ?? []).filter((item) => item.questionItem);
    const hasOtherItems = (form.items ?? []).length !== questionItems.length;
    const contentMatches = questionItems.length > 0 && !hasOtherItems
      && verifyForm({ ...form, settings: { quizSettings: { isQuiz: true } }, info: { ...form.info, description: quiz.description } }, quiz).length === 0;

    if ((questionItems.length > 0 && !contentMatches) || hasOtherItems) {
      throw new StepFailure({
        code: "resume_unsafe",
        message: "This form already contains questions that differ from your input, so it cannot be completed automatically. Open it in Google Forms to finish it, or delete it and create a new form.",
        step: "questions",
        formId,
        editUrl: editUrlFor(formId),
        responderUrl,
        resumable: false,
      });
    }

    const settingsOk = form.settings?.quizSettings?.isQuiz === true && (form.info?.description ?? "") === quiz.description;
    if (settingsOk) emit({ type: "step", step: "quiz", status: "skipped" });
    else await step(emit, "quiz", formId, () => api.batchUpdate(formId, buildSettingsRequests(quiz)));

    if (contentMatches) emit({ type: "step", step: "questions", status: "skipped" });
    else await step(emit, "questions", formId, () => api.batchUpdate(formId, buildQuestionRequests(quiz)));

    const alreadyPublished = form.publishSettings?.publishState?.isPublished === true;
    return await finish(api, quiz, { publish: options.publish && !alreadyPublished }, emit, formId, responderUrl, alreadyPublished);
  } catch (error) {
    emitFailure(emit, error, formId, responderUrl);
    return null;
  }
}

async function finish(
  api: FormsApi,
  quiz: Quiz,
  options: RunOptions,
  emit: Emit,
  formId: string,
  initialResponderUrl: string | null,
  alreadyPublished = false,
): Promise<CreateResult> {
  const fetched = await step(emit, "verify", formId, () => api.get(formId), false);
  const problems = verifyForm(fetched, quiz);
  const responderUrl = fetched.responderUri ?? initialResponderUrl;
  if (problems.length > 0) {
    emit({ type: "step", step: "verify", status: "failed" });
    throw new StepFailure({
      code: "verification_failed",
      message: "The form was created, but Google returned content that does not match your questions. It has not been published.",
      step: "verify",
      formId,
      editUrl: editUrlFor(formId),
      responderUrl,
      resumable: false,
      details: problems.map((p) => (p.question !== undefined ? `Q${p.question}: ${p.message}` : p.message)),
    });
  }
  emit({ type: "step", step: "verify", status: "done" });

  let published = alreadyPublished;
  if (options.publish) {
    await step(emit, "publish", formId, () => api.publish(formId));
    published = true;
  } else {
    emit({ type: "step", step: "publish", status: "skipped" });
  }

  const summary = summarizeQuiz(quiz);
  const result: CreateResult = {
    formId,
    title: fetched.info?.title ?? quiz.title,
    editUrl: editUrlFor(formId),
    responderUrl,
    published,
    questionCount: summary.questionCount,
    totalMarks: summary.totalMarks,
  };
  emit({ type: "result", result });
  return result;
}

async function step<T>(emit: Emit, id: StepId, formId: string | undefined, run: () => Promise<T>, markDone = true): Promise<T> {
  emit({ type: "step", step: id, status: "active" });
  try {
    const value = await run();
    if (markDone) emit({ type: "step", step: id, status: "done" });
    return value;
  } catch (error) {
    if (error instanceof StepFailure) throw error;
    emit({ type: "step", step: id, status: "failed" });
    const mapped = mapGoogleError(error);
    // Minimal logging: no question content, tokens or user data.
    console.warn(`[forms] step=${id} code=${mapped.code} status=${mapped.status ?? "n/a"}`);
    throw new StepFailure({
      code: mapped.code,
      message: mapped.message,
      step: id,
      formId,
      editUrl: formId ? editUrlFor(formId) : undefined,
      // Steps after "create" only modify the existing form, so they can be retried on it.
      resumable: Boolean(formId) && mapped.code !== "google_not_found",
    });
  }
}

function emitFailure(emit: Emit, error: unknown, formId: string | undefined, responderUrl: string | null) {
  if (error instanceof StepFailure) {
    emit({ type: "error", error: { ...error.failure, responderUrl: error.failure.responderUrl ?? (formId ? responderUrl : undefined) } });
    return;
  }
  console.warn("[forms] unexpected failure");
  emit({
    type: "error",
    error: {
      code: "google_error",
      message: "Something went wrong while creating the form.",
      step: "create",
      formId,
      editUrl: formId ? editUrlFor(formId) : undefined,
      resumable: Boolean(formId),
    },
  });
}
