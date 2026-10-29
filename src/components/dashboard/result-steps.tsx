"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeftIcon, CheckCircleIcon, CheckIcon, CopyIcon, EditIcon, ExternalIcon, PlusIcon, RefreshIcon, UsersIcon, XCircleIcon } from "@/components/ui/icons";
import { Alert, Button, buttonClass, Card, cx } from "@/components/ui/primitives";
import { copyText } from "@/lib/client/clipboard";
import type { CreateResult } from "@/lib/forms/events";
import { describeSettings, type FormConfig } from "@/lib/quiz/form-config";
import { StepList, type StepMap } from "./creation-steps";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          setCopied(await copyText(value));
          setTimeout(() => setCopied(false), 2000);
        }}
        className={buttonClass("secondary", "sm")}
        aria-label={`Copy ${label}`}
      >
        {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
        {copied ? "Copied" : "Copy"}
      </button>
      <span role="status" className="sr-only">{copied ? `${label} copied` : ""}</span>
    </>
  );
}

function LinkRow({ icon, title, url, hint, testId }: { icon: ReactNode; title: string; url: string; hint?: string; testId: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 sm:flex-row sm:items-center">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icon}</span>
      <div className="min-w-0 flex-1">
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline" data-testid={testId}>
          {title} <ExternalIcon size={15} />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        <p className="truncate font-mono text-xs text-muted">{url}</p>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
      <CopyButton value={url} label={title} />
    </div>
  );
}

