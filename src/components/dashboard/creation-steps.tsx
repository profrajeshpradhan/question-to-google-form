"use client";

import { CheckIcon, FormDocIcon, Spinner, XIcon } from "@/components/ui/icons";
import { Card, cx } from "@/components/ui/primitives";
import { STEP_LABELS, STEP_ORDER, type StepId, type StepStatus } from "@/lib/forms/events";
import { DonationCard } from "./donation-card";

export type StepMap = Record<StepId, StepStatus>;

export const initialSteps = (): StepMap => ({ create: "pending", quiz: "pending", questions: "pending", verify: "pending", publish: "pending" });

const RESUME_LABELS: Partial<Record<StepId, string>> = { create: "Checking the existing form" };

const STATUS_TEXT: Record<StepStatus, string> = {
  pending: "Waiting",
  active: "In progress",
  done: "Complete",
  skipped: "Not needed",
  failed: "Failed",
};

export function StepList({ steps, resume = false }: { steps: StepMap; resume?: boolean }) {
  return (
    <ol className="space-y-2" aria-label="Creation steps">
      {STEP_ORDER.map((id) => {
        const status = steps[id];
        return (
          <li
            key={id}
            className={cx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
              status === "active" && "bg-brand-50",
              status === "failed" && "bg-danger-50",
            )}
            data-step={id}
            data-status={status}
          >
            <span
              className={cx(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                status === "done" && "bg-success-600 text-white",
                status === "active" && "text-brand-600",
                status === "failed" && "bg-danger-600 text-white",
                status === "pending" && "border-2 border-gray-300",
                status === "skipped" && "border-2 border-dashed border-gray-300",
              )}
            >
              {status === "done" && <CheckIcon size={14} strokeWidth={3} />}
              {status === "active" && <Spinner size={20} />}
              {status === "failed" && <XIcon size={14} strokeWidth={3} />}
            </span>
            <span className={cx("flex-1", status === "pending" || status === "skipped" ? "text-muted" : "font-semibold text-ink")}>
              {(resume && RESUME_LABELS[id]) || STEP_LABELS[id]}
            </span>
            <span className={cx("text-xs font-medium", status === "done" ? "text-success-700" : status === "failed" ? "text-danger-700" : "text-muted")}>
              {STATUS_TEXT[status]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function CreatingStep({ steps, resume }: { steps: StepMap; resume: boolean }) {
  const completed = STEP_ORDER.filter((id) => steps[id] === "done" || steps[id] === "skipped").length;
  // Progress comes first on phones; on wide screens the donation appeal sits on the left.
  return (
    <div className="mx-auto grid max-w-5xl items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Card className="p-6 sm:p-8 lg:order-2">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <FormDocIcon size={34} />
          </span>
          <h1 className="mt-4 text-xl font-extrabold text-ink">{resume ? "Finishing your Google Form" : "Creating your Google Form"}</h1>
          <p className="mt-1 text-sm text-muted">Please keep this page open while your form is being created.</p>
        </div>
        <div className="mt-6" aria-live="polite">
          <StepList steps={steps} resume={resume} />
        </div>
        <p className="mt-5 text-center text-xs text-muted">
          {completed} of {STEP_ORDER.length} steps done
        </p>
      </Card>
      <DonationCard
        heading="While you wait…"
        message="This tool is free. Please consider a small donation to support underprivileged students."
        className="mx-auto w-full max-w-md shadow-card lg:order-1 lg:max-w-none"
      />
    </div>
  );
}
