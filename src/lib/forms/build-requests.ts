import type { forms_v1 } from "@googleapis/forms";
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

/** Step 2: turn the form into a quiz and set the description (applied atomically). */
export function buildSettingsRequests(quiz: Quiz): forms_v1.Schema$Request[] {
  const requests: forms_v1.Schema$Request[] = [
    {
      updateSettings: {
        settings: { quizSettings: { isQuiz: true } },
        updateMask: "quizSettings.isQuiz",
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

/**
 * Step 3: one createItem per question, each a required single-answer (RADIO)
 * question with its answer key and point value. Items are inserted at explicit
 * increasing indices so the order matches the teacher's input.
 */
export function buildQuestionRequests(quiz: Quiz): forms_v1.Schema$Request[] {
  return quiz.questions.map((question, index) => ({
    createItem: {
      item: {
        title: question.text,
        questionItem: {
          question: {
            required: true,
            choiceQuestion: {
              type: "RADIO",
              options: question.options.map((option) => ({ value: optionValue(option) })),
            },
            grading: {
              pointValue: question.marks,
              correctAnswers: { answers: [{ value: correctOptionValue(question) }] },
            },
          },
        },
      },
      location: { index },
    },
  }));
}

export interface VerificationProblem {
  question?: number;
  message: string;
}

/** Compares the form returned by forms.get with the quiz the teacher approved. */
export function verifyForm(form: forms_v1.Schema$Form, quiz: Quiz): VerificationProblem[] {
  const problems: VerificationProblem[] = [];
  if (!form.settings?.quizSettings?.isQuiz) problems.push({ message: "Quiz mode is not enabled." });
  if ((form.info?.description ?? "") !== quiz.description) problems.push({ message: "The form description does not match." });

  const items = (form.items ?? []).filter((item) => item.questionItem);
  if (items.length !== quiz.questions.length) {
    problems.push({ message: `Expected ${quiz.questions.length} questions but the form has ${items.length}.` });
    return problems;
  }

  quiz.questions.forEach((question, index) => {
    const item = items[index];
    const q = item.questionItem?.question;
    const fail = (message: string) => problems.push({ question: question.number, message });
    if ((item.title ?? "") !== question.text) fail("Question text does not match.");
    if (q?.choiceQuestion?.type !== "RADIO") fail("Question is not a multiple-choice question.");
    const values = (q?.choiceQuestion?.options ?? []).map((o) => o.value ?? "");
    const expected = question.options.map(optionValue);
    if (values.length !== expected.length || values.some((v, i) => v !== expected[i])) fail("Options do not match.");
    if (q?.grading?.pointValue !== question.marks) fail(`Marks should be ${question.marks}.`);
    const answers = (q?.grading?.correctAnswers?.answers ?? []).map((a) => a.value);
    if (answers.length !== 1 || answers[0] !== correctOptionValue(question)) fail("Correct answer does not match.");
  });
  return problems;
}
