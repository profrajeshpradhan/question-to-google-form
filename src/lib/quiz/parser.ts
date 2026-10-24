import { LIMITS, type Limits } from "./limits";
import type {
  IssueCode,
  ParseResult,
  Quiz,
  QuizOption,
  QuizQuestion,
  ValidationIssue,
} from "./types";

/**
 * Deterministic parser for the plain-text MCQ format:
 *
 *   FORM TITLE: Introduction to IT Systems        (optional)
 *   FORM DESCRIPTION: Unit 1 Assessment           (optional)
 *
 *   Q1: What does CPU stand for?
 *   OPTIONS:
 *   A. Central Processing Unit
 *   B. Computer Personal Unit
 *   ANSWER: A
 *   MARKS: 2
 *
 * Title/description rule: values typed in the Form title / description fields
 * take priority. `FORM TITLE:` / `FORM DESCRIPTION:` lines in the pasted text
 * are used only when the matching field is empty.
 */

const RE_FORM_TITLE = /^form\s+title\s*:\s*(.*)$/i;
const RE_FORM_DESCRIPTION = /^form\s+description\s*:\s*(.*)$/i;
const RE_QUESTION = /^(?:q(?:uestion)?\s*(\d+)\s*[:.)-]\s*|(\d+)[.)]\s+)(.*)$/i;
const RE_OPTIONS_HEADER = /^options?\s*:?\s*(.*)$/i;
const RE_OPTION = /^\(?([a-z])\s*[.)](?:\s+(.*)|\s*)$/i;
const RE_ANSWER = /^(?:correct\s+answer|answer|ans)\s*[:-]\s*(.*)$/i;
const RE_MARKS = /^(?:marks?|points?|score)\s*[:-]\s*(.*)$/i;
const RE_MULTIPLE_ANSWERS = /^\(?[a-z]\)?\s*(?:,|&|\/|\band\b|\s)\s*\(?[a-z]\)?(?:\s*(?:,|&|\/|\band\b|\s)\s*\(?[a-z]\)?)*$/i;
const RE_SINGLE_LABEL = /^\(?([a-z])\)?(?:\s*[.):-]\s*(.*))?$/i;
const RE_MARKS_VALUE = /^([+-]?\d+(?:\.\d+)?|[+-]?\.\d+)\s*(?:marks?|points?|pts?)?$/i;

interface Draft {
  number: number;
  line: number;
  textParts: string[];
  options: { label: string; text: string; line: number }[];
  phase: "text" | "options" | "after";
  answers: { raw: string; line: number }[];
  marks: { raw: string; line: number }[];
}

export interface ParseInput {
  /** The pasted question text. */
  input: string;
  /** Value of the Form title field (may be empty). */
  title?: string;
  /** Value of the Form description field (may be empty). */
  description?: string;
}

