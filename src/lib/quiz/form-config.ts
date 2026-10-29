import { z } from "zod";
import { LIMITS } from "./limits";
import type { IssueCode, Quiz, ValidationIssue } from "./types";

/**
 * Everything about the generated form that is NOT in the pasted question text:
 * student identification fields, sections (and which MCQ goes where), and quiz /
 * response settings. Shared by the browser (editing, preview) and the server
 * (re-validation before any Google API call).
 */

export const CONFIG_LIMITS = {
  maxFields: 20,
  maxFieldOptions: 30,
  maxFieldOptionChars: 200,
  maxLabelChars: 300,
  maxFieldDescriptionChars: 1_000,
  maxSections: 20,
  maxSectionTitleChars: 300,
  maxSectionDescriptionChars: 2_000,
  maxInstructionsChars: 4_000,
  maxPatternChars: 300,
  maxLengthValue: 10_000,
} as const;

export const FIELD_TYPES = ["short", "number", "email", "dropdown", "choice"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  short: "Short answer",
  number: "Number",
  email: "Email",
  dropdown: "Dropdown",
  choice: "Multiple choice",
};

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);
const lengthValue = z.number().int().min(0).max(CONFIG_LIMITS.maxLengthValue).nullable();

export const fieldValidationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("length"), min: lengthValue, max: lengthValue }),
  z.object({ kind: z.literal("pattern"), pattern: z.string().max(CONFIG_LIMITS.maxPatternChars * 2) }),
]);
export type FieldValidation = z.infer<typeof fieldValidationSchema>;

export const idFieldSchema = z.object({
  id: idSchema,
  label: z.string().max(CONFIG_LIMITS.maxLabelChars * 2),
  description: z.string().max(CONFIG_LIMITS.maxFieldDescriptionChars * 2),
  type: z.enum(FIELD_TYPES),
  required: z.boolean(),
  options: z.array(z.string().max(CONFIG_LIMITS.maxFieldOptionChars * 2)).max(CONFIG_LIMITS.maxFieldOptions * 2),
  validation: fieldValidationSchema,
});
export type IdField = z.infer<typeof idFieldSchema>;

export const sectionSchema = z.object({
  id: idSchema,
  /** "details" holds the identification fields; "questions" holds MCQs. */
  kind: z.enum(["details", "questions"]),
  title: z.string().max(CONFIG_LIMITS.maxSectionTitleChars * 2),
  description: z.string().max(CONFIG_LIMITS.maxSectionDescriptionChars * 2),
  /** Question numbers (as written by the teacher, Q1 → 1) in display order. */
  questions: z.array(z.number().int().positive()).max(LIMITS.maxQuestions * 2),
});
export type Section = z.infer<typeof sectionSchema>;

export const EMAIL_COLLECTION = ["verified", "responder_input", "do_not_collect"] as const;
export type EmailCollection = (typeof EMAIL_COLLECTION)[number];

export const formConfigSchema = z.object({
  instructions: z.string().max(CONFIG_LIMITS.maxInstructionsChars * 2),
  fields: z.array(idFieldSchema).max(CONFIG_LIMITS.maxFields * 2),
  sections: z.array(sectionSchema).min(1).max(CONFIG_LIMITS.maxSections * 2),
  quiz: z.object({
    isQuiz: z.boolean(),
    releaseGrades: z.enum(["immediately", "later"]),
    showMissed: z.boolean(),
    showCorrect: z.boolean(),
    showPoints: z.boolean(),
  }),
  responses: z.object({
    emailCollection: z.enum(EMAIL_COLLECTION),
    sendCopy: z.enum(["off", "requested", "always"]),
    allowEditing: z.boolean(),
    limitOneResponse: z.boolean(),
  }),
  defaults: z.object({
    required: z.boolean(),
    defaultPoints: z.number().int().min(1).max(LIMITS.maxMarksPerQuestion),
  }),
});
export type FormConfig = z.infer<typeof formConfigSchema>;

export const DEFAULT_QUESTIONS_SECTION_ID = "assessment";
export const DETAILS_SECTION_ID = "details";

