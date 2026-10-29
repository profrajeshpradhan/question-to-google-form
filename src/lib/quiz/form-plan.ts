import type { FormConfig, IdField } from "./form-config";
import type { Quiz, QuizQuestion } from "./types";

/**
 * The exact structure of the form that will be created, in respondent order.
 * Both the teacher's preview and the Google API request builder are derived
 * from this, so what the teacher approves is what gets created.
 */
export interface PlanSection {
  id: string;
  kind: "details" | "questions";
  title: string;
  description: string;
  fields: IdField[];
  questions: QuizQuestion[];
}

export interface FormPlan {
  title: string;
  description: string;
  instructions: string;
  sections: PlanSection[];
  questionCount: number;
  totalMarks: number;
}

const tidy = (value: string) => value.replace(/\s+/g, " ").trim();

/** Assumes the config was validated against the quiz (every question in exactly one section). */
export function buildFormPlan(quiz: Quiz, config: FormConfig): FormPlan {
  const byNumber = new Map(quiz.questions.map((q) => [q.number, q]));
  const sections = config.sections.map((section) => ({
    id: section.id,
    kind: section.kind,
    title: tidy(section.title),
    description: section.description.trim(),
    fields:
      section.kind === "details"
        ? config.fields.map((f) => ({ ...f, label: tidy(f.label), description: f.description.trim(), options: f.options.map(tidy) }))
        : [],
    questions: section.kind === "questions" ? section.questions.flatMap((n) => byNumber.get(n) ?? []) : [],
  }));
  const questions = sections.flatMap((s) => s.questions);
  return {
    title: quiz.title,
    description: quiz.description,
    instructions: config.instructions.trim(),
    sections,
    questionCount: questions.length,
    totalMarks: questions.reduce((sum, q) => sum + q.marks, 0),
  };
}

/**
 * Google Forms always shows the form title and description at the top of the
 * first section, so the first section's own title is shown as a heading block
 * only when there is more than one section or it has a description.
 */
export function firstSectionHasHeading(plan: FormPlan): boolean {
  return plan.sections.length > 1 || Boolean(plan.sections[0]?.description);
}