/** Normalises pasted text: line endings, non-breaking spaces and invisible characters. */
export function normalizeInput(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[   \t]/g, " ")
    .replace(/[​-‍﻿]/g, "")
    .replace(/[：]/g, ":");
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function parseQuiz({ input, title = "", description = "" }: ParseInput, limits: Limits = LIMITS): ParseResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const err = (code: IssueCode, message: string, question?: number, line?: number) =>
    errors.push({ code, message, question, line, severity: "error" });
  const warn = (code: IssueCode, message: string, question?: number, line?: number) =>
    warnings.push({ code, message, question, line, severity: "warning" });

  if (input.length > limits.maxInputChars) {
    err(
      "INPUT_TOO_LONG",
      `The pasted text is ${input.length.toLocaleString("en-US")} characters. The limit is ${limits.maxInputChars.toLocaleString("en-US")} characters.`,
    );
    return { ok: false, errors, warnings };
  }

  const lines = normalizeInput(input).split("\n");
  let headerTitle: string | undefined;
  let headerDescription: string | undefined;
  const drafts: Draft[] = [];
  let current: Draft | undefined;

  lines.forEach((rawLine, index) => {
    const lineNo = index + 1;
    const line = rawLine.trim();
    if (line === "") return;

    const titleMatch = RE_FORM_TITLE.exec(line);
    const descriptionMatch = titleMatch ? null : RE_FORM_DESCRIPTION.exec(line);
    if (titleMatch || descriptionMatch) {
      if (current) {
        err(
          "UNEXPECTED_TEXT",
          `${titleMatch ? "FORM TITLE" : "FORM DESCRIPTION"} must appear before the first question.`,
          current.number,
          lineNo,
        );
        return;
      }
      const value = collapse((titleMatch ?? descriptionMatch)![1]);
      if (titleMatch) {
        if (headerTitle !== undefined) warn("UNEXPECTED_TEXT", "FORM TITLE appears more than once; the first one is used.", undefined, lineNo);
        else headerTitle = value;
      } else {
        if (headerDescription !== undefined) warn("UNEXPECTED_TEXT", "FORM DESCRIPTION appears more than once; the first one is used.", undefined, lineNo);
        else headerDescription = value;
      }
      return;
    }

    const questionMatch = RE_QUESTION.exec(line);
    if (questionMatch) {
      const number = Number(questionMatch[1] ?? questionMatch[2]);
      current = {
        number,
        line: lineNo,
        textParts: questionMatch[3] ? [questionMatch[3]] : [],
        options: [],
        phase: "text",
        answers: [],
        marks: [],
      };
      drafts.push(current);
      return;
    }

    if (!current) {
      err(
        "UNEXPECTED_TEXT",
        `Line ${lineNo} is not part of any question. Start each question with "Q1:", "Q2:" and so on.`,
        undefined,
        lineNo,
      );
      return;
    }

    const answerMatch = RE_ANSWER.exec(line);
    if (answerMatch) {
      current.answers.push({ raw: collapse(answerMatch[1]), line: lineNo });
      current.phase = "after";
      return;
    }

    const marksMatch = RE_MARKS.exec(line);
    if (marksMatch) {
      current.marks.push({ raw: collapse(marksMatch[1]), line: lineNo });
      current.phase = "after";
      return;
    }

    const optionsHeader = RE_OPTIONS_HEADER.exec(line);
    if (optionsHeader && /^options?\b/i.test(line)) {
      if (current.phase === "after") {
        err("UNEXPECTED_TEXT", "OPTIONS must come before ANSWER and MARKS.", current.number, lineNo);
        return;
      }
      current.phase = "options";
      const rest = optionsHeader[1].trim();
      if (rest) {
        const inline = RE_OPTION.exec(rest);
        if (inline) current.options.push({ label: inline[1].toUpperCase(), text: collapse(inline[2] ?? ""), line: lineNo });
        else err("UNEXPECTED_TEXT", `Put each option on its own line after "OPTIONS:", e.g. "A. First option".`, current.number, lineNo);
      }
      return;
    }

    const optionMatch = RE_OPTION.exec(line);
    if (optionMatch) {
      if (current.phase === "after") {
        err("UNEXPECTED_TEXT", "Options must come before ANSWER and MARKS.", current.number, lineNo);
        return;
      }
      current.phase = "options";
      current.options.push({ label: optionMatch[1].toUpperCase(), text: collapse(optionMatch[2] ?? ""), line: lineNo });
      return;
    }

    // Free text: continuation of the question text or of the previous option.
    if (current.phase === "text") {
      current.textParts.push(line);
    } else if (current.phase === "options" && current.options.length > 0) {
      const last = current.options[current.options.length - 1];
      last.text = collapse(`${last.text} ${line}`);
    } else {
      err(
        "UNEXPECTED_TEXT",
        `Unexpected text "${truncate(line, 40)}". Each question should end with ANSWER and MARKS lines.`,
        current.number,
        lineNo,
      );
    }
  });

  // Title and description resolution.
  const fieldTitle = collapse(title);
  const fieldDescription = description.trim();
  const finalTitle = fieldTitle || headerTitle || "";
  const finalDescription = fieldDescription || headerDescription || "";
  const sources = {
    title: (fieldTitle ? "field" : "input") as "field" | "input",
    description: (fieldDescription ? "field" : headerDescription ? "input" : "none") as "field" | "input" | "none",
  };
  if (!finalTitle) err("MISSING_TITLE", "Enter a Google Form title (or add a FORM TITLE: line to the pasted text).");
  else if (finalTitle.length > limits.maxTitleChars)
    err("TITLE_TOO_LONG", `The form title is ${finalTitle.length} characters. The limit is ${limits.maxTitleChars}.`);
  if (finalDescription.length > limits.maxDescriptionChars)
    err("DESCRIPTION_TOO_LONG", `The description is ${finalDescription.length} characters. The limit is ${limits.maxDescriptionChars}.`);

  if (drafts.length === 0 && !errors.some((e) => e.code === "UNEXPECTED_TEXT")) {
    err("EMPTY_INPUT", 'Paste at least one question. Each question starts with "Q1:", "Q2:" and so on.');
  }
  if (drafts.length > limits.maxQuestions) {
    err("TOO_MANY_QUESTIONS", `Found ${drafts.length} questions. The limit is ${limits.maxQuestions} questions per form.`);
  }

  const seenNumbers = new Map<number, number>();
  const questions: QuizQuestion[] = [];

  drafts.forEach((draft, index) => {
    const q = draft.number;
    const before = errors.length;

    const firstLine = seenNumbers.get(q);
    if (firstLine !== undefined) {
      err("DUPLICATE_QUESTION_NUMBER", `Question number Q${q} is used more than once (also on line ${firstLine}).`, q, draft.line);
    } else {
      seenNumbers.set(q, draft.line);
      const expected = index === 0 ? 1 : drafts[index - 1].number + 1;
      if (q !== expected) warn("NON_SEQUENTIAL_NUMBER", `Expected Q${expected} but found Q${q}. Questions are created in the order they appear.`, q, draft.line);
    }

    const text = collapse(draft.textParts.join(" "));
    if (!text) err("MISSING_QUESTION_TEXT", "Question text is empty. Write the question after \"Q" + q + ":\".", q, draft.line);
    else if (text.length > limits.maxQuestionChars)
      err("QUESTION_TOO_LONG", `Question text is ${text.length} characters. The limit is ${limits.maxQuestionChars}.`, q, draft.line);

    // Options
    if (draft.options.length < limits.minOptions) {
      err(
        "TOO_FEW_OPTIONS",
        draft.options.length === 0
          ? `No options found. Add at least ${limits.minOptions} options such as "A. …" and "B. …".`
          : `Only ${draft.options.length} option found. Add at least ${limits.minOptions} options.`,
        q,
        draft.line,
      );
    } else if (draft.options.length > limits.maxOptions) {
      err("TOO_MANY_OPTIONS", `${draft.options.length} options found. The limit is ${limits.maxOptions} options per question.`, q, draft.line);
    }
    const labels = new Map<string, number>();
    const texts = new Map<string, string>();
    for (const option of draft.options) {
      if (labels.has(option.label)) {
        err("DUPLICATE_OPTION_LABEL", `Option label ${option.label} is used more than once.`, q, option.line);
      } else {
        labels.set(option.label, option.line);
      }
      if (!option.text) {
        err("EMPTY_OPTION", `Option ${option.label} has no text.`, q, option.line);
        continue;
      }
      if (option.text.length > limits.maxOptionChars)
        err("OPTION_TOO_LONG", `Option ${option.label} is ${option.text.length} characters. The limit is ${limits.maxOptionChars}.`, q, option.line);
      const key = option.text.toLowerCase();
      const duplicateOf = texts.get(key);
      if (duplicateOf) err("DUPLICATE_OPTION_TEXT", `Options ${duplicateOf} and ${option.label} have the same text. Google Forms requires every option to be different.`, q, option.line);
      else texts.set(key, option.label);
    }

    // Answer
    let answer = "";
    if (draft.answers.length === 0) {
      err("MISSING_ANSWER", 'Missing ANSWER field. Add a line such as "ANSWER: A".', q, draft.line);
    } else {
      if (draft.answers.length > 1) err("DUPLICATE_ANSWER", "ANSWER appears more than once. Only one correct answer is supported.", q, draft.answers[1].line);
      const { raw, line } = draft.answers[0];
      answer = resolveAnswer(raw, draft.options, (code, message) => err(code, message, q, line));
    }

    // Marks
    let marks = 0;
    if (draft.marks.length === 0) {
      err("MISSING_MARKS", 'Missing MARKS field. Add a line such as "MARKS: 1".', q, draft.line);
    } else {
      if (draft.marks.length > 1) err("DUPLICATE_MARKS", "MARKS appears more than once.", q, draft.marks[1].line);
      const { raw, line } = draft.marks[0];
      marks = resolveMarks(raw, limits, (code, message) => err(code, message, q, line));
    }

    if (errors.length === before) {
      questions.push({
        number: q,
        line: draft.line,
        text,
        options: draft.options.map<QuizOption>(({ label, text: optionText }) => ({ label, text: optionText })),
        answer,
        marks,
      });
    }
  });

  if (errors.length > 0) {
    return { ok: false, errors: sortIssues(errors), warnings: sortIssues(warnings) };
  }

  const quiz: Quiz = { title: finalTitle, description: finalDescription, questions };
  return {
    ok: true,
    quiz,
    summary: summarizeQuiz(quiz),
    warnings: sortIssues(warnings),
    sources,
  };
}

