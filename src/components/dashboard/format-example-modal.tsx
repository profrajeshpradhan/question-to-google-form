"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/primitives";
import { SAMPLE_INPUT } from "@/lib/quiz/parser";
import { LIMITS } from "@/lib/quiz/limits";
import { copyText } from "@/lib/client/clipboard";

const FIELDS = [
  ["Q1:", "Starts a question. Number questions Q1, Q2, Q3… The question text follows the colon."],
  ["OPTIONS:", "Optional heading before the options."],
  ["A. B. C. …", `One option per line, labelled with a letter. ${LIMITS.minOptions}–${LIMITS.maxOptions} options, each different.`],
  ["ANSWER:", "The letter of the correct option (e.g. ANSWER: B). Exactly one correct answer per question."],
  ["MARKS:", "Whole-number points for the question (e.g. MARKS: 2). Google Forms quizzes don't support decimal points."],
  ["FORM TITLE: / FORM DESCRIPTION:", "Optional lines at the very top. They are used only when the title or description field above is empty."],
] as const;

export function FormatExampleModal({ open, onClose, onUseExample }: { open: boolean; onClose: () => void; onUseExample?: () => void }) {
  const [copied, setCopied] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Input format example"
      description="Use this format for your questions. Closing this window keeps your current input."
      footer={
        <>
          {onUseExample && (
            <Button variant="ghost" onClick={onUseExample}>
              Insert example into editor
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={async () => {
              setCopied(await copyText(SAMPLE_INPUT));
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
            {copied ? "Copied" : "Copy example"}
          </Button>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <pre className="overflow-x-auto rounded-xl border border-line bg-canvas p-4 font-mono text-[13px] leading-6 text-ink" data-testid="format-example">
        {SAMPLE_INPUT}
      </pre>
      <span role="status" className="sr-only">{copied ? "Example copied to clipboard" : ""}</span>
      <h3 className="mt-6 text-sm font-bold text-ink">Required fields</h3>
      <dl className="mt-3 divide-y divide-line rounded-xl border border-line text-sm">
        {FIELDS.map(([term, desc]) => (
          <div key={term} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
            <dt className="font-mono font-semibold text-brand-700">{term}</dt>
            <dd className="text-muted">{desc}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
        <strong>One correct answer per question.</strong> Version one supports single-answer multiple-choice questions only. You can also write the answer as the option text (e.g. <code className="font-mono">ANSWER: HTML</code>).
      </p>
    </Modal>
  );
}
