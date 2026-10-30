"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ExternalIcon, RefreshIcon, WifiOffIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Alert, Button, buttonClass } from "@/components/ui/primitives";
import type { PublicSession } from "@/lib/auth/public-session";
import { clearDraft, loadDraft, saveDraft, type Draft } from "@/lib/client/draft";
import { runFormRequest } from "@/lib/client/forms-client";
import type { CreateEvent, CreateResult } from "@/lib/forms/events";
import {
  defaultConfig,
  questionTemplate,
  reconcileSections,
  removeQuestionBlocks,
  validateFormConfig,
  withFixedSettings,
  type FormConfig,
} from "@/lib/quiz/form-config";
import { parseQuiz, SAMPLE_INPUT } from "@/lib/quiz/parser";
import type { ParseResult, ValidationIssue } from "@/lib/quiz/types";
import { CreatingStep, initialSteps, type StepMap } from "./creation-steps";
import { FormCanvas, type FlowStatus } from "./form-canvas";
import { FormatExampleModal } from "./format-example-modal";
import { PreviewStep } from "./preview-step";
import { FailureStep, SuccessStep, type FailureInfo } from "./result-steps";

type Valid = Extract<ParseResult, { ok: true }>;
/** Exactly what was validated; this snapshot (not live editor text) is what gets created. */
interface Snapshot {
  title: string;
  description: string;
  input: string;
  parsed: Valid;
  /** Identification fields, sections and fixed settings, reconciled with the parsed questions and validated. */
  config: FormConfig;
  configWarnings: ValidationIssue[];
}

/** Identity of everything that affects the created form; a change makes validation and preview stale. */
function contentKey(title: string, description: string, input: string, config: FormConfig): string {
  return JSON.stringify([title, description, input, config]);
}

type Stage =
  | { name: "edit" }
  | { name: "preview"; snap: Snapshot; autoConfirm?: boolean }
  | { name: "creating"; snap: Snapshot; resume: boolean }
  | { name: "success"; snap: Snapshot; result: CreateResult }
  | { name: "failed"; snap: Snapshot; failure: FailureInfo; resume: boolean };

const RETRYABLE = new Set(["google_unavailable", "google_quota", "network", "rate_limited"]);

/**
 * Client-only component (loaded with ssr: false) so the draft kept in this tab's
 * sessionStorage can be restored synchronously in the initial state.
 */
