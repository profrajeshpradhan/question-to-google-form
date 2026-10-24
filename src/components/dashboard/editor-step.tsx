"use client";

import { forwardRef, useId } from "react";
import { CheckCircleIcon, XCircleIcon } from "@/components/ui/icons";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { LIMITS } from "@/lib/quiz/limits";
import type { ValidationIssue } from "@/lib/quiz/types";

interface EditorStepProps {
  title: string;
  description: string;
  input: string;
  onTitle: (v: string) => void;
  onDescription: (v: string) => void;
  onInput: (v: string) => void;
  onValidate: () => void;
  onClear: () => void;
  onShowExample: () => void;
  errors: ValidationIssue[] | null;
  onJumpToLine: (line: number) => void;
}

export const EditorStep = forwardRef<HTMLTextAreaElement, EditorStepProps>(function EditorStep(
  { title, description, input, onTitle, onDescription, onInput, onValidate, onClear, onShowExample, errors, onJumpToLine },
  textareaRef,
) {
  const ids = { title: useId(), desc: useId(), input: useId(), help: useId(), count: useId(), errors: useId() };
  const tooLong = input.length > LIMITS.maxInputChars;
  const hasTitleError = errors?.some((e) => e.code === "MISSING_TITLE" || e.code === "TITLE_TOO_LONG");

  return (
    <Card className="p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Create Your Google Form</h1>
          <p className="mt-1 text-sm text-muted">Add a title, paste your multiple-choice questions, then validate them.</p>
        </div>
        <Badge>MCQ quiz</Badge>
      </div>

      <form
        className="mt-6 space-y-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onValidate();
        }}
      >
        <div>
          <label htmlFor={ids.title} className="block text-sm font-semibold text-ink">
            Form Title <span className="text-danger-600" aria-hidden="true">*</span>
            <span className="sr-only"> (required)</span>
          </label>
          <input
            id={ids.title}
            name="title"
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            maxLength={LIMITS.maxTitleChars}
            placeholder="e.g. Unit 1 Assessment"
            autoComplete="off"
            aria-invalid={hasTitleError || undefined}
            className="mt-1.5 block h-11 w-full rounded-xl border border-line bg-white px-3.5 text-ink shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 aria-[invalid=true]:border-danger-600"
          />
        </div>

        <div>
          <label htmlFor={ids.desc} className="block text-sm font-semibold text-ink">
            Form Description <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id={ids.desc}
            name="description"
            value={description}
            onChange={(e) => onDescription(e.target.value)}
            maxLength={LIMITS.maxDescriptionChars}
            rows={2}
            placeholder="Enter a brief description for your form…"
            className="mt-1.5 block w-full resize-y rounded-xl border border-line bg-white px-3.5 py-2.5 text-ink shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
          />
        </div>

        <div>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <label htmlFor={ids.input} className="block text-sm font-semibold text-ink">
              Paste Your Questions <span className="text-danger-600" aria-hidden="true">*</span>
              <span className="sr-only"> (required)</span>
            </label>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={onShowExample}>
                View Format Example
              </Button>
              <Button variant="ghost" size="sm" onClick={onClear} disabled={!input && !title && !description}>
                Clear Input
              </Button>
            </div>
          </div>
          <textarea
            ref={textareaRef}
            id={ids.input}
            name="questions"
            value={input}
            onChange={(e) => onInput(e.target.value)}
            rows={16}
            spellCheck={false}
            aria-describedby={`${ids.help} ${ids.count}${errors?.length ? ` ${ids.errors}` : ""}`}
            aria-invalid={Boolean(errors?.length) || undefined}
            placeholder={"Q1: What does CPU stand for?\nOPTIONS:\nA. Central Processing Unit\nB. Computer Personal Unit\nC. Central Program Utility\nD. Control Processing User\nANSWER: A\nMARKS: 2"}
            className="mt-2 block min-h-[18rem] w-full resize-y rounded-xl border border-line bg-white px-3.5 py-3 font-mono text-[13px] leading-6 text-ink shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 aria-[invalid=true]:border-danger-600"
          />
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted">
            <p id={ids.help}>Every question needs options (A, B, C…), one ANSWER and whole-number MARKS. Up to {LIMITS.maxQuestions} questions.</p>
            <p id={ids.count} className={tooLong ? "font-semibold text-danger-700" : undefined}>
              {input.length.toLocaleString()} / {LIMITS.maxInputChars.toLocaleString()} characters
            </p>
          </div>
        </div>

        {errors && errors.length > 0 && (
          <div id={ids.errors} role="alert" className="rounded-2xl border border-red-200 bg-danger-50 p-4 sm:p-5" data-testid="validation-errors">
            <div className="flex items-center gap-2 text-danger-700">
              <XCircleIcon />
              <p className="font-bold">
                {errors.length === 1 ? "1 problem found" : `${errors.length} problems found`} — no form was created
              </p>
            </div>
            <p className="mt-1 text-sm text-red-900">Fix the problems below and validate again. Your input has been kept.</p>
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
              {errors.map((issue, i) => (
                <li key={i} className="flex flex-wrap items-start gap-2 rounded-xl bg-white p-3 text-sm ring-1 ring-red-100">
                  {issue.question !== undefined && <Badge tone="error">Q{issue.question}</Badge>}
                  <span className="min-w-0 flex-1 text-ink">{issue.message}</span>
                  {issue.line && (
                    <button type="button" onClick={() => onJumpToLine(issue.line!)} className="text-xs font-semibold text-brand-700 underline-offset-2 hover:underline">
                      Line {issue.line}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <CheckCircleIcon size={14} className="text-success-600" /> Validation runs in your browser. Nothing is sent to Google yet.
          </p>
          <Button type="submit" size="lg" disabled={!input.trim()}>
            Validate Questions
          </Button>
        </div>
      </form>
    </Card>
  );
});
