import { describe, expect, it } from "vitest";
import { formatIssue, parseQuiz, SAMPLE_INPUT } from "@/lib/quiz/parser";
import { LIMITS } from "@/lib/quiz/limits";
import type { ParseResult } from "@/lib/quiz/types";

function errorsOf(result: ParseResult) {
  if (result.ok) throw new Error("expected failure");
  return result.errors;
}

function okOf(result: ParseResult) {
  if (!result.ok) throw new Error("expected success: " + JSON.stringify(result.errors, null, 2));
  return result;
}

const q = (n: number, body: string) => `Q${n}: Question ${n}?\n${body}`;
const standard = (n: number, answer = "A", marks = "1") =>
  q(n, `OPTIONS:\nA. Alpha ${n}\nB. Beta ${n}\nC. Gamma ${n}\nD. Delta ${n}\nANSWER: ${answer}\nMARKS: ${marks}`);

describe("parseQuiz – valid input", () => {
  it("parses the documented sample format", () => {
    const result = okOf(parseQuiz({ input: SAMPLE_INPUT }));
    expect(result.quiz.title).toBe("Introduction to IT Systems");
    expect(result.quiz.description).toBe("Unit 1 Assessment");
    expect(result.summary).toEqual({ questionCount: 2, optionCount: 8, totalMarks: 3 });
    expect(result.quiz.questions[0]).toEqual({
      number: 1,
      line: 4,
      text: "What does CPU stand for?",
      options: [
        { label: "A", text: "Central Processing Unit" },
        { label: "B", text: "Computer Personal Unit" },
        { label: "C", text: "Central Program Utility" },
        { label: "D", text: "Control Processing User" },
      ],
      answer: "A",
      marks: 2,
    });
    expect(result.quiz.questions[1].answer).toBe("B");
    expect(result.warnings).toEqual([]);
    expect(result.sources).toEqual({ title: "input", description: "input" });
  });

  it("gives the UI fields priority over FORM TITLE / FORM DESCRIPTION lines", () => {
    const result = okOf(parseQuiz({ input: SAMPLE_INPUT, title: "  My Quiz ", description: "Typed description" }));
    expect(result.quiz.title).toBe("My Quiz");
    expect(result.quiz.description).toBe("Typed description");
    expect(result.sources).toEqual({ title: "field", description: "field" });
  });

  it("uses the pasted description when only the title field is filled", () => {
    const result = okOf(parseQuiz({ input: SAMPLE_INPUT, title: "Field title" }));
    expect(result.quiz.description).toBe("Unit 1 Assessment");
    expect(result.sources.description).toBe("input");
  });

  it("works without header lines when the title field is provided", () => {
    const result = okOf(parseQuiz({ input: standard(1), title: "T" }));
    expect(result.sources.description).toBe("none");
    expect(result.quiz.description).toBe("");
  });

  it("accepts Windows line endings, tabs, extra blank lines and odd spacing", () => {
    const input = "\r\n\r\nQ1:\tWhat is 2 + 2?\r\nOPTIONS:\r\n  A.  Three \r\n\tB.\tFour\r\n\r\nANSWER: b\r\nMARKS:   3 \r\n\r\n";
    const result = okOf(parseQuiz({ input, title: "Maths" }));
    expect(result.quiz.questions[0]).toMatchObject({ text: "What is 2 + 2?", answer: "B", marks: 3 });
    expect(result.quiz.questions[0].options[0].text).toBe("Three");
  });

  it("accepts alternative label styles and keywords", () => {
    const input = [
      "Question 1) Which is a prime number?",
      "Options",
      "(a) 4",
      "b) 6",
      "C) 7",
      "Correct answer: (c)",
      "Points: 2 points",
      "",
      "2. Second question?",
      "A. Yes",
      "B. No",
      "Ans - A",
      "Marks - 1",
    ].join("\n");
    const result = okOf(parseQuiz({ input, title: "T" }));
    expect(result.quiz.questions.map((x) => [x.number, x.answer, x.marks])).toEqual([
      [1, "C", 2],
      [2, "A", 1],
    ]);
  });

  it("accepts the answer given as the label followed by the option text", () => {
    const input = q(1, "OPTIONS:\nA. Python\nB. HTML\nANSWER: B. HTML\nMARKS: 1");
    expect(okOf(parseQuiz({ input, title: "T" })).quiz.questions[0].answer).toBe("B");
  });

  it("accepts the answer given as the exact option text (case-insensitive)", () => {
    const input = q(1, "OPTIONS:\nA. Python\nB. HTML\nANSWER: html\nMARKS: 1");
    expect(okOf(parseQuiz({ input, title: "T" })).quiz.questions[0].answer).toBe("B");
  });

  it("treats a single-letter answer as a label even if an option's text is also a letter", () => {
    const input = q(1, "OPTIONS:\nA. Python\nB. HTML\nC. SQL\nD. C\nANSWER: C\nMARKS: 1");
    expect(okOf(parseQuiz({ input, title: "T" })).quiz.questions[0].answer).toBe("C");
  });

  it("joins wrapped question and option lines", () => {
    const input = "Q1: Which of the following\nis the largest planet?\nOPTIONS:\nA. Jupiter, the gas\ngiant\nB. Mars\nANSWER: A\nMARKS: 1";
    const result = okOf(parseQuiz({ input, title: "T" }));
    expect(result.quiz.questions[0].text).toBe("Which of the following is the largest planet?");
    expect(result.quiz.questions[0].options[0].text).toBe("Jupiter, the gas giant");
  });

  it("accepts MARKS before ANSWER and whole-number decimals like 2.0", () => {
    const input = q(1, "A. x\nB. y\nMARKS: 2.0\nANSWER: B");
    expect(okOf(parseQuiz({ input, title: "T" })).quiz.questions[0]).toMatchObject({ marks: 2, answer: "B" });
  });

  it("warns (but does not fail) on non-sequential numbering", () => {
    const result = okOf(parseQuiz({ input: `${standard(1)}\n\n${standard(3)}`, title: "T" }));
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({ code: "NON_SEQUENTIAL_NUMBER", question: 3 });
  });

  it("handles the maximum number of questions", () => {
    const input = Array.from({ length: LIMITS.maxQuestions }, (_, i) => standard(i + 1)).join("\n\n");
    const result = okOf(parseQuiz({ input, title: "T" }));
    expect(result.summary.questionCount).toBe(LIMITS.maxQuestions);
    expect(result.summary.optionCount).toBe(LIMITS.maxQuestions * 4);
  });

  it("is deterministic", () => {
    expect(parseQuiz({ input: SAMPLE_INPUT })).toEqual(parseQuiz({ input: SAMPLE_INPUT }));
  });

  it("strips zero-width and non-breaking characters", () => {
    const input = "Q1: Hello​?\nA. Yes\nB. No\nANSWER： A\nMARKS: 1";
    const result = okOf(parseQuiz({ input, title: "T" }));
    expect(result.quiz.questions[0].text).toBe("Hello?");
  });
});

