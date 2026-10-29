"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "./icons";
import { Badge, Card, cx } from "./primitives";

/** Accessible on/off switch (a checkbox with role="switch"). */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  badge,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  badge?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>}
        {badge && <div className="mt-1.5">{badge}</div>}
      </div>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-gray-300 transition-colors before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-brand-600 checked:before:translate-x-5 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

export type ApplyStatus = "auto" | "manual" | "unsupported" | "needs_auth";

const STATUS_BADGE: Record<ApplyStatus, { tone: "success" | "warning" | "neutral" | "error"; text: string }> = {
  auto: { tone: "success", text: "Applied automatically" },
  manual: { tone: "warning", text: "Manual step in Google Forms" },
  unsupported: { tone: "neutral", text: "Not supported by the API" },
  needs_auth: { tone: "neutral", text: "Needs extra Google permission" },
};

export function StatusBadge({ status }: { status: ApplyStatus }) {
  const { tone, text } = STATUS_BADGE[status];
  return <Badge tone={tone}>{text}</Badge>;
}

/** Card with a header that collapses its body. */
export function CollapsibleCard({
  title,
  step,
  summary,
  defaultOpen = true,
  children,
  testId,
}: {
  title: ReactNode;
  step: number;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  testId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <Card className="overflow-hidden" data-testid={testId}>
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-brand-50/50 sm:px-6"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white" aria-hidden="true">
            {step}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-ink">{title}</span>
            {summary && <span className="block truncate text-xs font-normal text-muted">{summary}</span>}
          </span>
          <ChevronDownIcon size={18} className={cx("shrink-0 text-muted transition-transform", open && "rotate-180")} />
        </button>
      </h2>
      <div id={bodyId} hidden={!open} className="border-t border-line px-5 py-5 sm:px-6">
        {children}
      </div>
    </Card>
  );
}

export const inputClass =
  "block w-full rounded-xl border border-line bg-white px-3.5 text-ink shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 aria-[invalid=true]:border-danger-600";

/** Square icon-only button with an accessible name. */
export function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        danger ? "text-danger-600 hover:bg-danger-50" : "text-muted hover:bg-brand-50 hover:text-brand-700",
      )}
    >
      {children}
    </button>
  );
}
