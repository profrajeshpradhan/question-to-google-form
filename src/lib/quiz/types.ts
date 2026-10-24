export interface QuizOption {
  /** Upper-case option label, e.g. "A". */
  label: string;
  /** Option text without the label, e.g. "Central Processing Unit". */
  text: string;
}

export interface QuizQuestion {
  /** Number written by the teacher (Q1 → 1). */
  number: number;
  /** 1-based line in the pasted input where the question starts. */
  line: number;
  text: string;
  options: QuizOption[];
  /** Label of the single correct option. */
  answer: string;
  /** Whole-number points (Google Forms grading uses integer point values). */
  marks: number;
}

export interface Quiz {
  title: string;
  description: string;
  questions: QuizQuestion[];
}

export type IssueCode =
  | "EMPTY_INPUT"
  | "INPUT_TOO_LONG"
  | "TOO_MANY_QUESTIONS"
  | "UNEXPECTED_TEXT"
  | "MISSING_QUESTION_TEXT"
  | "QUESTION_TOO_LONG"
  | "DUPLICATE_QUESTION_NUMBER"
  | "NON_SEQUENTIAL_NUMBER"
  | "TOO_FEW_OPTIONS"
  | "TOO_MANY_OPTIONS"
  | "EMPTY_OPTION"
  | "OPTION_TOO_LONG"
  | "DUPLICATE_OPTION_LABEL"
  | "DUPLICATE_OPTION_TEXT"
  | "MISSING_ANSWER"
  | "MULTIPLE_ANSWERS"
  | "DUPLICATE_ANSWER"
  | "ANSWER_NOT_FOUND"
  | "MISSING_MARKS"
  | "DUPLICATE_MARKS"
  | "INVALID_MARKS"
  | "NON_INTEGER_MARKS"
  | "MARKS_TOO_HIGH"
  | "MISSING_TITLE"
  | "TITLE_TOO_LONG"
  | "DESCRIPTION_TOO_LONG";

export interface ValidationIssue {
  code: IssueCode;
  message: string;
  /** Question number as written by the teacher, when the issue belongs to a question. */
  question?: number;
  /** 1-based line number in the pasted input. */
  line?: number;
  severity: "error" | "warning";
}

export interface QuizSummary {
  questionCount: number;
  optionCount: number;
  totalMarks: number;
}

export type ParseResult =
  | {
      ok: true;
      quiz: Quiz;
      summary: QuizSummary;
      warnings: ValidationIssue[];
      /** Where the title/description came from, for UI hints. */
      sources: { title: "field" | "input"; description: "field" | "input" | "none" };
    }
  | {
      ok: false;
      errors: ValidationIssue[];
      warnings: ValidationIssue[];
    };