describe("parseQuiz – invalid input", () => {
  const codes = (input: string, title = "T") => errorsOf(parseQuiz({ input, title })).map((e) => e.code);

  it("rejects empty input", () => {
    expect(codes("   \n  ")).toEqual(["EMPTY_INPUT"]);
  });

  it("requires a title", () => {
    expect(codes(standard(1), "")).toContain("MISSING_TITLE");
  });

  it("rejects input over the character limit without parsing", () => {
    const errors = errorsOf(parseQuiz({ input: "x".repeat(LIMITS.maxInputChars + 1), title: "T" }));
    expect(errors.map((e) => e.code)).toEqual(["INPUT_TOO_LONG"]);
  });

  it("rejects too many questions", () => {
    const input = Array.from({ length: LIMITS.maxQuestions + 1 }, (_, i) => standard(i + 1)).join("\n\n");
    expect(codes(input)).toContain("TOO_MANY_QUESTIONS");
  });

  it("reports text before the first question with a line number", () => {
    const errors = errorsOf(parseQuiz({ input: `Hello class\n${standard(1)}`, title: "T" }));
    expect(errors[0]).toMatchObject({ code: "UNEXPECTED_TEXT", line: 1 });
  });

  it("reports a missing ANSWER with question and line", () => {
    const input = `${standard(1)}\n\nQ2: Second?\nOPTIONS:\nA. x\nB. y\nMARKS: 1`;
    const errors = errorsOf(parseQuiz({ input, title: "T" }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ code: "MISSING_ANSWER", question: 2, line: 10 });
    expect(formatIssue(errors[0])).toBe('Q2, line 10 — Missing ANSWER field. Add a line such as "ANSWER: A".');
  });

  it("reports an answer that does not match an option", () => {
    const errors = errorsOf(parseQuiz({ input: standard(4, "E"), title: "T" }));
    expect(errors[0]).toMatchObject({ code: "ANSWER_NOT_FOUND", question: 4 });
    expect(errors[0].message).toBe("Answer E does not match any available option (A, B, C, D).");
  });

  it("reports an answer text that does not match an option", () => {
    expect(codes(standard(1, "Something else"))).toEqual(["ANSWER_NOT_FOUND"]);
  });

  it.each(["A, B", "A and C", "A B", "A/B", "A & D"])("rejects multiple answers: %s", (answer) => {
    expect(codes(standard(1, answer))).toEqual(["MULTIPLE_ANSWERS"]);
  });

  it("rejects duplicate ANSWER and MARKS lines", () => {
    const input = q(1, "A. x\nB. y\nANSWER: A\nANSWER: B\nMARKS: 1\nMARKS: 2");
    expect(codes(input)).toEqual(["DUPLICATE_ANSWER", "DUPLICATE_MARKS"]);
  });

  it("rejects an empty ANSWER value", () => {
    expect(codes(standard(1, ""))).toEqual(["MISSING_ANSWER"]);
  });

  it.each([
    ["0", "INVALID_MARKS", "Marks must be greater than zero."],
    ["-2", "INVALID_MARKS", "Marks must be greater than zero."],
    ["two", "INVALID_MARKS", undefined],
    ["1.5", "NON_INTEGER_MARKS", undefined],
    ["", "MISSING_MARKS", undefined],
    [String(LIMITS.maxMarksPerQuestion + 1), "MARKS_TOO_HIGH", undefined],
  ])("rejects marks %j", (marks, code, message) => {
    const errors = errorsOf(parseQuiz({ input: standard(5, "A", marks), title: "T" }));
    expect(errors.map((e) => e.code)).toEqual([code]);
    expect(errors[0].question).toBe(5);
    if (message) expect(errors[0].message).toBe(message);
  });

  it("rejects missing MARKS", () => {
    expect(codes(q(1, "A. x\nB. y\nANSWER: A"))).toEqual(["MISSING_MARKS"]);
  });

  it("rejects fewer than two options", () => {
    expect(codes(q(1, "OPTIONS:\nA. Only\nANSWER: A\nMARKS: 1"))).toEqual(["TOO_FEW_OPTIONS"]);
    expect(codes(q(1, "ANSWER: A\nMARKS: 1"))).toEqual(["TOO_FEW_OPTIONS", "ANSWER_NOT_FOUND"]);
  });

  it("rejects too many options", () => {
    const options = Array.from({ length: LIMITS.maxOptions + 1 }, (_, i) => `${String.fromCharCode(65 + i)}. Opt ${i}`).join("\n");
    expect(codes(q(1, `${options}\nANSWER: A\nMARKS: 1`))).toEqual(["TOO_MANY_OPTIONS"]);
  });

  it("rejects duplicate option labels and duplicate option text", () => {
    expect(codes(q(1, "A. x\nA. y\nANSWER: A\nMARKS: 1"))).toEqual(["DUPLICATE_OPTION_LABEL"]);
    expect(codes(q(1, "A. Same\nB. same\nANSWER: A\nMARKS: 1"))).toEqual(["DUPLICATE_OPTION_TEXT"]);
  });

  it("rejects empty options", () => {
    expect(codes(q(1, "A. x\nB.\nANSWER: A\nMARKS: 1"))).toEqual(["EMPTY_OPTION"]);
  });

  it("rejects empty question text", () => {
    expect(codes("Q1:\nOPTIONS:\nA. x\nB. y\nANSWER: A\nMARKS: 1")).toEqual(["MISSING_QUESTION_TEXT"]);
  });

  it("rejects overly long question and option text", () => {
    const longQ = `Q1: ${"x".repeat(LIMITS.maxQuestionChars + 1)}\nA. a\nB. b\nANSWER: A\nMARKS: 1`;
    expect(codes(longQ)).toEqual(["QUESTION_TOO_LONG"]);
    const longO = `Q1: ok\nA. ${"y".repeat(LIMITS.maxOptionChars + 1)}\nB. b\nANSWER: A\nMARKS: 1`;
    expect(codes(longO)).toEqual(["OPTION_TOO_LONG"]);
  });

  it("rejects duplicate question numbers", () => {
    expect(codes(`${standard(1)}\n${standard(1)}`)).toEqual(["DUPLICATE_QUESTION_NUMBER"]);
  });

  it("rejects unexpected text after ANSWER/MARKS", () => {
    expect(codes(`${standard(1)}\nThis line is stray`)).toEqual(["UNEXPECTED_TEXT"]);
  });

  it("rejects options placed after ANSWER", () => {
    expect(codes(q(1, "A. x\nB. y\nANSWER: A\nC. z\nMARKS: 1"))).toEqual(["UNEXPECTED_TEXT"]);
  });

  it("rejects FORM TITLE after the first question", () => {
    expect(codes(`${standard(1)}\nFORM TITLE: Late`)).toEqual(["UNEXPECTED_TEXT"]);
  });

  it("rejects overly long titles and descriptions", () => {
    expect(codes(standard(1), "t".repeat(LIMITS.maxTitleChars + 1))).toContain("TITLE_TOO_LONG");
    const result = parseQuiz({ input: standard(1), title: "T", description: "d".repeat(LIMITS.maxDescriptionChars + 1) });
    expect(errorsOf(result).map((e) => e.code)).toEqual(["DESCRIPTION_TOO_LONG"]);
  });

  it("does not silently drop invalid questions: the whole input is rejected", () => {
    const input = `${standard(1)}\n\n${standard(2, "Z")}\n\n${standard(3)}`;
    const result = parseQuiz({ input, title: "T" });
    expect(result.ok).toBe(false);
    expect(errorsOf(result)).toHaveLength(1);
  });

  it("reports every invalid question, sorted by line", () => {
    const input = `${standard(1, "Z")}\n\n${standard(2, "A", "0")}\n\n${q(3, "A. x\nB. y\nMARKS: 1")}`;
    const errors = errorsOf(parseQuiz({ input, title: "T" }));
    expect(errors.map((e) => e.question)).toEqual([1, 2, 3]);
    const lines = errors.map((e) => e.line ?? 0);
    expect([...lines].sort((a, b) => a - b)).toEqual(lines);
  });
});
