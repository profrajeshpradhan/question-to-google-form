"use client";

import type { ReactNode } from "react";
import { CheckIcon } from "@/components/ui/icons";
import { Badge, cx } from "@/components/ui/primitives";
import type { QuizQuestion } from "@/lib/quiz/types";

export function marksLabel(marks: number) {
  return `${marks} ${marks === 1 ? "mark" : "marks"}`;
}

/** A parsed MCQ shown like a Google Forms question. The correct answer is visible to the teacher only. */
export function QuestionCard({
  question,
  number,
  required,
  graded = true,
  controls,
  testId = "question-card",
}: {
  question: QuizQuestion;
  number: number;
  required: boolean;
  graded?: boolean;
  controls?: ReactNode;
  testId?: string;
}) {
  return (
    <li className="rounded-xl border border-line bg-white p-4 shadow-sm sm:p-5" data-testid={testId}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 break-words font-medium text-ink">
          {number}. {question.text} {required && <span className="text-danger-600" aria-label="required">*</span>}
        </p>
        <span className="shrink-0 text-sm text-muted">{graded ? `(${marksLabel(question.marks)})` : "(not graded)"}</span>
      </div>
      <ul className="mt-3 space-y-2">
        {question.options.map((o) => {
          const correct = graded && o.label === question.answer;
          return (
            <li key={o.label} className={cx("flex items-center gap-3 rounded-lg border px-3 py-2 text-sm", correct ? "border-green-300 bg-success-50" : "border-transparent")}>
              {correct ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-600 text-white">
                  <CheckIcon size={12} strokeWidth={3} />
                </span>
              ) : (
                <span className="h-5 w-5 shrink-0 rounded-full border-2 border-gray-300" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 break-words">
                {o.label}. {o.text}
              </span>
              {correct && <Badge tone="success">Correct answer</Badge>}
            </li>
          );
        })}
      </ul>
      {controls && <div className="mt-3 flex flex-wrap items-center justify-end gap-1.5 border-t border-line pt-3">{controls}</div>}
    </li>
  );
}
