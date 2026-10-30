import type { forms_v1 } from "@googleapis/forms";
import { hasOptions, type EmailCollection, type FormConfig, type IdField } from "@/lib/quiz/form-config";
import { buildFormPlan, firstSectionHasHeading } from "@/lib/quiz/form-plan";
import type { Quiz, QuizOption, QuizQuestion } from "@/lib/quiz/types";

/** Text shown for each option in Google Forms, e.g. "A. Central Processing Unit". */
export function optionValue(option: QuizOption): string {
  return `${option.label}. ${option.text}`;
}

export function correctOptionValue(question: QuizQuestion): string {
  const option = question.options.find((o) => o.label === question.answer);
  if (!option) throw new Error(`Question ${question.number} has no option ${question.answer}.`);
  return optionValue(option);
}

/** Edit URL format documented by Google: https://docs.google.com/forms/d/{formId}/edit */
export function editUrlFor(formId: string): string {
  return `https://docs.google.com/forms/d/${encodeURIComponent(formId)}/edit`;
}

const EMAIL_COLLECTION_TYPES: Record<EmailCollection, string> = {
  verified: "VERIFIED",
  responder_input: "RESPONDER_INPUT",
  do_not_collect: "DO_NOT_COLLECT",
};

export function emailCollectionTypeFor(config: FormConfig): string {
  return EMAIL_COLLECTION_TYPES[config.responses.emailCollection];
}

/** Google omits the field (or reports UNSPECIFIED) when emails are not collected. */
export function normalizeEmailCollectionType(value: string | null | undefined): string {
  return !value || value === "EMAIL_COLLECTION_TYPE_UNSPECIFIED" ? "DO_NOT_COLLECT" : value;
}

/**
 * Step 2: quiz mode, email collection and description (applied atomically).
 * These are the only form-level settings the Forms API exposes; everything else
 * in Google Forms → Settings must be set by the teacher (see describeSettings).
 */
export function buildSettingsRequests(quiz: Quiz, config: FormConfig): forms_v1.Schema$Request[] {
  const requests: forms_v1.Schema$Request[] = [
    {
      updateSettings: {
        settings: { quizSettings: { isQuiz: config.quiz.isQuiz }, emailCollectionType: emailCollectionTypeFor(config) },
        updateMask: "quizSettings.isQuiz,emailCollectionType",
      },
    },
  ];
  if (quiz.description) {
    requests.push({
      updateFormInfo: {
        info: { description: quiz.description },
        updateMask: "description",
      },
    });
  }
  return requests;
}

/** One item to create, with a teacher-facing label for verification messages. */
export interface PlannedItem {
  label: string;
  /** Question number, for MCQs. */
  question?: number;
  item: forms_v1.Schema$Item;
}

function withDescription(item: forms_v1.Schema$Item, description: string): forms_v1.Schema$Item {
  return description ? { ...item, description } : item;
}

const CHOICE_TYPES = { choice: "RADIO", checkbox: "CHECKBOX", dropdown: "DROP_DOWN" } as const;

function fieldQuestion(field: IdField): forms_v1.Schema$Question {
  const required = field.required;
  if (hasOptions(field.type)) {
    const type = CHOICE_TYPES[field.type as keyof typeof CHOICE_TYPES];
    return { required, choiceQuestion: { type, options: field.options.map((value) => ({ value })) } };
  }
  if (field.type === "date") return { required, dateQuestion: { includeYear: true, includeTime: false } };
  if (field.type === "time") return { required, timeQuestion: { duration: false } };
  // Text answers keep leading zeros and "+91" prefixes exactly as typed.
  return { required, textQuestion: { paragraph: field.type === "paragraph" } };
}

function fieldItem(field: IdField): forms_v1.Schema$Item {
  return { title: field.label, questionItem: { question: fieldQuestion(field) } };
}

function mcqItem(question: QuizQuestion, config: FormConfig): forms_v1.Schema$Item {
  return {
    title: question.text,
    questionItem: {
      question: {
        required: config.defaults.required,
        choiceQuestion: {
          type: "RADIO",
          options: question.options.map((option) => ({ value: optionValue(option) })),
        },
        ...(config.quiz.isQuiz
          ? { grading: { pointValue: question.marks, correctAnswers: { answers: [{ value: correctOptionValue(question) }] } } }
          : {}),
      },
    },
  };
}

/**
 * Every item in respondent order, section by section.
 * Sections after the first start with a page break (Google Forms' section
 * header); the first section shares the page with the form title.
 */
