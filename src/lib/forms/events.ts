/**
 * Event protocol streamed (as newline-delimited JSON) from POST /api/forms to the
 * browser. Every "done" event is emitted only after the corresponding Google API
 * call has returned successfully.
 */

export type StepId = "create" | "quiz" | "questions" | "verify" | "publish";

export const STEP_LABELS: Record<StepId, string> = {
  create: "Creating form",
  quiz: "Applying quiz and response settings",
  questions: "Adding sections, student fields, questions, answer keys and marks",
  verify: "Verifying the result",
  publish: "Publishing the form",
};

export const STEP_ORDER: StepId[] = ["create", "quiz", "questions", "verify", "publish"];

export type StepStatus = "pending" | "active" | "done" | "skipped" | "failed";

export interface CreateResult {
  formId: string;
  title: string;
  editUrl: string;
  /** Respondent link from Google (form.responderUri). */
  responderUrl: string | null;
  published: boolean;
  questionCount: number;
  totalMarks: number;
  sectionCount: number;
  /** Student identification fields created. */
  fieldCount: number;
}

export type FailureCode =
  | "session_expired"
  | "google_permission_denied"
  | "google_api_disabled"
  | "google_quota"
  | "google_not_found"
  | "google_unavailable"
  | "google_error"
  | "verification_failed"
  | "resume_unsafe";

export interface CreateFailure {
  code: FailureCode;
  message: string;
  step: StepId;
  /** Present when the form already exists in the teacher's account (partial failure). */
  formId?: string;
  editUrl?: string;
  responderUrl?: string | null;
  /** True when the remaining steps can be retried on the same form without creating a duplicate. */
  resumable: boolean;
  details?: string[];
}

export type CreateEvent =
  | { type: "step"; step: StepId; status: Exclude<StepStatus, "pending"> }
  | { type: "form"; formId: string; editUrl: string }
  | { type: "result"; result: CreateResult }
  | { type: "error"; error: CreateFailure };
