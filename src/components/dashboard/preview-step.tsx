"use client";

import { useId, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, WifiOffIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Alert, Badge, Button, Card, cx } from "@/components/ui/primitives";
import type { Quiz, QuizSummary } from "@/lib/quiz/types";
import { marksLabel } from "./validation-step";

export function PreviewStep({
  quiz,
  summary,
  accountEmail,
  online,
  onEdit,
  onConfirm,
}: {
  quiz: Quiz;
  summary: QuizSummary;
  accountEmail: string;
  online: boolean;
  onEdit: () => void;
  onConfirm: (publish: boolean) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [publish, setPublish] = useState(true);
  const publishId = useId();

  return (
    <Card className="p-5 sm:p-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Preview Your Google Form</h1>
      <p className="mt-1 text-sm text-muted">Check every question, the correct answers and marks. Correct answers are shown only to you.</p>

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

      <ol className="mt-5 space-y-4" aria-label="Questions">
        {quiz.questions.map((q, i) => (
          <li key={i} className="rounded-2xl border border-line bg-white p-4 sm:p-5" data-testid="preview-question">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 break-words font-semibold text-ink">
                {i + 1}. {q.text} <span className="text-danger-600" aria-label="required">*</span>
              </p>
              <span className="shrink-0 text-sm text-muted">({marksLabel(q.marks)})</span>
            </div>
            <ul className="mt-3 space-y-2">
              {q.options.map((o) => {
                const correct = o.label === q.answer;
                return (
                  <li
                    key={o.label}
                    className={cx(
                      "flex items-center gap-3 rounded-xl border px-3 py-2 text-sm",
                      correct ? "border-green-300 bg-success-50" : "border-line",
                    )}
                  >
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
          </li>
        ))}
      </ol>

      {!online && (
        <Alert tone="warning" title="You're offline" className="mt-5">
          Creating a Google Form needs an internet connection. Reconnect to continue.
        </Alert>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-between">
        <Button variant="secondary" size="lg" onClick={onEdit}>
          <ArrowLeftIcon size={18} /> Edit Input
        </Button>
        <Button size="lg" onClick={() => setConfirming(true)} disabled={!online}>
          {online ? null : <WifiOffIcon size={18} />}
          Convert into Google Form <ArrowRightIcon size={18} />
        </Button>
      </div>

      <Modal
        open={confirming}
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
