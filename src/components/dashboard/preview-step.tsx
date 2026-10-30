"use client";

import { useId, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, WifiOffIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Alert, Badge, Button, Card, cx } from "@/components/ui/primitives";
import { FIELD_TYPE_LABELS, hasOptions, type FormConfig } from "@/lib/quiz/form-config";
import { buildFormPlan, firstSectionHasHeading } from "@/lib/quiz/form-plan";
import type { Quiz, QuizSummary, ValidationIssue } from "@/lib/quiz/types";
import { QuestionCard } from "./question-card";

export function PreviewStep({
  quiz,
  summary,
  config,
  warnings,
  autoConfirm = false,
  accountEmail,
  online,
  onEdit,
  onConfirm,
}: {
  quiz: Quiz;
  summary: QuizSummary;
  config: FormConfig;
  warnings: ValidationIssue[];
  /** Open the confirmation dialog straight away (from the editor's Convert button). */
  autoConfirm?: boolean;
  accountEmail: string;
  online: boolean;
  onEdit: () => void;
  onConfirm: (publish: boolean) => void;
}) {
  const [confirming, setConfirming] = useState(autoConfirm);
  const [publish, setPublish] = useState(true);
  const publishId = useId();
  const plan = buildFormPlan(quiz, config);
  const displayNumber = new Map(plan.sections.flatMap((s) => s.questions).map((q, i) => [q.number, i + 1]));

  return (
    <Card className="p-5 sm:p-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Preview Your Google Form</h1>
      <p className="mt-1 text-sm text-muted">
        This is the form that will be created, in order. Correct answers are shown only to you — students never see them in the form.
      </p>

      <div className="mt-5 overflow-hidden rounded-2xl border border-line">
        <div className="h-2.5 bg-brand-600" aria-hidden="true" />
        <div className="bg-lavender p-5">
          <h2 className="break-words text-xl font-bold text-ink" data-testid="preview-title">{quiz.title}</h2>
          {quiz.description && <p className="mt-1 whitespace-pre-line break-words text-sm text-muted">{quiz.description}</p>}
          <p className="mt-3 text-sm font-semibold text-brand-800">
            Total questions: {summary.questionCount} <span aria-hidden="true">|</span> Total marks: {summary.totalMarks}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-6">
        {plan.sections.map((section, index) => {
          const showHeading = index > 0 || firstSectionHasHeading(plan);
          return (
            <section key={section.id} aria-label={`Section ${index + 1}: ${section.title}`} data-testid="preview-section">
              <div className={cx("rounded-2xl border p-4", showHeading ? "border-brand-200 bg-brand-50/60" : "border-dashed border-line")}>
                <p className="text-xs font-bold uppercase tracking-wide text-brand-700">
                  Section {index + 1} of {plan.sections.length}
                  {index > 0 && " · new page"}
                </p>
                {showHeading ? (
                  <>
                    <h3 className="mt-0.5 break-words text-lg font-bold text-ink">{section.title}</h3>
                    {section.description && <p className="mt-0.5 whitespace-pre-line break-words text-sm text-muted">{section.description}</p>}
                  </>
                ) : (
                  <p className="mt-0.5 text-xs text-muted">Shown directly under the form title (one section, so no separate heading).</p>
                )}
              </div>

              {section.fields.length > 0 && (
                <ul className="mt-3 space-y-3" aria-label="Identification fields">
                  {section.fields.map((field) => (
                    <li key={field.id} className="rounded-2xl border border-line bg-white p-4" data-testid="preview-field">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 break-words font-semibold text-ink">
                          {field.label} {field.required && <span className="text-danger-600" aria-label="required">*</span>}
                        </p>
                        <Badge tone="neutral">{FIELD_TYPE_LABELS[field.type]}</Badge>
                      </div>
                      {hasOptions(field.type) ? (
                        <p className="mt-2 text-sm text-muted">Options: {field.options.join(", ")}</p>
                      ) : (
                        <div className="mt-2 w-1/2 border-b border-dashed border-gray-300 pb-1 text-sm text-gray-400">
                          {field.type === "paragraph" ? "Long answer text" : field.type === "date" ? "Day, month, year" : field.type === "time" ? "Time" : "Short answer text"}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {section.questions.length > 0 && (
                <ol className="mt-3 space-y-4" aria-label={`Questions in ${section.title}`}>
                  {section.questions.map((q) => (
                    <QuestionCard
                      key={q.number}
                      question={q}
                      number={displayNumber.get(q.number) ?? 0}
                      required={config.defaults.required}
                      graded={config.quiz.isQuiz}
                      testId="preview-question"
                    />
                  ))}
                </ol>
              )}
            </section>
          );
        })}
      </div>

      {warnings.length > 0 && (
        <Alert tone="warning" title="Please double-check" className="mt-5">
          <ul className="list-disc space-y-1 pl-4">
            {warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </Alert>
      )}

      {!online && (
        <Alert tone="warning" title="You're offline" className="mt-5">
          Creating a Google Form needs an internet connection. Reconnect to continue.
        </Alert>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-between">
        <Button variant="secondary" size="lg" onClick={onEdit}>
          <ArrowLeftIcon size={18} /> Back to Editor
        </Button>
        <Button size="lg" onClick={() => setConfirming(true)} disabled={!online}>
          {online ? null : <WifiOffIcon size={18} />}
          Convert into Google Form <ArrowRightIcon size={18} />
        </Button>
      </div>

      <Modal
        open={confirming && online}
        onClose={() => setConfirming(false)}
        title="Create this Google Form?"
        description="This creates a real quiz in your Google account."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirming(false);
                onConfirm(publish);
              }}
              data-testid="confirm-create"
            >
              Yes, create form
            </Button>
          </>
        }
      >
        <dl className="divide-y divide-line rounded-xl border border-line text-sm">
          {[
            ["Google account", accountEmail],
            ["Form title", quiz.title],
            ["Sections", String(plan.sections.length)],
            ["Student fields", String(config.fields.length)],
            ["Questions", String(summary.questionCount)],
            ["Total marks", String(summary.totalMarks)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-muted">{k}</dt>
              <dd className="min-w-0 truncate text-right font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-canvas p-3">
          <input
            id={publishId}
            type="checkbox"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
          />
          <label htmlFor={publishId} className="text-sm">
            <span className="font-semibold text-ink">Publish and start accepting responses</span>
            <span className="block text-muted">
              Untick to keep the form as an unpublished draft that you can publish later from Google Forms.
            </span>
          </label>
        </div>
      </Modal>
    </Card>
  );
}
