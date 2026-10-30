"use client";

import { forwardRef, useId, useState } from "react";
import { AlertIcon, CheckCircleIcon, CheckIcon, ClipboardIcon, EyeIcon, PlusCircleIcon, SectionIcon, TrashIcon, XCircleIcon } from "@/components/ui/icons";
import { Badge, Button, cx } from "@/components/ui/primitives";
import { addField, addSection, blankField, CONFIG_LIMITS, type FormConfig } from "@/lib/quiz/form-config";
import { LIMITS } from "@/lib/quiz/limits";
import type { Quiz, QuizSummary, ValidationIssue } from "@/lib/quiz/types";
import { SectionCard } from "./section-card";

type Update = (fn: (config: FormConfig) => FormConfig) => void;

/** Where the teacher is in the Validate → Preview → Convert sequence. */
export type FlowStatus = "draft" | "invalid" | "validated" | "validation-stale" | "previewed" | "preview-stale";

const STATUS_TEXT: Record<FlowStatus, { title: string; hint: string; tone: "ok" | "todo" | "warn" | "error" }> = {
  draft: { title: "Draft saved in this tab", hint: "Validate your questions to continue", tone: "todo" },
  invalid: { title: "Some things need fixing", hint: "See the problems above", tone: "error" },
  validated: { title: "Validated", hint: "Preview the form next", tone: "ok" },
  "validation-stale": { title: "Changed since validation", hint: "Validate again", tone: "warn" },
  previewed: { title: "Preview confirmed", hint: "Ready to convert", tone: "ok" },
  "preview-stale": { title: "Changed since preview", hint: "Preview again before converting", tone: "warn" },
};

const AREA_LABELS: Record<NonNullable<ValidationIssue["area"]>, string> = {
  details: "Form",
  identification: "Student Identification",
  sections: "Sections",
  settings: "Settings",
};

interface FormCanvasProps {
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
  status: FlowStatus;
  /** Result of the last successful validation, only while it is still current. */
  validated: { summary: QuizSummary; warnings: ValidationIssue[] } | null;
  errors: ValidationIssue[] | null;
  canPreview: boolean;
  canConvert: boolean;
  onValidate: () => void;
  onPreview: () => void;
  onConvert: () => void;
  onClear: () => void;
  onShowExample: () => void;
  onInsertTemplate: () => void;
  onDiscardQuestions: (numbers: number[]) => void;
  onJumpToLine: (line: number) => void;
}

