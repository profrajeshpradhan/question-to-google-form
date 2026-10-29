"use client";

import { useId, useState } from "react";
import { IconButton, inputClass } from "@/components/ui/controls";
import { ArrowDownIcon, ArrowUpIcon, EyeIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Badge, Button, Card, cx } from "@/components/ui/primitives";
import {
  addSection,
  CONFIG_LIMITS,
  FIELD_TYPE_LABELS,
  moveQuestionToSection,
  moveQuestionWithinSection,
  moveSection,
  removeSection,
  updateSection,
  type FormConfig,
  type Section,
} from "@/lib/quiz/form-config";
import type { Quiz, QuizQuestion } from "@/lib/quiz/types";
import { marksLabel } from "./validation-step";

type Update = (fn: (config: FormConfig) => FormConfig) => void;

/**
 * Section manager. MCQs come from the pasted text; this only decides which
 * section each one goes into and in what order.
 */
export function SectionsCard({
  config,
  update,
  quiz,
  onDiscardQuestions,
}: {
  config: FormConfig;
  update: Update;
  /** Live-parsed questions, or null while the pasted text has errors. */
  quiz: Quiz | null;
  /** Explicitly deletes these question blocks from the pasted text. */
  onDiscardQuestions: (numbers: number[]) => void;
}) {
  const [deleting, setDeleting] = useState<Section | null>(null);
  const byNumber = new Map((quiz?.questions ?? []).map((q) => [q.number, q]));
  const questionSections = config.sections.filter((s) => s.kind === "questions");
  const atLimit = config.sections.length >= CONFIG_LIMITS.maxSections;

  const requestDelete = (section: Section) => {
    const hasContent = section.kind === "details" ? config.fields.length > 0 : section.questions.length > 0;
    if (hasContent) setDeleting(section);
    else update((c) => removeSection(c, section.id, "discard").config);
  };

  return (
    <div className="space-y-3" data-testid="sections">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {config.sections.length === 1
            ? "All questions are in one section. Add a section to split the quiz into pages."
            : `${config.sections.length} sections. Each section after the first starts a new page in Google Forms.`}
        </p>
        <Button variant="secondary" size="sm" onClick={() => update(addSection)} disabled={atLimit}>
          <PlusIcon size={16} /> Add Section
        </Button>
      </div>

      {!quiz && (
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900" role="status">
          Your pasted questions currently have errors, so they can&apos;t be arranged yet. Section titles and descriptions can still be edited.
        </p>
      )}

      <ol className="space-y-3" aria-label="Sections">
        {config.sections.map((section, index) => (
          <SectionEditor
            key={section.id}
            section={section}
            index={index}
            total={config.sections.length}
            config={config}
            questionSections={questionSections}
            byNumber={byNumber}
            quizReady={Boolean(quiz)}
            update={update}
            onDelete={() => requestDelete(section)}
          />
        ))}
      </ol>

      {deleting && (
        <DeleteSectionModal
          section={deleting}
          config={config}
          onClose={() => setDeleting(null)}
          onConfirm={(strategy) => {
            const result = removeSection(config, deleting.id, strategy);
            update(() => result.config);
            if (result.discarded.length) onDiscardQuestions(result.discarded);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}

function SectionEditor({
  section,
  index,
  total,
  config,
  questionSections,
  byNumber,
  quizReady,
  update,
  onDelete,
}: {
  section: Section;
  index: number;
  total: number;
  config: FormConfig;
  questionSections: Section[];
  byNumber: Map<number, QuizQuestion>;
  quizReady: boolean;
  update: Update;
  onDelete: () => void;
}) {
  const ids = { title: useId(), desc: useId(), add: useId() };
  const [preview, setPreview] = useState(false);
  const name = section.title.trim() || `Section ${index + 1}`;
  const isDetails = section.kind === "details";
  const canDelete = isDetails || questionSections.length > 1;
  const others = questionSections.filter((s) => s.id !== section.id);
  const candidates = others.flatMap((s) => s.questions.map((n) => ({ n, from: s })));

  return (
    <li className="rounded-2xl border border-line bg-white" data-testid="section">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-lavender px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-brand-800">
            Section {index + 1} of {total}
          </span>
          <Badge tone={isDetails ? "brand" : "neutral"}>
            {isDetails ? "Student details" : `${section.questions.length} ${section.questions.length === 1 ? "question" : "questions"}`}
          </Badge>
        </div>
        <div className="flex gap-1.5">
          <IconButton label={`Preview ${name}`} onClick={() => setPreview((v) => !v)}>
            <EyeIcon size={15} />
          </IconButton>
          <IconButton label={`Move ${name} up`} onClick={() => update((c) => moveSection(c, section.id, -1))} disabled={index === 0}>
            <ArrowUpIcon size={15} />
          </IconButton>
          <IconButton label={`Move ${name} down`} onClick={() => update((c) => moveSection(c, section.id, 1))} disabled={index === total - 1}>
            <ArrowDownIcon size={15} />
          </IconButton>
          <IconButton label={`Delete ${name}`} onClick={onDelete} disabled={!canDelete} danger>
            <TrashIcon size={15} />
          </IconButton>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={ids.title} className="block text-xs font-semibold text-ink">
              Section {index + 1} title
            </label>
            <input
              id={ids.title}
              value={section.title}
              onChange={(e) => update((c) => updateSection(c, section.id, { title: e.target.value }))}
              maxLength={CONFIG_LIMITS.maxSectionTitleChars}
              className={cx(inputClass, "mt-1 h-10 text-sm")}
            />
          </div>
          <div>
            <label htmlFor={ids.desc} className="block text-xs font-semibold text-ink">
              Section {index + 1} description <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id={ids.desc}
              value={section.description}
              onChange={(e) => update((c) => updateSection(c, section.id, { description: e.target.value }))}
              maxLength={CONFIG_LIMITS.maxSectionDescriptionChars}
              className={cx(inputClass, "mt-1 h-10 text-sm")}
            />
          </div>
        </div>
        {index === 0 && total > 1 && (
          <p className="text-xs text-muted">Google Forms shows the form title above the first section, so this title appears as a heading under it.</p>
        )}

        {isDetails ? (
          <ul className="space-y-1 text-sm">
            {config.fields.map((f) => (
              <li key={f.id} className="flex items-center gap-2 text-ink">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400" aria-hidden="true" />
                <span className="min-w-0 truncate">{f.label.trim() || "Untitled field"}</span>
                {f.required && <span className="text-danger-600" aria-label="required">*</span>}
                <span className="text-xs text-muted">· {FIELD_TYPE_LABELS[f.type]}</span>
              </li>
            ))}
            <li className="pt-1 text-xs text-muted">Edit these fields in Student Identification.</li>
          </ul>
        ) : quizReady ? (
          <>
            {section.questions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-muted">No questions yet. Add questions from another section below.</p>
            ) : (
              <ol className="space-y-1.5" aria-label={`Questions in ${name}`}>
                {section.questions.map((n, i) => {
                  const q = byNumber.get(n);
                  return (
                    <li key={n} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm" data-testid="section-question">
                      <span className="min-w-0 flex-1 truncate text-ink">
                        <span className="font-semibold">Q{n}.</span> {q?.text ?? "…"}
                        {q && <span className="text-xs text-muted"> ({marksLabel(q.marks)})</span>}
                      </span>
                      <IconButton label={`Move Q${n} up`} onClick={() => update((c) => moveQuestionWithinSection(c, n, -1))} disabled={i === 0}>
                        <ArrowUpIcon size={14} />
                      </IconButton>
                      <IconButton label={`Move Q${n} down`} onClick={() => update((c) => moveQuestionWithinSection(c, n, 1))} disabled={i === section.questions.length - 1}>
                        <ArrowDownIcon size={14} />
                      </IconButton>
                      {others.length > 0 && (
                        <select
                          aria-label={`Move Q${n} to section`}
                          value=""
                          onChange={(e) => e.target.value && update((c) => moveQuestionToSection(c, n, e.target.value))}
                          className="h-8 max-w-[11rem] rounded-lg border border-line bg-white px-2 text-xs text-ink"
                        >
                          <option value="">Move to…</option>
                          {others.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.title.trim() || "Untitled section"}
                            </option>
                          ))}
                        </select>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            {candidates.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor={ids.add} className="text-xs font-semibold text-ink">
                  Add questions to this section
                </label>
                <select
                  id={ids.add}
                  value=""
                  onChange={(e) => e.target.value && update((c) => moveQuestionToSection(c, Number(e.target.value), section.id))}
                  className="h-8 min-w-0 max-w-full flex-1 rounded-lg border border-line bg-white px-2 text-xs text-ink sm:max-w-xs"
                >
                  <option value="">Choose a question…</option>
                  {candidates.map(({ n, from }) => (
                    <option key={n} value={n}>
                      Q{n}: {(byNumber.get(n)?.text ?? "").slice(0, 60)} — from {from.title.trim() || "untitled"}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        ) : null}

        {preview && <SectionPreview section={section} config={config} byNumber={byNumber} />}
      </div>
    </li>
  );
}

function SectionPreview({ section, config, byNumber }: { section: Section; config: FormConfig; byNumber: Map<number, QuizQuestion> }) {
  const items =
    section.kind === "details"
      ? config.fields.map((f) => ({ key: f.id, title: f.label.trim() || "Untitled field", required: f.required, meta: FIELD_TYPE_LABELS[f.type] }))
      : section.questions.map((n) => {
          const q = byNumber.get(n);
          return { key: String(n), title: q?.text ?? `Q${n}`, required: config.defaults.required, meta: q ? `${q.options.length} options · ${marksLabel(q.marks)}` : "" };
        });
  return (
    <Card className="overflow-hidden shadow-none">
      <div className="h-1.5 bg-brand-600" aria-hidden="true" />
      <div className="p-4">
        <p className="font-bold text-ink">{section.title.trim() || "Untitled section"}</p>
        {section.description.trim() && <p className="mt-0.5 whitespace-pre-line text-xs text-muted">{section.description.trim()}</p>}
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.key} className="rounded-lg border border-line p-2.5 text-sm">
              <span className="text-ink">{item.title}</span> {item.required && <span className="text-danger-600" aria-label="required">*</span>}
              {item.meta && <span className="block text-xs text-muted">{item.meta}</span>}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function DeleteSectionModal({
  section,
  config,
  onClose,
  onConfirm,
}: {
  section: Section;
  config: FormConfig;
  onClose: () => void;
  onConfirm: (strategy: { moveTo: string } | "discard") => void;
}) {
  const targets = config.sections.filter((s) => s.kind === "questions" && s.id !== section.id);
  const [mode, setMode] = useState<"move" | "discard">("move");
  const [target, setTarget] = useState(targets[0]?.id ?? "");
  const name = section.title.trim() || "this section";
  const n = section.questions.length;

  if (section.kind === "details") {
    return (
      <Modal
        open
        onClose={onClose}
        title="Delete the Student Details section?"
        description={`This also deletes its ${config.fields.length} identification ${config.fields.length === 1 ? "field" : "fields"}.`}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Keep section
            </Button>
            <Button variant="danger" onClick={() => onConfirm("discard")}>
              Delete section and fields
            </Button>
          </>
        }
      />
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Delete “${name}”?`}
      description={`It contains ${n} ${n === 1 ? "question" : "questions"}. Choose what happens to ${n === 1 ? "it" : "them"}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={mode === "discard" ? "danger" : "primary"} onClick={() => onConfirm(mode === "move" ? { moveTo: target } : "discard")} disabled={mode === "move" && !target}>
            {mode === "move" ? "Move questions and delete section" : "Delete section and questions"}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <label className="flex items-start gap-2.5">
          <input type="radio" name="delete-mode" checked={mode === "move"} onChange={() => setMode("move")} className="mt-0.5 h-4 w-4 accent-brand-600" />
          <span className="flex-1">
            <span className="font-semibold text-ink">Move the questions to another section</span>
            <select
              aria-label="Target section"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={mode !== "move"}
              className={cx(inputClass, "mt-1.5 h-10 text-sm")}
            >
              {targets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title.trim() || "Untitled section"}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label className="flex items-start gap-2.5">
          <input type="radio" name="delete-mode" checked={mode === "discard"} onChange={() => setMode("discard")} className="mt-0.5 h-4 w-4 accent-brand-600" />
          <span>
            <span className="font-semibold text-ink">Delete the questions too</span>
            <span className="block text-xs text-muted">
              Removes {section.questions.map((q) => `Q${q}`).join(", ")} from your pasted text. This can&apos;t be undone.
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}
