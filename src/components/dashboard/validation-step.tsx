"use client";

import { ArrowRightIcon, CheckCircleIcon } from "@/components/ui/icons";
import { Alert, Button, Card } from "@/components/ui/primitives";
import type { FormConfig } from "@/lib/quiz/form-config";
import type { Quiz, QuizSummary, ValidationIssue } from "@/lib/quiz/types";

export function marksLabel(marks: number) {
  return `${marks} ${marks === 1 ? "mark" : "marks"}`;
}

export function ValidationStep({
  quiz,
  summary,
  warnings,
  sources,
  config,
  onEdit,
  onPreview,
}: {
  config: FormConfig;
  quiz: Quiz;
  summary: QuizSummary;
  warnings: ValidationIssue[];
  sources: { title: "field" | "input"; description: "field" | "input" | "none" };
  onEdit: () => void;
  onPreview: () => void;
}) {
  return (
    <Card className="p-5 sm:p-8">
      <div role="status" className="flex items-start gap-3 rounded-2xl border border-green-200 bg-success-50 p-4 sm:p-5">
        <CheckCircleIcon size={28} className="shrink-0 text-success-600" />
        <div>
          <h1 className="text-lg font-bold text-success-700">Validation successful!</h1>
          <p className="text-sm text-green-900">
            All questions are ready for review. {summary.questionCount} {summary.questionCount === 1 ? "question" : "questions"} found. Total marks: {summary.totalMarks}.
          </p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3" data-testid="validation-summary">
        {[
          ["Questions", summary.questionCount],
          ["Options", summary.optionCount],
          ["Total marks", summary.totalMarks],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-canvas p-4 text-center">
            <dd className="text-2xl font-extrabold text-brand-700 sm:text-3xl">{value}</dd>
            <dt className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-sm text-muted" data-testid="structure-summary">
        {config.sections.length} {config.sections.length === 1 ? "section" : "sections"} <span aria-hidden="true">·</span> {config.fields.length}{" "}
        student identification {config.fields.length === 1 ? "field" : "fields"} <span aria-hidden="true">·</span> Settings are summarised in the preview.
      </p>

      {(sources.title === "input" || sources.description === "input") && (
        <p className="mt-4 text-sm text-muted">
          {sources.title === "input" && <>Title taken from the <code className="font-mono text-brand-700">FORM TITLE:</code> line. </>}
          {sources.description === "input" && <>Description taken from the <code className="font-mono text-brand-700">FORM DESCRIPTION:</code> line.</>}
        </p>
      )}

      {warnings.length > 0 && (
        <Alert tone="warning" title="Please double-check" className="mt-4">
          <ul className="list-disc space-y-1 pl-4">
            {warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </Alert>
      )}

      <ul className="mt-5 space-y-3">
        {quiz.questions.map((q, i) => (
          <li key={i} className="flex gap-3 rounded-2xl border border-line p-4">
            <CheckCircleIcon className="mt-0.5 shrink-0 text-success-600" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">Question {i + 1}</p>
              <p className="mt-0.5 break-words text-ink">{q.text}</p>
              <p className="mt-1 text-sm text-muted">
                {q.options.length} options <span aria-hidden="true">·</span> Answer: {q.answer} <span aria-hidden="true">·</span> {marksLabel(q.marks)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-between">
        <Button variant="secondary" size="lg" onClick={onEdit}>
          Edit Input
        </Button>
        <Button size="lg" onClick={onPreview}>
          View Preview <ArrowRightIcon size={18} />
        </Button>
      </div>
    </Card>
  );
}
