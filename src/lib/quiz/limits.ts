/**
 * Limits shared by the browser (parser feedback) and the server (re-validation).
 * Keep these conservative: every question becomes one Google Forms item and the
 * whole quiz is written in a single atomic batchUpdate request.
 */
export const LIMITS = {
  /** Maximum characters accepted in the question textbox. */
  maxInputChars: 100_000,
  /** Maximum number of questions in one form. */
  maxQuestions: 100,
  /** Minimum options per multiple-choice question. */
  minOptions: 2,
  /** Maximum options per question (labels A–T). */
  maxOptions: 20,
  /** Maximum length of the question text. */
  maxQuestionChars: 1_000,
  /** Maximum length of a single option. */
  maxOptionChars: 500,
  /** Maximum points for a single question. */
  maxMarksPerQuestion: 1_000,
  /** Maximum form title length. */
  maxTitleChars: 200,
  /** Maximum form description length. */
  maxDescriptionChars: 4_000,
} as const;

export type Limits = typeof LIMITS;