export function planItems(quiz: Quiz, config: FormConfig): PlannedItem[] {
  const plan = buildFormPlan(quiz, config);
  const items: PlannedItem[] = [];
  plan.sections.forEach((section, index) => {
    const label = `Section “${section.title}”`;
    if (index > 0) items.push({ label, item: withDescription({ title: section.title, pageBreakItem: {} }, section.description) });
    else if (firstSectionHasHeading(plan)) items.push({ label, item: withDescription({ title: section.title, textItem: {} }, section.description) });
    for (const field of section.fields) items.push({ label: `Field “${field.label}”`, item: fieldItem(field) });
    for (const question of section.questions) items.push({ label: `Q${question.number}`, question: question.number, item: mcqItem(question, config) });
  });
  return items;
}

/**
 * Step 3: one createItem per planned item at explicit increasing indices
 * (sub-requests apply in order, so index i is always valid). One batchUpdate
 * means the whole structure is written atomically or not at all.
 */
export function buildContentRequests(quiz: Quiz, config: FormConfig): forms_v1.Schema$Request[] {
  return planItems(quiz, config).map(({ item }, index) => ({ createItem: { item, location: { index } } }));
}

export interface VerificationProblem {
  question?: number;
  message: string;
}

function kindOf(item: forms_v1.Schema$Item): string {
  if (item.pageBreakItem) return "section";
  if (item.textItem) return "heading";
  const question = item.questionItem?.question;
  if (question?.textQuestion) return question.textQuestion.paragraph ? "paragraph" : "short answer";
  if (question?.dateQuestion) return "date";
  if (question?.timeQuestion) return "time";
  const type = question?.choiceQuestion?.type;
  if (type === "RADIO") return "multiple choice";
  if (type === "CHECKBOX") return "checkboxes";
  if (type === "DROP_DOWN") return "dropdown";
  return item.questionItem ? "other question" : "other item";
}

/** Compares the form returned by forms.get with the structure the teacher approved. */
export function verifyForm(form: forms_v1.Schema$Form, quiz: Quiz, config: FormConfig): VerificationProblem[] {
  const problems: VerificationProblem[] = [];
  if (Boolean(form.settings?.quizSettings?.isQuiz) !== config.quiz.isQuiz) {
    problems.push({ message: config.quiz.isQuiz ? "Quiz mode is not enabled." : "Quiz mode should be off." });
  }
  if (normalizeEmailCollectionType(form.settings?.emailCollectionType) !== emailCollectionTypeFor(config)) {
    problems.push({ message: "The email collection setting does not match." });
  }
  if ((form.info?.description ?? "") !== quiz.description) problems.push({ message: "The form description does not match." });
  problems.push(...verifyItems(form.items ?? [], quiz, config));
  return problems;
}

export function verifyItems(actualItems: forms_v1.Schema$Item[], quiz: Quiz, config: FormConfig): VerificationProblem[] {
  const expectedItems = planItems(quiz, config);
  if (actualItems.length !== expectedItems.length) {
    return [{ message: `Expected ${expectedItems.length} items (sections, fields and questions) but the form has ${actualItems.length}.` }];
  }
  const problems: VerificationProblem[] = [];
  expectedItems.forEach(({ label, question, item: expected }, index) => {
    const actual = actualItems[index];
    const fail = (message: string) => problems.push(question !== undefined ? { question, message } : { message: `${label}: ${message}` });
    if (kindOf(actual) !== kindOf(expected)) {
      fail(`Expected a ${kindOf(expected)} item but found a ${kindOf(actual)} item.`);
      return;
    }
    if ((actual.title ?? "") !== (expected.title ?? "")) fail(question !== undefined ? "Question text does not match." : "Title does not match.");
    if ((actual.description ?? "") !== (expected.description ?? "")) fail("Description does not match.");

    const e = expected.questionItem?.question;
    if (!e) return;
    const a = actual.questionItem?.question;
    if (Boolean(a?.required) !== Boolean(e.required)) fail(e.required ? "Should be required." : "Should be optional.");
    if (e.choiceQuestion) {
      const values = (a?.choiceQuestion?.options ?? []).map((o) => o.value ?? "");
      const wanted = (e.choiceQuestion.options ?? []).map((o) => o.value ?? "");
      if (values.length !== wanted.length || values.some((v, i) => v !== wanted[i])) fail("Options do not match.");
    }
    if (e.grading) {
      if (a?.grading?.pointValue !== e.grading.pointValue) fail(`Marks should be ${e.grading.pointValue}.`);
      const answers = (a?.grading?.correctAnswers?.answers ?? []).map((x) => x.value);
      const key = e.grading.correctAnswers?.answers?.[0]?.value;
      if (answers.length !== 1 || answers[0] !== key) fail("Correct answer does not match.");
    } else if (a?.grading?.pointValue || a?.grading?.correctAnswers?.answers?.length) {
      fail("Should not be graded.");
    }
  });
  return problems;
}