export function SuccessStep({
  result,
  config,
  onCreateAnother,
  onBackToEditor,
}: {
  result: CreateResult;
  config: FormConfig;
  onCreateAnother: () => void;
  onBackToEditor: () => void;
}) {
  const settings = describeSettings(config, { publish: result.published });
  const verified = settings.filter((r) => r.status === "auto");
  const manual = settings.filter((r) => r.status === "manual");
  return (
    <Card className="mx-auto max-w-2xl overflow-hidden">
      <div className="bg-success-50 px-6 py-8 text-center sm:px-10">
        <CheckCircleIcon size={56} className="mx-auto text-success-600" />
        <h1 className="mt-3 text-2xl font-extrabold text-ink" data-testid="success-title">Your Google Form has been created!</h1>
        <p className="mt-1 text-sm text-muted">The quiz was created and verified in your connected Google account.</p>
      </div>
      <div className="space-y-4 p-6 sm:p-8">
        <dl className="divide-y divide-line rounded-2xl border border-line text-sm">
          {[
            ["Form title", result.title],
            ["Questions created", String(result.questionCount)],
            ["Sections", String(result.sectionCount)],
            ["Student identification fields", String(result.fieldCount)],
            ["Total marks", String(result.totalMarks)],
            ["Status", result.published ? "Published · accepting responses" : "Unpublished draft"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-4 py-3">
              <dt className="text-muted">{k}</dt>
              <dd className="min-w-0 break-words text-right font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="rounded-2xl border border-green-200 bg-success-50 p-4 text-sm" data-testid="verified-settings">
          <p className="font-semibold text-green-900">Applied and verified with Google</p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {verified.map((r) => (
              <li key={r.key} className="flex items-start gap-1.5 text-green-900">
                <CheckIcon size={14} className="mt-0.5 shrink-0" strokeWidth={3} /> {r.label}: {r.value}
              </li>
            ))}
          </ul>
        </div>

        {manual.length > 0 && <ManualChecklist items={manual.map((r) => r.manualStep!)} editUrl={result.editUrl} />}

        <LinkRow icon={<EditIcon />} title="Open in Google Forms (Edit)" url={result.editUrl} testId="edit-link" />
        {result.published && result.responderUrl ? (
          <LinkRow
            icon={<UsersIcon />}
            title="Open Respondent Link"
            url={result.responderUrl}
            hint="Share this link with students. Who can respond (anyone, or only your organisation) follows your Google account's sharing settings; change it in Google Forms → Publish → Manage."
            testId="responder-link"
          />
        ) : (
          <Alert tone="info" title="Respondent link not active yet">
            The form is an unpublished draft. Open it in Google Forms and click <strong>Publish</strong> when you’re ready, then share the respondent link from there.
          </Alert>
        )}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <Button size="lg" className="flex-1" onClick={onCreateAnother}>
            <PlusIcon size={18} /> Create Another Form
          </Button>
          <Button variant="secondary" size="lg" className="flex-1" onClick={onBackToEditor}>
            Edit these questions
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Settings the Forms API can't set, with a tick-box per step (kept only on this screen). */
function ManualChecklist({ items, editUrl }: { items: string[]; editUrl: string }) {
  const [done, setDone] = useState<boolean[]>(() => items.map(() => false));
  const remaining = done.filter((d) => !d).length;
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm" data-testid="manual-checklist">
      <p className="font-semibold text-amber-900">Finish these {items.length} settings in Google Forms</p>
      <p className="mt-0.5 text-amber-900">
        The Google Forms API has no option for them, so they were <strong>not</strong> changed.{" "}
        <a href={editUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">
          Open the form
        </a>{" "}
        and set:
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, i) => (
          <li key={item}>
            <label className="flex items-start gap-2 text-amber-950">
              <input
                type="checkbox"
                checked={done[i]}
                onChange={(e) => setDone((prev) => prev.map((d, j) => (j === i ? e.target.checked : d)))}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
              />
              <span className={cx(done[i] && "line-through opacity-60")}>{item}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-amber-900" role="status">
        {remaining === 0 ? "All done." : `${remaining} remaining`}
      </p>
    </div>
  );
}

export interface FailureInfo {
  code: string;
  message: string;
  formId?: string;
  editUrl?: string;
  /** Remaining steps can be run on the same form. */
  resumable: boolean;
  /** A brand-new attempt is safe (no form exists). */
  retryable: boolean;
  details?: string[];
}

export function FailureStep({
  failure,
  steps,
  resume,
  onResume,
  onRetry,
  onBackToPreview,
  onEdit,
}: {
  failure: FailureInfo;
  steps: StepMap | null;
  resume: boolean;
  onResume: () => void;
  onRetry: () => void;
  onBackToPreview: () => void;
  onEdit: () => void;
}) {
  const partial = Boolean(failure.formId);
  const sessionProblem = failure.code === "session_expired" || failure.code === "unauthenticated";
  return (
    <Card className="mx-auto max-w-2xl p-6 sm:p-8" data-testid="failure">
      <div role="alert" className="flex items-start gap-3">
        <XCircleIcon size={32} className={cx("shrink-0", partial ? "text-amber-600" : "text-danger-600")} />
        <div>
          <h1 className="text-xl font-extrabold text-ink">
            {sessionProblem
              ? "Please reconnect your Google account"
              : partial
                ? "Your form was created, but not finished"
                : "The form couldn't be created"}
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">{failure.message}</p>
        </div>
      </div>

      {partial && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-900">A form already exists in your Google account</p>
          <p className="mt-1 text-amber-900">
            To avoid duplicates, the app will not create another one automatically.
            {failure.resumable ? " Use “Finish this form” to complete the remaining steps on the same form." : " Open it in Google Forms to review or delete it."}
          </p>
          <p className="mt-2 break-all font-mono text-xs text-amber-900">Form ID: {failure.formId}</p>
          {failure.editUrl && (
            <a href={failure.editUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline" data-testid="partial-edit-link">
              Open in Google Forms <ExternalIcon size={15} />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
        </div>
      )}

      {failure.details && failure.details.length > 0 && (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink">
          {failure.details.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}

      {steps && (
        <div className="mt-5">
          <StepList steps={steps} resume={resume} />
        </div>
      )}

      {sessionProblem && (
        <p className="mt-4 text-sm text-muted">Your questions are kept in this tab while you reconnect.{partial ? " The existing form will be offered again so you can finish it." : ""}</p>
      )}

      <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:flex-wrap">
        {sessionProblem ? (
          <a href="/api/auth/google" className={buttonClass("primary", "lg")}>
            <RefreshIcon size={18} /> Reconnect Google account
          </a>
        ) : partial && failure.resumable ? (
          <Button size="lg" onClick={onResume}>
            <RefreshIcon size={18} /> Finish this form
          </Button>
        ) : !partial && failure.retryable ? (
          <Button size="lg" onClick={onRetry}>
            <RefreshIcon size={18} /> Try again
          </Button>
        ) : null}
        <Button variant="secondary" size="lg" onClick={onBackToPreview}>
          <ArrowLeftIcon size={18} /> Back to preview
        </Button>
        <Button variant="ghost" size="lg" onClick={onEdit}>
          Edit input
        </Button>
      </div>
    </Card>
  );
}