export function defaultConfig(): FormConfig {
  return {
    instructions: "",
    fields: [],
    sections: [{ id: DEFAULT_QUESTIONS_SECTION_ID, kind: "questions", title: "Assessment Questions", description: "", questions: [] }],
    quiz: { isQuiz: true, releaseGrades: "later", showMissed: false, showCorrect: false, showPoints: false },
    responses: { emailCollection: "verified", sendCopy: "off", allowEditing: false, limitOneResponse: true },
    defaults: { required: true, defaultPoints: 1 },
  };
}

/** Behaviour of the app before configurable settings existed (for request bodies without a config). */
export function legacyConfig(): FormConfig {
  const config = defaultConfig();
  config.responses.emailCollection = "do_not_collect";
  return config;
}

export function newId(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

// ---------------------------------------------------------------------------
// Identification fields
// ---------------------------------------------------------------------------

export const FIELD_PRESETS: { name: string; field: Omit<IdField, "id"> }[] = [
  { name: "Enrollment No.", field: { label: "Enrollment No.", description: "", type: "short", required: true, options: [], validation: { kind: "none" } } },
  { name: "Student Name", field: { label: "Student Name (as per university records)", description: "", type: "short", required: true, options: [], validation: { kind: "none" } } },
  {
    name: "Mobile No.",
    field: { label: "Mobile No.", description: "Include the country code if you are outside India.", type: "short", required: false, options: [], validation: { kind: "none" } },
  },
  { name: "Roll No.", field: { label: "Roll No.", description: "", type: "short", required: true, options: [], validation: { kind: "none" } } },
  { name: "Class/Division", field: { label: "Class/Division", description: "", type: "dropdown", required: false, options: ["A", "B"], validation: { kind: "none" } } },
];

export function blankField(): IdField {
  return { id: newId(), label: "", description: "", type: "short", required: true, options: [], validation: { kind: "none" } };
}

function detailsSection(): Section {
  return { id: DETAILS_SECTION_ID, kind: "details", title: "Student Details", description: "", questions: [] };
}

/** Adds a field; the first field also creates the Student Details section before all MCQ sections. */
export function addField(config: FormConfig, field: IdField): FormConfig {
  const hasDetails = config.sections.some((s) => s.kind === "details");
  return {
    ...config,
    fields: [...config.fields, field],
    sections: hasDetails ? config.sections : [detailsSection(), ...config.sections],
  };
}

export function updateField(config: FormConfig, id: string, patch: Partial<Omit<IdField, "id">>): FormConfig {
  return {
    ...config,
    fields: config.fields.map((f) => {
      if (f.id !== id) return f;
      const next = { ...f, ...patch };
      // Validation rules only exist for plain short-answer fields; choice fields need options.
      if (next.type !== "short") next.validation = { kind: "none" };
      if ((next.type === "dropdown" || next.type === "choice") && next.options.length === 0) next.options = ["Option 1", "Option 2"];
      if (next.type !== "dropdown" && next.type !== "choice") next.options = [];
      return next;
    }),
  };
}

export function duplicateField(config: FormConfig, id: string): FormConfig {
  const index = config.fields.findIndex((f) => f.id === id);
  if (index < 0) return config;
  const source = config.fields[index];
  const copy: IdField = { ...structuredClone(source), id: newId(), label: `${source.label} (copy)` };
  const fields = [...config.fields];
  fields.splice(index + 1, 0, copy);
  return { ...config, fields };
}

/** Removes a field. Removing the last field also removes the (now empty) details section. */
export function removeField(config: FormConfig, id: string): FormConfig {
  const fields = config.fields.filter((f) => f.id !== id);
  return { ...config, fields, sections: fields.length === 0 ? config.sections.filter((s) => s.kind !== "details") : config.sections };
}

export function moveField(config: FormConfig, id: string, delta: -1 | 1): FormConfig {
  return { ...config, fields: moveBy(config.fields, config.fields.findIndex((f) => f.id === id), delta) };
}

// ---------------------------------------------------------------------------
// Sections and question assignment
// ---------------------------------------------------------------------------

export function moveBy<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (index < 0 || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function addSection(config: FormConfig): FormConfig {
  const count = config.sections.filter((s) => s.kind === "questions").length;
  return {
    ...config,
    sections: [...config.sections, { id: newId(), kind: "questions", title: `Section ${count + 1}`, description: "", questions: [] }],
  };
}

export function updateSection(config: FormConfig, id: string, patch: Partial<Pick<Section, "title" | "description">>): FormConfig {
  return { ...config, sections: config.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

export function moveSection(config: FormConfig, id: string, delta: -1 | 1): FormConfig {
  return { ...config, sections: moveBy(config.sections, config.sections.findIndex((s) => s.id === id), delta) };
}

export type RemoveSectionStrategy = { moveTo: string } | "discard";

/**
 * Removes a section. A questions section's MCQs are either moved to another
 * questions section or, with "discard", returned so the caller can explicitly
 * delete them from the question text. Removing the details section removes its
 * fields. The last questions section can never be removed.
 */
export function removeSection(config: FormConfig, id: string, strategy: RemoveSectionStrategy): { config: FormConfig; discarded: number[] } {
  const section = config.sections.find((s) => s.id === id);
  if (!section) return { config, discarded: [] };
  if (section.kind === "details") {
    return { config: { ...config, fields: [], sections: config.sections.filter((s) => s.id !== id) }, discarded: [] };
  }
  const remainingQuestionSections = config.sections.filter((s) => s.kind === "questions" && s.id !== id);
  if (remainingQuestionSections.length === 0) return { config, discarded: [] };
  if (strategy === "discard") {
    return { config: { ...config, sections: config.sections.filter((s) => s.id !== id) }, discarded: [...section.questions] };
  }
  const target = remainingQuestionSections.find((s) => s.id === strategy.moveTo);
  if (!target) return { config, discarded: [] };
  return {
    config: {
      ...config,
      sections: config.sections
        .filter((s) => s.id !== id)
        .map((s) => (s.id === target.id ? { ...s, questions: [...s.questions, ...section.questions] } : s)),
    },
    discarded: [],
  };
}

/** Moves a question to the end of another questions section. */
export function moveQuestionToSection(config: FormConfig, question: number, sectionId: string): FormConfig {
  const target = config.sections.find((s) => s.id === sectionId && s.kind === "questions");
  if (!target || target.questions.includes(question)) return config;
  return {
    ...config,
    sections: config.sections.map((s) =>
      s.id === sectionId ? { ...s, questions: [...s.questions, question] } : { ...s, questions: s.questions.filter((q) => q !== question) },
    ),
  };
}

export function moveQuestionWithinSection(config: FormConfig, question: number, delta: -1 | 1): FormConfig {
  return {
    ...config,
    sections: config.sections.map((s) => {
      const index = s.questions.indexOf(question);
      return index < 0 ? s : { ...s, questions: moveBy(s.questions, index, delta) };
    }),
  };
}

/**
 * Makes the section assignment match the parsed questions: every number appears
 * in exactly one questions section, stale numbers are dropped, and newly pasted
 * questions are placed right after the question that precedes them in the text
 * (so a teacher who never touches sections gets the text order).
 */
export function reconcileSections(config: FormConfig, numbers: number[]): FormConfig {
  const wanted = new Set(numbers);
  const seen = new Set<number>();
  let sections = config.sections.map((s) => ({
    ...s,
    questions:
      s.kind === "questions"
        ? s.questions.filter((q) => {
            if (!wanted.has(q) || seen.has(q)) return false;
            seen.add(q);
            return true;
          })
        : [],
  }));
  if (!sections.some((s) => s.kind === "questions")) {
    sections = [...sections, { ...defaultConfig().sections[0], questions: [] }];
  }

  numbers.forEach((n, index) => {
    if (seen.has(n)) return;
    seen.add(n);
    const previous = numbers.slice(0, index).reverse().find((p) => seen.has(p));
    const host = previous === undefined ? undefined : sections.find((s) => s.questions.includes(previous));
    if (host) {
      host.questions.splice(host.questions.indexOf(previous!) + 1, 0, n);
    } else {
      sections.find((s) => s.kind === "questions")!.questions.unshift(n);
    }
  });

  const unchanged =
    sections.length === config.sections.length &&
    sections.every((s, i) => s.questions.length === config.sections[i].questions.length && s.questions.every((q, j) => q === config.sections[i].questions[j]));
  return unchanged ? config : { ...config, sections };
}

/** Deletes whole question blocks (from their Qn line up to the next question) from the pasted text. */
export function removeQuestionBlocks(input: string, quiz: Quiz, numbers: number[]): string {
  const remove = new Set(numbers);
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  const starts = quiz.questions.map((q) => q.line).sort((a, b) => a - b);
  const drop = new Set<number>();
  for (const question of quiz.questions) {
    if (!remove.has(question.number)) continue;
    const next = starts.find((line) => line > question.line) ?? lines.length + 1;
    for (let line = question.line; line < next; line += 1) drop.add(line);
  }
  return lines.filter((_, i) => !drop.has(i + 1)).join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

/** A question block for the "Insert question template" helper; uses the default point value. */
export function questionTemplate(number: number, defaultPoints: number): string {
  return `Q${number}: Type your question here\nOPTIONS:\nA. First option\nB. Second option\nC. Third option\nD. Fourth option\nANSWER: A\nMARKS: ${defaultPoints}`;
}

// ---------------------------------------------------------------------------
// Validation (browser and server)
// ---------------------------------------------------------------------------

const norm = (value: string) => value.replace(/\s+/g, " ").trim();

export function validateFormConfig(config: FormConfig, quiz: Pick<Quiz, "questions">): { errors: ValidationIssue[]; warnings: ValidationIssue[] } {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const err = (code: IssueCode, area: ValidationIssue["area"], message: string) => errors.push({ code, area, message, severity: "error" });
  const warn = (code: IssueCode, area: ValidationIssue["area"], message: string) => warnings.push({ code, area, message, severity: "warning" });

  if (config.instructions.length > CONFIG_LIMITS.maxInstructionsChars) {
    err("CONFIG_TOO_LONG", "details", `Instructions must be ${CONFIG_LIMITS.maxInstructionsChars.toLocaleString("en-US")} characters or less.`);
  }

  // Identification fields
  if (config.fields.length > CONFIG_LIMITS.maxFields) err("FIELD_LIMIT", "identification", `Use at most ${CONFIG_LIMITS.maxFields} identification fields.`);
  const labels = new Map<string, number>();
  config.fields.forEach((field, index) => {
    const name = norm(field.label) ? `“${norm(field.label)}”` : `Field ${index + 1}`;
    const label = norm(field.label);
    if (!label) err("FIELD_LABEL_MISSING", "identification", `Identification field ${index + 1} needs a label.`);
    else if (label.length > CONFIG_LIMITS.maxLabelChars) err("CONFIG_TOO_LONG", "identification", `${name}: the label must be ${CONFIG_LIMITS.maxLabelChars} characters or less.`);
    else {
      const key = label.toLowerCase();
      if (labels.has(key)) err("FIELD_LABEL_DUPLICATE", "identification", `Identification fields ${labels.get(key)! + 1} and ${index + 1} have the same label ${name}.`);
      else labels.set(key, index);
    }
    if (field.description.length > CONFIG_LIMITS.maxFieldDescriptionChars) {
      err("CONFIG_TOO_LONG", "identification", `${name}: the description must be ${CONFIG_LIMITS.maxFieldDescriptionChars} characters or less.`);
    }

    if (field.type === "dropdown" || field.type === "choice") {
      const options = field.options.map(norm);
      if (options.length === 0) err("FIELD_OPTIONS", "identification", `${name} needs at least one option.`);
      if (options.length > CONFIG_LIMITS.maxFieldOptions) err("FIELD_OPTIONS", "identification", `${name} can have at most ${CONFIG_LIMITS.maxFieldOptions} options.`);
      if (options.some((o) => !o)) err("FIELD_OPTIONS", "identification", `${name} has an empty option.`);
      if (options.some((o) => o.length > CONFIG_LIMITS.maxFieldOptionChars)) {
        err("FIELD_OPTIONS", "identification", `${name}: each option must be ${CONFIG_LIMITS.maxFieldOptionChars} characters or less.`);
      }
      const unique = new Set(options.filter(Boolean).map((o) => o.toLowerCase()));
      if (unique.size !== options.filter(Boolean).length) err("FIELD_OPTIONS", "identification", `${name} has duplicate options.`);
    } else if (field.options.length > 0) {
      err("FIELD_OPTIONS", "identification", `${name}: only dropdown and multiple-choice fields have options.`);
    }

    const rule = field.validation;
    if (rule.kind !== "none" && field.type !== "short") {
      err("FIELD_VALIDATION", "identification", `${name}: custom validation is only available for short-answer fields.`);
    } else if (rule.kind === "length") {
      if (rule.min === null && rule.max === null) err("FIELD_VALIDATION", "identification", `${name}: enter a minimum or maximum length.`);
      if (rule.min !== null && rule.max !== null && rule.min > rule.max) err("FIELD_VALIDATION", "identification", `${name}: the minimum length is greater than the maximum.`);
    } else if (rule.kind === "pattern") {
      if (!rule.pattern.trim()) err("FIELD_VALIDATION", "identification", `${name}: enter a pattern or choose “No validation”.`);
      else if (rule.pattern.length > CONFIG_LIMITS.maxPatternChars) err("FIELD_VALIDATION", "identification", `${name}: the pattern must be ${CONFIG_LIMITS.maxPatternChars} characters or less.`);
      else {
        try {
          new RegExp(rule.pattern);
        } catch {
          err("FIELD_VALIDATION", "identification", `${name}: the pattern is not a valid regular expression.`);
        }
      }
    }
    if (field.type === "email" && config.responses.emailCollection !== "do_not_collect") {
      warn("FIELD_VALIDATION", "identification", `${name} asks for an email, and “Collect email addresses” is also on. Students will be asked for their email twice.`);
    }
  });

  // Sections
  const details = config.sections.filter((s) => s.kind === "details");
  const questionSections = config.sections.filter((s) => s.kind === "questions");
  if (config.sections.length > CONFIG_LIMITS.maxSections) err("SECTION_LIMIT", "sections", `Use at most ${CONFIG_LIMITS.maxSections} sections.`);
  if (details.length > 1) err("SECTION_ASSIGNMENT", "sections", "Only one Student Details section is allowed.");
  if (config.fields.length > 0 && details.length === 0) err("SECTION_ASSIGNMENT", "sections", "Identification fields need a Student Details section.");
  if (config.fields.length === 0 && details.length > 0) err("SECTION_EMPTY", "sections", "The Student Details section has no fields. Add a field or delete the section.");
  if (questionSections.length === 0) err("SECTION_ASSIGNMENT", "sections", "Add at least one section for the questions.");
  if (new Set(config.sections.map((s) => s.id)).size !== config.sections.length) err("SECTION_ASSIGNMENT", "sections", "Two sections share the same ID.");

  config.sections.forEach((section, index) => {
    const title = norm(section.title);
    if (!title) err("SECTION_TITLE", "sections", `Section ${index + 1} needs a title.`);
    else if (title.length > CONFIG_LIMITS.maxSectionTitleChars) err("CONFIG_TOO_LONG", "sections", `Section ${index + 1}: the title must be ${CONFIG_LIMITS.maxSectionTitleChars} characters or less.`);
    if (section.description.length > CONFIG_LIMITS.maxSectionDescriptionChars) {
      err("CONFIG_TOO_LONG", "sections", `Section ${index + 1}: the description must be ${CONFIG_LIMITS.maxSectionDescriptionChars.toLocaleString("en-US")} characters or less.`);
    }
    if (section.kind === "details" && section.questions.length > 0) err("SECTION_ASSIGNMENT", "sections", "Questions cannot be placed in the Student Details section.");
    if (section.kind === "questions" && section.questions.length === 0 && quiz.questions.length > 0) {
      err("SECTION_EMPTY", "sections", `Section ${index + 1} (“${title || "untitled"}”) has no questions. Move questions into it or delete it.`);
    }
  });

  // Every MCQ in exactly one section.
  const numbers = quiz.questions.map((q) => q.number);
  const assigned = questionSections.flatMap((s) => s.questions);
  const counts = new Map<number, number>();
  assigned.forEach((n) => counts.set(n, (counts.get(n) ?? 0) + 1));
  const missing = numbers.filter((n) => !counts.has(n));
  const repeated = [...counts].filter(([, c]) => c > 1).map(([n]) => n);
  const unknown = [...counts.keys()].filter((n) => !numbers.includes(n));
  if (missing.length) err("SECTION_ASSIGNMENT", "sections", `Not assigned to a section: ${missing.map((n) => `Q${n}`).join(", ")}.`);
  if (repeated.length) err("SECTION_ASSIGNMENT", "sections", `Assigned to more than one section: ${repeated.map((n) => `Q${n}`).join(", ")}.`);
  if (unknown.length) err("SECTION_ASSIGNMENT", "sections", `Sections refer to questions that are not in your text: ${unknown.map((n) => `Q${n}`).join(", ")}.`);

  // Settings
  if (!config.quiz.isQuiz) warn("QUIZ_OFF", "settings", "Quiz mode is off: answer keys and marks will NOT be added to the form.");
  if (config.responses.sendCopy !== "off" && config.responses.emailCollection === "do_not_collect") {
    warn("SETTING_CONFLICT", "settings", "Sending respondents a copy of their response needs email collection. Turn on “Collect email addresses”.");
  }
  if (config.quiz.isQuiz && config.quiz.releaseGrades === "later" && config.responses.emailCollection === "do_not_collect") {
    warn("SETTING_CONFLICT", "settings", "Releasing grades later needs email addresses. Google Forms turns email collection on when you choose “Later, after manual review”.");
  }
  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// What can be applied automatically (see the capability matrix in the README)
// ---------------------------------------------------------------------------

export type SettingStatus = "auto" | "manual" | "unsupported" | "needs_auth";

export const STATUS_LABELS: Record<SettingStatus, string> = {
  auto: "Applied automatically",
  manual: "Manual step in Google Forms",
  unsupported: "Not supported by the Google Forms API",
  needs_auth: "Needs additional Google permission",
};

export interface SettingReport {
  key: string;
  label: string;
  value: string;
  status: SettingStatus;
  /** Where to change it in Google Forms, for manual settings. */
  manualStep?: string;
  note?: string;
}

const onOff = (value: boolean) => (value ? "On" : "Off");
const EMAIL_LABELS: Record<EmailCollection, string> = { verified: "Verified", responder_input: "Responder input", do_not_collect: "Do not collect" };
const SEND_COPY_LABELS = { off: "Off", requested: "When requested", always: "Always" } as const;

export function emailCollectionLabel(value: EmailCollection) {
  return EMAIL_LABELS[value];
}

export function fieldValidationSummary(field: IdField): string | null {
  if (field.type === "number") return "Response validation → Number → Is number";
  if (field.type === "email") return "Response validation → Text → Email address";
  const rule = field.validation;
  if (rule.kind === "length") {
    const parts = [rule.min !== null ? `minimum ${rule.min}` : null, rule.max !== null ? `maximum ${rule.max}` : null].filter(Boolean);
    return `Response validation → Length → ${parts.join(" and ")} characters`;
  }
  if (rule.kind === "pattern") return `Response validation → Regular expression → Matches → ${rule.pattern}`;
  return null;
}

/** Every setting with the teacher's choice and whether this app can apply it. */
export function describeSettings(config: FormConfig, { publish }: { publish: boolean }): SettingReport[] {
  const { quiz, responses, defaults } = config;
  const reports: SettingReport[] = [
    { key: "isQuiz", label: "Make this a quiz", value: onOff(quiz.isQuiz), status: "auto" },
    ...(quiz.isQuiz ? [{ key: "grading", label: "Answer keys and marks", value: "From your questions", status: "auto" as const }] : []),
    { key: "required", label: "MCQs required", value: defaults.required ? "Yes" : "No", status: "auto" },
    { key: "sections", label: "Sections", value: String(config.sections.length), status: "auto" },
    { key: "fields", label: "Student identification fields", value: String(config.fields.length), status: "auto" },
    { key: "emailCollection", label: "Collect email addresses", value: EMAIL_LABELS[responses.emailCollection], status: "auto" },
    {
      key: "publish",
      label: "Publish and accept responses",
      value: publish ? "Yes" : "No (draft)",
      status: "auto",
    },
  ];
  if (quiz.isQuiz) {
    reports.push(
      {
        key: "releaseGrades",
        label: "Release grades",
        value: quiz.releaseGrades === "later" ? "Later, after manual review" : "Immediately after each submission",
        status: "manual",
        manualStep: `Settings → Quizzes → Release grades → ${quiz.releaseGrades === "later" ? "Later, after manual review" : "Immediately after each submission"}`,
      },
      { key: "showMissed", label: "Respondents can see missed questions", value: onOff(quiz.showMissed), status: "manual", manualStep: `Settings → Quizzes → Respondent settings → Missed questions → ${onOff(quiz.showMissed)}` },
      { key: "showCorrect", label: "Respondents can see correct answers", value: onOff(quiz.showCorrect), status: "manual", manualStep: `Settings → Quizzes → Respondent settings → Correct answers → ${onOff(quiz.showCorrect)}` },
      { key: "showPoints", label: "Respondents can see point values", value: onOff(quiz.showPoints), status: "manual", manualStep: `Settings → Quizzes → Respondent settings → Point values → ${onOff(quiz.showPoints)}` },
    );
  }
  reports.push(
    {
      key: "sendCopy",
      label: "Send respondents a copy of their response",
      value: SEND_COPY_LABELS[responses.sendCopy],
      status: "manual",
      manualStep: `Settings → Responses → Send responders a copy of their response → ${SEND_COPY_LABELS[responses.sendCopy]}`,
    },
    { key: "allowEditing", label: "Allow response editing", value: onOff(responses.allowEditing), status: "manual", manualStep: `Settings → Responses → Allow response editing → ${onOff(responses.allowEditing)}` },
    {
      key: "limitOneResponse",
      label: "Limit to 1 response",
      value: onOff(responses.limitOneResponse),
      status: "manual",
      manualStep: `Settings → Responses → Limit to 1 response → ${onOff(responses.limitOneResponse)}`,
    },
  );
  config.fields.forEach((field) => {
    const rule = fieldValidationSummary(field);
    if (rule) {
      reports.push({ key: `field:${field.id}`, label: `Validation for “${norm(field.label)}”`, value: rule.split(" → ").slice(1).join(" → "), status: "manual", manualStep: `Question “${norm(field.label)}” → ⋮ → ${rule}` });
    }
  });
  reports.push(
    {
      key: "access",
      label: "Who can respond (sharing)",
      value: "Your Google account's default",
      status: "needs_auth",
      note: "Changing respondent access uses Google Drive sharing permissions, which this app does not request.",
    },
    {
      key: "globalDefaults",
      label: "Your Google Forms global defaults",
      value: "Unchanged",
      status: "unsupported",
      note: "Settings here apply only to this form.",
    },
  );
  return reports;
}

export function manualSteps(config: FormConfig, options: { publish: boolean }): string[] {
  return describeSettings(config, options).flatMap((r) => (r.status === "manual" && r.manualStep ? [r.manualStep] : []));
}

/** Settings shown in Google Forms that have no API equivalent at all. */
export const UNAVAILABLE_SETTINGS = [
  { label: "Shuffle question order", where: "Settings → Presentation" },
  { label: "Show progress bar", where: "Settings → Presentation" },
  { label: "Confirmation message", where: "Settings → Presentation" },
];