function resolveAnswer(
  raw: string,
  options: Draft["options"],
  fail: (code: IssueCode, message: string) => void,
): string {
  const available = options.map((o) => o.label);
  const range = available.length > 0 ? ` (${available.join(", ")})` : "";
  if (!raw) {
    fail("MISSING_ANSWER", 'ANSWER has no value. Write the correct option label, e.g. "ANSWER: A".');
    return "";
  }
  if (RE_MULTIPLE_ANSWERS.test(raw)) {
    fail("MULTIPLE_ANSWERS", `"${raw}" lists more than one answer. Only one correct answer is supported per question.`);
    return "";
  }
  const single = RE_SINGLE_LABEL.exec(raw);
  if (single) {
    const label = single[1].toUpperCase();
    if (available.includes(label)) return label;
    // Not a known label – it may still be the full text of a one-letter option.
    const byText = options.find((o) => o.text.toLowerCase() === raw.toLowerCase());
    if (byText) return byText.label;
    fail("ANSWER_NOT_FOUND", `Answer ${label} does not match any available option${range}.`);
    return "";
  }
  const byText = options.find((o) => o.text.toLowerCase() === raw.toLowerCase());
  if (byText) return byText.label;
  fail("ANSWER_NOT_FOUND", `Answer "${truncate(raw, 40)}" does not match any available option${range}. Use the option label, e.g. "ANSWER: A".`);
  return "";
}