export function QuizWorkflow({ session }: { session: PublicSession }) {
  const [initialDraft] = useState<Draft | null>(loadDraft);
  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [description, setDescription] = useState(initialDraft?.description ?? "");
  const [input, setInput] = useState(initialDraft?.input ?? "");
  const [storedConfig, setConfig] = useState<FormConfig>(() => (initialDraft?.config ? withFixedSettings(initialDraft.config) : defaultConfig()));
  /** The last successful validation; it counts only while its key matches the current content. */
  const [validation, setValidation] = useState<{ key: string; snap: Snapshot } | null>(null);
  const [previewedKey, setPreviewedKey] = useState<string | null>(null);
  const [pendingForm, setPendingForm] = useState<Draft["pendingForm"]>(initialDraft?.pendingForm);
  const [errors, setErrors] = useState<ValidationIssue[] | null>(null);
  const [stage, setStage] = useState<Stage>({ name: "edit" });
  const [steps, setSteps] = useState<StepMap>(initialSteps);
  const [showExample, setShowExample] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [restored, setRestored] = useState(Boolean(initialDraft?.input || initialDraft?.title));
  const [online, setOnline] = useState(() => navigator.onLine);
  const [expired, setExpired] = useState(() => Date.now() >= session.expiresAt - 60_000);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);

  // Questions parsed live so they can be arranged into sections while typing.
  const deferredInput = useDeferredValue(input);
  const liveQuiz = useMemo(() => {
    const result = parseQuiz({ input: deferredInput, title: "live" });
    return result.ok ? result.quiz : null;
  }, [deferredInput]);
  const config = useMemo(
    () => (liveQuiz ? reconcileSections(storedConfig, liveQuiz.questions.map((q) => q.number)) : storedConfig),
    [storedConfig, liveQuiz],
  );
  const updateConfig = useCallback((fn: (c: FormConfig) => FormConfig) => setConfig(fn(config)), [config]);

  const currentKey = useMemo(() => contentKey(title, description, input, config), [title, description, input, config]);
  const validationCurrent = validation?.key === currentKey;
  const previewCurrent = validationCurrent && previewedKey === currentKey;
  const flowStatus: FlowStatus = previewCurrent
    ? "previewed"
    : validationCurrent
      ? previewedKey
        ? "preview-stale"
        : "validated"
      : errors?.length
        ? "invalid"
        : validation
          ? "validation-stale"
          : "draft";
  const canConvert = previewCurrent && online && !expired;

  // Keep the draft in this tab (survives reloads and the Google reconnect redirect).
  useEffect(() => {
    saveDraft({ title, description, input, config: storedConfig, pendingForm });
  }, [title, description, input, storedConfig, pendingForm]);

  // Online/offline state.
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Session expiry: Google access tokens last about an hour.
  useEffect(() => {
    const check = () => setExpired(Date.now() >= session.expiresAt - 60_000);
    const timer = window.setInterval(check, 15_000);
    return () => window.clearInterval(timer);
  }, [session.expiresAt]);

  // Move focus to the top of each new screen for keyboard and screen-reader users.
  useEffect(() => {
    if (stage.name !== "edit") headingRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stage.name]);

  /** Step 1: validates questions, fields and sections together, staying on the canvas. */
  const validate = () => {
    const result = parseQuiz({ input, title, description });
    const reconciled = result.ok ? reconcileSections(config, result.quiz.questions.map((q) => q.number)) : config;
    const configCheck = validateFormConfig(reconciled, result.ok ? result.quiz : { questions: [] });
    const allErrors = [...(result.ok ? [] : result.errors), ...configCheck.errors];
    if (!result.ok || allErrors.length > 0) {
      setErrors(allErrors);
      setValidation(null);
      return;
    }
    setErrors(null);
    setConfig(reconciled);
    const snap: Snapshot = { title, description, input, parsed: result, config: reconciled, configWarnings: configCheck.warnings };
    setValidation({ key: contentKey(title, description, input, reconciled), snap });
  };

  /** Step 2: only a current validation can be previewed. */
  const preview = () => {
    if (!validationCurrent || !validation) return;
    setPreviewedKey(currentKey);
    setStage({ name: "preview", snap: validation.snap });
  };

  /** Step 3: only content whose preview is current can be converted (confirmation dialog opens). */
  const convert = () => {
    if (!canConvert || !validation) return;
    setStage({ name: "preview", snap: validation.snap, autoConfirm: true });
  };

  const insertTemplate = () => {
    const highest = Math.max(0, ...(liveQuiz?.questions.map((q) => q.number) ?? []));
    const block = questionTemplate(highest + 1, config.defaults.defaultPoints);
    setInput((current) => (current.trim() ? `${current.trimEnd()}\n\n${block}` : block));
    setRestored(false);
  };

  const discardQuestions = (numbers: number[]) => {
    if (liveQuiz) setInput((current) => removeQuestionBlocks(current, liveQuiz, numbers));
  };

  const jumpToLine = (line: number) => {
    const el = textareaRef.current;
    if (!el) return;
    const lines = el.value.split("\n");
    const start = lines.slice(0, line - 1).reduce((sum, l) => sum + l.length + 1, 0);
    const end = start + (lines[line - 1]?.length ?? 0);
    el.focus();
    el.setSelectionRange(start, end);
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 24;
    el.scrollTop = Math.max(0, (line - 3) * lineHeight);
  };

  const run = useCallback(
    async (snap: Snapshot, publish: boolean, resumeFormId?: string) => {
      const resume = Boolean(resumeFormId);
      // The first request is in flight as soon as the run starts.
      setSteps({ ...initialSteps(), create: "active" });
      setStage({ name: "creating", snap, resume });
      let createdForm: { formId: string; editUrl: string } | undefined = resumeFormId
        ? { formId: resumeFormId, editUrl: `https://docs.google.com/forms/d/${resumeFormId}/edit` }
        : undefined;
      let finished = false;

      const onEvent = (event: CreateEvent) => {
        if (event.type === "step") setSteps((prev) => ({ ...prev, [event.step]: event.status }));
        else if (event.type === "form") {
          createdForm = { formId: event.formId, editUrl: event.editUrl };
          setPendingForm(createdForm);
        } else if (event.type === "result") {
          finished = true;
          setPendingForm(undefined);
          clearDraft();
          setStage({ name: "success", snap, result: event.result });
        } else if (event.type === "error") {
          finished = true;
          const e = event.error;
          if (!e.formId) setPendingForm(undefined);
          setStage({
            name: "failed",
            snap,
            resume,
            failure: {
              code: e.code,
              message: e.message,
              formId: e.formId,
              editUrl: e.editUrl,
              resumable: e.resumable,
              retryable: !e.formId && RETRYABLE.has(e.code),
              details: e.details,
            },
          });
        }
      };

      const outcome = await runFormRequest({
        request: { title: snap.title, description: snap.description, input: snap.input, publish, config: snap.config },
        csrfToken: session.csrfToken,
        resumeFormId,
        onEvent,
      });

      if (outcome.kind === "http-error") {
        if (outcome.code === "validation_failed" && outcome.issues) {
          setErrors(outcome.issues);
          setValidation(null);
          setStage({ name: "edit" });
          return;
        }
        if (outcome.code === "session_expired" || outcome.code === "unauthenticated") setExpired(true);
        setStage({
          name: "failed",
          snap,
          resume,
          failure: {
            code: outcome.code,
            message: outcome.message,
            formId: createdForm?.formId,
            editUrl: createdForm?.editUrl,
            resumable: Boolean(createdForm),
            retryable: !createdForm && RETRYABLE.has(outcome.code),
          },
        });
      } else if (outcome.kind === "network-error" && !finished) {
        const form = createdForm as { formId: string; editUrl: string } | undefined;
        setStage({
          name: "failed",
          snap,
          resume,
          failure: {
            code: "network",
            message: form
              ? "The connection was lost while the form was being set up. Your form exists; use “Finish this form” to check it and complete any remaining steps."
              : "The connection was lost before Google confirmed the form was created. Check your internet connection. If a new form appears in your Google Forms list, delete it before trying again.",
            formId: form?.formId,
            editUrl: form?.editUrl,
            resumable: Boolean(form),
            retryable: !form,
          },
        });
      }
    },
    [session.csrfToken],
  );

  const resetAll = () => {
    setTitle("");
    setDescription("");
    setInput("");
    setConfig(defaultConfig());
    setErrors(null);
    setValidation(null);
    setPreviewedKey(null);
    setPendingForm(undefined);
    clearDraft();
    setStage({ name: "edit" });
  };

  const backToEdit = () => setStage({ name: "edit" });
  const lastPublish = useRef(true);

  return (
    <div className="space-y-4">
      <div ref={headingRef} tabIndex={-1} className="outline-none" aria-live="polite">
        {!online && (
          <Alert tone="warning" title="You're offline" role="status" className="mb-4" action={null}>
            <span className="flex items-center gap-2">
              <WifiOffIcon size={16} /> You can keep editing and validating. Creating a Google Form needs an internet connection.
            </span>
          </Alert>
        )}
        {expired && stage.name !== "success" && (
          <Alert
            tone="warning"
            title="Your Google session has expired"
            role="alert"
            className="mb-4"
            action={
              <a href="/api/auth/google" className={buttonClass("primary", "sm")} data-testid="reconnect">
                <RefreshIcon size={16} /> Reconnect Google account
              </a>
            }
          >
            Reconnect to create forms. Your title, description and questions are kept in this tab.
          </Alert>
        )}
        {restored && stage.name === "edit" && (
          <Alert tone="info" role="status" className="mb-4">
            Your previous input in this tab was restored.
          </Alert>
        )}
        {pendingForm && (stage.name === "edit" || stage.name === "preview") && (
          <Alert
            tone="warning"
            title="You have an unfinished form from an earlier attempt"
            className="mb-4"
            action={
              <>
                <a href={pendingForm.editUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
                  Open it <ExternalIcon size={14} />
                </a>
                {stage.name === "preview" && (
                  <Button size="sm" onClick={() => run(stage.snap, lastPublish.current, pendingForm.formId)}>
                    Finish that form instead
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setPendingForm(undefined)}>
                  Dismiss
                </Button>
              </>
            }
          >
            It is in your Google account as form {pendingForm.formId.slice(0, 12)}…
            {stage.name === "preview" ? " You can finish that form instead of creating a new one." : " Validate and preview your questions to finish it."}
          </Alert>
        )}
      </div>

      {stage.name === "edit" && (
        <FormCanvas
          ref={textareaRef}
          title={title}
          description={description}
          input={input}
          config={config}
          liveQuiz={liveQuiz}
          onConfig={updateConfig}
          status={flowStatus}
          validated={
            validationCurrent && validation
              ? { summary: validation.snap.parsed.summary, warnings: [...validation.snap.parsed.warnings, ...validation.snap.configWarnings] }
              : null
          }
          canPreview={validationCurrent}
          canConvert={canConvert}
          onPreview={preview}
          onConvert={convert}
          onInsertTemplate={insertTemplate}
          onDiscardQuestions={discardQuestions}
          onTitle={(v) => {
            setTitle(v);
            setRestored(false);
          }}
          onDescription={setDescription}
          onInput={(v) => {
            setInput(v);
            setRestored(false);
          }}
          onValidate={validate}
          onClear={() => (input || title || description ? setConfirmClear(true) : undefined)}
          onShowExample={() => setShowExample(true)}
          errors={errors}
          onJumpToLine={jumpToLine}
        />
      )}

      {stage.name === "preview" && (
        <PreviewStep
          quiz={stage.snap.parsed.quiz}
          summary={stage.snap.parsed.summary}
          config={stage.snap.config}
          warnings={stage.snap.configWarnings}
          autoConfirm={stage.autoConfirm}
          accountEmail={session.user.email}
          online={online && !expired}
          onEdit={backToEdit}
          onConfirm={(publish) => {
            lastPublish.current = publish;
            void run(stage.snap, publish);
          }}
        />
      )}

      {stage.name === "creating" && <CreatingStep steps={steps} resume={stage.resume} />}

      {stage.name === "success" && <SuccessStep result={stage.result} onCreateAnother={resetAll} onBackToEditor={backToEdit} />}

      {stage.name === "failed" && (
        <FailureStep
          failure={stage.failure}
          steps={steps}
          resume={stage.resume}
          onResume={() => stage.failure.formId && run(stage.snap, lastPublish.current, stage.failure.formId)}
          onRetry={() => run(stage.snap, lastPublish.current)}
          onBackToPreview={() => setStage({ name: "preview", snap: stage.snap })}
          onEdit={backToEdit}
        />
      )}

      <FormatExampleModal
        open={showExample}
        onClose={() => setShowExample(false)}
        onUseExample={
          input.trim()
            ? undefined
            : () => {
                setInput(SAMPLE_INPUT);
                setShowExample(false);
              }
        }
      />

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear all input?"
        description="This removes the title, description and all pasted questions from this page. It can't be undone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>
              Keep my input
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setTitle("");
                setDescription("");
                setInput("");
                setErrors(null);
                setConfirmClear(false);
                textareaRef.current?.focus();
              }}
            >
              Clear input
            </Button>
          </>
        }
      />
    </div>
  );
}
