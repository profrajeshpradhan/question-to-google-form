"use client";

import { forwardRef, useId } from "react";
import { CheckCircleIcon, EyeIcon, PlusIcon, XCircleIcon } from "@/components/ui/icons";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { CONFIG_LIMITS, type FormConfig } from "@/lib/quiz/form-config";
import { LIMITS } from "@/lib/quiz/limits";
import type { Quiz, ValidationIssue } from "@/lib/quiz/types";
import { IdentificationCard } from "./identification-card";
import { QuizSettingsCard } from "./quiz-settings-card";
import { SectionsCard } from "./sections-card";

type Update = (fn: (config: FormConfig) => FormConfig) => void;

interface EditorStepProps {
  title: string;
  description: string;
  input: string;
  config: FormConfig;
  /** Questions parsed live from the pasted text (null while it has errors). */
  liveQuiz: Quiz | null;
  onTitle: (v: string) => void;
  onDescription: (v: string) => void;
  onInput: (v: string) => void;
  onConfig: Update;
  onValidate: () => void;
  onPreview: () => void;
  onConvert: () => void;
  onClear: () => void;
  onShowExample: () => void;
  onInsertTemplate: () => void;
  onDiscardQuestions: (numbers: number[]) => void;
  errors: ValidationIssue[] | null;
  onJumpToLine: (line: number) => void;
  canConvert: boolean;
}

const AREA_LABELS: Record<NonNullable<ValidationIssue["area"]>, string> = {
  details: "Form details",
  identification: "Student ID",
  sections: "Sections",
  settings: "Settings",
};

const fieldClass =
  "mt-1.5 block w-full rounded-xl border border-line bg-white px-3.5 text-ink shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 aria-[invalid=true]:border-danger-600";

function StepHeading({ step, title, hint }: { step: number; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white" aria-hidden="true">
        {step}
      </span>
      <div>
        <h2 className="font-bold text-ink">{title}</h2>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}

export const EditorStep = forwardRef<HTMLTextAreaElement, EditorStepProps>(function EditorStep(
  {
    title,
    description,
    input,
    config,
    liveQuiz,
    onTitle,
    onDescription,
    onInput,
    onConfig,
    onValidate,
    onPreview,
    onConvert,
    onClear,
    onShowExample,
    onInsertTemplate,
    onDiscardQuestions,
    errors,
    onJumpToLine,
    canConvert,
  },
  textareaRef,
) {
  const ids = { title: useId(), desc: useId(), intro: useId(), input: useId(), help: useId(), count: useId(), errors: useId() };
  const tooLong = input.length > LIMITS.maxInputChars;
  const hasTitleError = errors?.some((e) => e.code === "MISSING_TITLE" || e.code === "TITLE_TOO_LONG");
  const empty = !input.trim();

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onValidate();
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Create Your Google Form</h1>
          <p className="mt-1 text-sm text-muted">Set up the form, paste your multiple-choice questions, then validate and preview before creating it.</p>
        </div>
        <Badge>MCQ quiz</Badge>
      </div>

      {/* Mobile: one column in step order. Desktop: content left, settings right. */}
      <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="contents xl:flex xl:min-w-0 xl:flex-1 xl:flex-col xl:gap-4">
          <Card className="order-1 p-5 sm:p-6" data-testid="form-details">
            <StepHeading step={1} title="Form Details" />
            <div className="mt-4 space-y-4">
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
                  className={`${fieldClass} h-11`}
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
                  className={`${fieldClass} resize-y py-2.5`}
                />
              </div>
              <div>
                <label htmlFor={ids.intro} className="block text-sm font-semibold text-ink">
                  Introductory instructions <span className="font-normal text-muted">(optional)</span>
                </label>
                <textarea
                  id={ids.intro}
                  value={config.instructions}
                  onChange={(e) => {
                    const instructions = e.target.value;
                    onConfig((c) => ({ ...c, instructions }));
                  }}
                  maxLength={CONFIG_LIMITS.maxInstructionsChars}
                  rows={2}
                  placeholder="e.g. Duration 30 minutes. Calculators are not allowed."
                  className={`${fieldClass} resize-y py-2.5`}
                />
                <p className="mt-1 text-xs text-muted">Shown as an “Instructions” block at the top of the form.</p>
              </div>
            </div>
          </Card>

          <Card className="order-4 p-5 sm:p-6" data-testid="questions-area">
            <StepHeading step={4} title="Sections & Questions" />
            <div className="mt-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <label htmlFor={ids.input} className="block text-sm font-semibold text-ink">
                  Paste Your Questions <span className="text-danger-600" aria-hidden="true">*</span>
                  <span className="sr-only"> (required)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={onShowExample}>
                    View Format Example
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onInsertTemplate}>
                    <PlusIcon size={14} /> Insert question template
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
                rows={14}
                spellCheck={false}
                aria-describedby={`${ids.help} ${ids.count}${errors?.length ? ` ${ids.errors}` : ""}`}
                aria-invalid={Boolean(errors?.some((e) => !e.area)) || undefined}
                placeholder={"Q1: What does CPU stand for?\nOPTIONS:\nA. Central Processing Unit\nB. Computer Personal Unit\nC. Central Program Utility\nD. Control Processing User\nANSWER: A\nMARKS: 2"}
                className={`${fieldClass} mt-2 min-h-[16rem] resize-y py-3 font-mono text-[13px] leading-6`}
              />
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted">
                <p id={ids.help}>Every question needs options (A, B, C…), one ANSWER and whole-number MARKS. Up to {LIMITS.maxQuestions} questions.</p>
                <p id={ids.count} className={tooLong ? "font-semibold text-danger-700" : undefined}>
                  {input.length.toLocaleString()} / {LIMITS.maxInputChars.toLocaleString()} characters
                </p>
              </div>
            </div>
            <div className="mt-5 border-t border-line pt-5">
              <SectionsCard config={config} update={onConfig} quiz={liveQuiz} onDiscardQuestions={onDiscardQuestions} />
            </div>
          </Card>
        </div>

        <div className="contents xl:flex xl:w-[24rem] xl:shrink-0 xl:flex-col xl:gap-4">
          <div className="order-2">
            <IdentificationCard config={config} update={onConfig} />
          </div>
          <div className="order-3">
            <QuizSettingsCard config={config} update={onConfig} />
          </div>
        </div>
      </div>

      {errors && errors.length > 0 && (
        <div id={ids.errors} role="alert" className="mt-4 rounded-2xl border border-red-200 bg-danger-50 p-4 sm:p-5" data-testid="validation-errors">
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
                {issue.area && <Badge tone="error">{AREA_LABELS[issue.area]}</Badge>}
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

      <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:shadow-pop" data-testid="action-bar">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="hidden items-center gap-1.5 text-xs text-muted md:flex">
            <CheckCircleIcon size={14} className="text-success-600" /> Validation runs in your browser. Nothing is sent to Google yet.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button type="submit" variant="secondary" disabled={empty} className="col-span-1">
              Validate Questions
            </Button>
            <Button variant="secondary" onClick={onPreview} disabled={empty}>
              <EyeIcon size={16} /> Preview
            </Button>
            <Button onClick={onConvert} disabled={empty || !canConvert} className="col-span-2">
              Convert into Google Form
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
});