function resolveMarks(raw: string, limits: Limits, fail: (code: IssueCode, message: string) => void): number {
  if (!raw) {
    fail("MISSING_MARKS", 'MARKS has no value. Write a whole number, e.g. "MARKS: 1".');
    return 0;
  }
  const match = RE_MARKS_VALUE.exec(raw);
  if (!match) {
    fail("INVALID_MARKS", `Marks "${truncate(raw, 20)}" is not a number. Write a whole number, e.g. "MARKS: 2".`);
    return 0;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) {
    fail("INVALID_MARKS", "Marks must be greater than zero.");
    return 0;
  }
  if (!Number.isInteger(value)) {
    fail(
      "NON_INTEGER_MARKS",
      `Marks must be a whole number. Google Forms quizzes only accept whole-number points, so ${match[1]} cannot be used.`,
    );
    return 0;
  }
  if (value > limits.maxMarksPerQuestion) {
    fail("MARKS_TOO_HIGH", `Marks must be ${limits.maxMarksPerQuestion} or less.`);
    return 0;
  }
  return value;
}

export function summarizeQuiz(quiz: Quiz) {
  return {
    questionCount: quiz.questions.length,
    optionCount: quiz.questions.reduce((sum, q) => sum + q.options.length, 0),
    totalMarks: quiz.questions.reduce((sum, q) => sum + q.marks, 0),
  };
}

function sortIssues(issues: ValidationIssue[]): ValidationIssue[] {
  return [...issues].sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function formatIssue(issue: ValidationIssue): string {
  const prefix = [issue.question !== undefined ? `Q${issue.question}` : null, issue.line ? `line ${issue.line}` : null]
    .filter(Boolean)
    .join(", ");
  return prefix ? `${prefix} — ${issue.message}` : issue.message;
}

export const SAMPLE_INPUT = `FORM TITLE: Introduction to IT Systems
FORM DESCRIPTION: Unit 1 Assessment

Q1: What does CPU stand for?
OPTIONS:
A. Central Processing Unit
B. Computer Personal Unit
C. Central Program Utility
D. Control Processing User
ANSWER: A
MARKS: 2

Q2: Which language is used for web page structure?
OPTIONS:
A. Python
B. HTML
C. SQL
D. C
ANSWER: B
MARKS: 1`;