export const FormCanvas = forwardRef<HTMLTextAreaElement, FormCanvasProps>(function FormCanvas(props, textareaRef) {
  const { title, description, input, config, liveQuiz, onTitle, onDescription, onInput, onConfig, status, validated, errors } = props;
  const ids = { input: useId(), help: useId(), errors: useId() };
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(() => config.fields[0]?.id ?? null);
  const hasTitleError = errors?.some((e) => e.code === "MISSING_TITLE" || e.code === "TITLE_TOO_LONG");
  const empty = !input.trim();
  const primaryId = config.sections.find((s) => s.kind === "questions")?.id;
  const questions = new Map((liveQuiz?.questions ?? []).map((q) => [q.number, q]));
  const displayNumber = new Map(
    config.sections
      .filter((s) => s.kind === "questions")
      .flatMap((s) => s.questions)
      .filter((n) => questions.has(n))
      .map((n, i) => [n, i + 1]),
  );
  const s = STATUS_TEXT[status];

  const addFieldAfterSelection = () => {
    const field = blankField("short");
    onConfig((c) => addField(c, field, selectedFieldId ?? undefined));
    setSelectedFieldId(field.id);
  };

  const pasteBox = (
    <div className="rounded-xl border border-line bg-white p-4 shadow-sm sm:p-5">
      <label htmlFor={ids.input} className="block text-base font-medium text-ink">
        Paste Your Questions <span className="text-danger-600" aria-hidden="true">*</span>
        <span className="sr-only"> (required)</span>
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={props.onShowExample}>
          <ClipboardIcon size={15} /> View Format Example
        </Button>
        <Button variant="secondary" size="sm" onClick={props.onInsertTemplate}>
          <PlusCircleIcon size={15} /> Insert Question Template
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={props.onClear}
          disabled={!input && !title && !description}
          className="border border-red-200 text-danger-600 hover:bg-danger-50 hover:text-danger-700 sm:ml-auto"
        >
          <TrashIcon size={15} /> Clear Input
        </Button>
      </div>
      <textarea
        ref={textareaRef}
        id={ids.input}
        name="questions"
        value={input}
        onChange={(e) => onInput(e.target.value)}
        rows={14}
        spellCheck={false}
        aria-describedby={`${ids.help}${errors?.length ? ` ${ids.errors}` : ""}`}
        aria-invalid={Boolean(errors?.some((e) => !e.area && e.code !== "MISSING_TITLE")) || undefined}
        placeholder={"Q1: What does CPU stand for?\nOPTIONS:\nA. Central Processing Unit\nB. Computer Personal Unit\nC. Central Program Utility\nD. Control Processing User\nANSWER: A\nMARKS: 2"}
        className="mt-3 block min-h-[18rem] w-full resize-y rounded-lg border border-line bg-white px-3.5 py-3 font-mono text-[13px] leading-6 text-ink placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 aria-[invalid=true]:border-danger-600"
      />
      <div id={ids.help} className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted">
        <p>Each question needs text, options (A, B, C…), one ANSWER and MARKS.</p>
        <p className={input.length > LIMITS.maxInputChars ? "font-semibold text-danger-700" : undefined}>
          Characters: {input.length.toLocaleString()} <span aria-hidden="true">|</span> Questions: {liveQuiz?.questions.length ?? "–"}
        </p>
      </div>

      {validated && (
        <div role="status" className="mt-4 rounded-xl border border-green-200 bg-success-50 p-4" data-testid="validation-result">
          <p className="flex items-center gap-2 font-semibold text-success-700">
            <CheckCircleIcon size={18} /> Validation successful!
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-2" data-testid="validation-summary">
            {(
              [
                ["Questions", validated.summary.questionCount],
                ["Options", validated.summary.optionCount],
                ["Total marks", validated.summary.totalMarks],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-lg bg-white p-2.5 text-center ring-1 ring-green-100">
                <dd className="text-xl font-bold text-brand-700">{value}</dd>
                <dt className="text-xs text-muted">{label}</dt>
              </div>
            ))}
          </dl>
          {validated.warnings.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900">
              {validated.warnings.map((w, i) => (
                <li key={i}>{w.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {status === "validation-stale" && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" data-testid="validation-stale">
          <AlertIcon size={16} /> Changed since validation. Validate again.
        </p>
      )}
    </div>
  );

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        props.onValidate();
      }}
      className="relative mx-auto max-w-3xl"
    >
      <h1 className="sr-only">Create Your Google Form</h1>

      {/* Vertical insertion toolbar (wide screens; the same actions are inline below). */}
      <div className="absolute left-full top-0 ml-4 hidden h-full xl:block">
        <div className="sticky top-24 flex flex-col gap-1 rounded-xl border border-line bg-white p-1.5 shadow-card" role="toolbar" aria-label="Insert" aria-orientation="vertical">
          <button
            type="button"
            onClick={addFieldAfterSelection}
            disabled={config.fields.length >= CONFIG_LIMITS.maxFields}
            title="Add field"
            aria-label="Add field"
            className="rounded-lg p-2 text-muted hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40"
          >
            <PlusCircleIcon size={22} />
          </button>
          <button
            type="button"
            onClick={() => onConfig((c) => addSection(c))}
            disabled={config.sections.length >= CONFIG_LIMITS.maxSections}
            title="Add section"
            aria-label="Add section"
            className="rounded-lg p-2 text-muted hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40"
          >
            <SectionIcon size={22} />
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="overflow-hidden rounded-xl border border-line bg-white shadow-card" data-testid="form-header">
          <div className="h-2.5 bg-brand-600" aria-hidden="true" />
          <div className="px-5 pb-5 pt-4 sm:px-6">
            <input
              aria-label="Form Title"
              aria-required="true"
              name="title"
              value={title}
              onChange={(e) => onTitle(e.target.value)}
              maxLength={LIMITS.maxTitleChars}
              placeholder="Untitled form"
              autoComplete="off"
              aria-invalid={hasTitleError || undefined}
              className="block w-full border-b border-gray-200 bg-transparent py-2 text-2xl font-medium text-ink placeholder:text-gray-400 focus:border-b-2 focus:border-brand-600 focus:outline-none focus-visible:outline-none aria-[invalid=true]:border-danger-600 sm:text-3xl"
            />
            <textarea
              aria-label="Form Description"
              name="description"
              value={description}
              onChange={(e) => onDescription(e.target.value)}
              maxLength={LIMITS.maxDescriptionChars}
              rows={1}
              placeholder="Form description (optional)"
              className="mt-2 block w-full resize-y border-b border-gray-200 bg-transparent py-1.5 text-sm text-ink placeholder:text-gray-400 focus:border-b-2 focus:border-brand-600 focus:outline-none focus-visible:outline-none"
            />
          </div>
        </div>

        {config.sections.map((section, index) => (
          <SectionCard
            key={section.id}
            section={section}
            index={index}
            total={config.sections.length}
            config={config}
            update={onConfig}
            questions={questions}
            displayNumber={displayNumber}
            selectedFieldId={selectedFieldId}
            onSelectField={setSelectedFieldId}
            onDiscardQuestions={props.onDiscardQuestions}
          >
            {section.id === primaryId ? pasteBox : undefined}
          </SectionCard>
        ))}

        <button
          type="button"
          onClick={() => onConfig((c) => addSection(c))}
          disabled={config.sections.length >= CONFIG_LIMITS.maxSections}
          className="flex w-full items-center gap-3 rounded-xl border border-dashed border-brand-300 bg-white/60 px-5 py-4 text-left font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-40"
        >
          <PlusCircleIcon size={22} /> Add Section
        </button>

        {errors && errors.length > 0 && (
          <div id={ids.errors} role="alert" className="rounded-xl border border-red-200 bg-danger-50 p-4 sm:p-5" data-testid="validation-errors">
            <p className="flex items-center gap-2 font-bold text-danger-700">
              <XCircleIcon /> {errors.length === 1 ? "1 problem found" : `${errors.length} problems found`}
            </p>
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
              {errors.map((issue, i) => (
                <li key={i} className="flex flex-wrap items-start gap-2 rounded-lg bg-white p-3 text-sm ring-1 ring-red-100">
                  {issue.question !== undefined && <Badge tone="error">Q{issue.question}</Badge>}
                  {issue.area && <Badge tone="error">{AREA_LABELS[issue.area]}</Badge>}
                  <span className="min-w-0 flex-1 text-ink">{issue.message}</span>
                  {issue.line && (
                    <button type="button" onClick={() => props.onJumpToLine(issue.line!)} className="text-xs font-semibold text-brand-700 underline-offset-2 hover:underline">
                      Line {issue.line}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-line bg-white/95 px-4 py-2 backdrop-blur sm:py-3 sm:mx-0 sm:mb-2 sm:rounded-xl sm:border sm:shadow-pop" data-testid="action-bar">
        <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3">
          <div className="flex items-center gap-3" role="status" data-testid="flow-status" data-status={status}>
            <span
              className={cx(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full sm:h-8 sm:w-8",
                s.tone === "ok" && "bg-success-600 text-white",
                s.tone === "todo" && "bg-brand-50 text-brand-600",
                s.tone === "warn" && "bg-amber-100 text-amber-700",
                s.tone === "error" && "bg-danger-50 text-danger-600",
              )}
            >
              {s.tone === "ok" ? <CheckIcon size={16} strokeWidth={3} /> : s.tone === "error" ? <XCircleIcon size={18} /> : <AlertIcon size={16} />}
            </span>
            <div className="text-sm leading-tight">
              <p className="font-semibold text-ink">{s.title}</p>
              <p className="hidden whitespace-nowrap text-xs text-muted sm:block">{s.hint}</p>
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <Button type="submit" variant="secondary" disabled={empty} className="h-10 sm:h-11">
              <CheckIcon size={16} /> Validate Questions
            </Button>
            <Button variant="secondary" onClick={props.onPreview} disabled={!props.canPreview} className="h-10 sm:h-11">
              <EyeIcon size={16} /> Preview Form
            </Button>
            <Button onClick={props.onConvert} disabled={!props.canConvert} className="col-span-2 h-10 sm:h-11">
              Convert into Google Form
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
});
