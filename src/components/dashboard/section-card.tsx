"use client";

import { useState, type ReactNode } from "react";
import { IconButton, inputClass, Menu } from "@/components/ui/controls";
import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, PlusCircleIcon, TrashIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Button, cx } from "@/components/ui/primitives";
import {
  addField,
  blankField,
  CONFIG_LIMITS,
  FIELD_TYPE_LABELS,
  moveQuestionToSection,
  moveQuestionWithinSection,
  moveSection,
  removeSection,
  updateSection,
  type FieldType,
  type FormConfig,
  type RemoveSectionStrategy,
  type Section,
} from "@/lib/quiz/form-config";
import type { QuizQuestion } from "@/lib/quiz/types";
import { FieldCard, TYPE_ICONS } from "./field-card";
import { QuestionCard } from "./question-card";

type Update = (fn: (config: FormConfig) => FormConfig) => void;

const QUICK_TYPES: FieldType[] = ["short", "paragraph", "choice", "dropdown"];
const MORE_TYPES: FieldType[] = ["checkbox", "date", "time"];

export function SectionCard({
  section,
  index,
  total,
  config,
  update,
  questions,
  displayNumber,
  selectedFieldId,
  onSelectField,
  onDiscardQuestions,
  children,
}: {
  section: Section;
  index: number;
  total: number;
  config: FormConfig;
  update: Update;
  /** Live-parsed questions by number (empty while the pasted text has errors). */
  questions: Map<number, QuizQuestion>;
  displayNumber: Map<number, number>;
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onDiscardQuestions: (numbers: number[]) => void;
  /** Extra content, e.g. the paste box in the main Questions section. */
  children?: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moreTypes, setMoreTypes] = useState(false);
  const [addingDescription, setAddingDescription] = useState(false);
  const showDescription = addingDescription || Boolean(section.description);
  const name = section.title.trim() || `Section ${index + 1}`;
  const isDetails = section.kind === "details";
  const questionSections = config.sections.filter((s) => s.kind === "questions");
  const canDelete = isDetails || questionSections.length > 1;
  const others = questionSections.filter((s) => s.id !== section.id);
  const candidates = others.flatMap((s) => s.questions.filter((n) => questions.has(n)).map((n) => ({ n, from: s })));

  const remove = (strategy: RemoveSectionStrategy) => {
    const result = removeSection(config, section.id, strategy);
    update(() => result.config);
    if (result.discarded.length) onDiscardQuestions(result.discarded);
    setDeleting(false);
  };
  const requestDelete = () => {
    const hasContent = isDetails ? config.fields.length > 0 : section.questions.length > 0;
    if (hasContent) setDeleting(true);
    else remove("discard");
  };
  const addOfType = (type: FieldType) => {
    const field = blankField(type);
    update((c) => addField(c, field));
    onSelectField(field.id);
  };

  return (
    <section aria-label={`Section ${index + 1} of ${total}: ${name}`} data-testid="section" data-kind={section.kind}>
      <div className="flex items-end justify-between gap-2">
        <span className="rounded-t-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">
          Section {index + 1} of {total}
        </span>
        <div className="flex items-center pb-0.5">
          <IconButton label={`Move ${name} up`} onClick={() => update((c) => moveSection(c, section.id, -1))} disabled={index === 0}>
            <ArrowUpIcon size={18} />
          </IconButton>
          <IconButton label={`Move ${name} down`} onClick={() => update((c) => moveSection(c, section.id, 1))} disabled={index === total - 1}>
            <ArrowDownIcon size={18} />
          </IconButton>
          <IconButton label={`Delete ${name}`} onClick={requestDelete} disabled={!canDelete} danger>
            <TrashIcon size={18} />
          </IconButton>
          <Menu
            label={`More options for ${name}`}
            items={[
              {
                label: "Description",
                checked: showDescription,
                onSelect: () => {
                  if (showDescription) update((c) => updateSection(c, section.id, { description: "" }));
                  setAddingDescription(!showDescription);
                },
              },
            ]}
          />
        </div>
      </div>

      <div className="rounded-lg rounded-tl-none border border-line border-t-[3px] border-t-brand-600 bg-white shadow-card">
        <div className="flex items-start gap-2 px-5 pb-4 pt-5 sm:px-6">
          <div className="min-w-0 flex-1">
            <input
              aria-label={`Section ${index + 1} title`}
              value={section.title}
              onChange={(e) => update((c) => updateSection(c, section.id, { title: e.target.value }))}
              maxLength={CONFIG_LIMITS.maxSectionTitleChars}
              placeholder="Section title"
              className="block w-full border-b border-transparent bg-transparent py-1.5 text-2xl text-ink placeholder:text-gray-400 hover:border-gray-300 focus:border-b-2 focus:border-brand-600 focus:outline-none focus-visible:outline-none"
            />
            {showDescription && (
              <input
                aria-label={`Section ${index + 1} description`}
                value={section.description}
                onChange={(e) => update((c) => updateSection(c, section.id, { description: e.target.value }))}
                maxLength={CONFIG_LIMITS.maxSectionDescriptionChars}
                placeholder="Description"
                autoFocus={addingDescription && !section.description}
                className="mt-2 block w-full border-b border-transparent bg-transparent py-1 text-sm text-gray-700 placeholder:text-gray-500 hover:border-gray-300 focus:border-b-2 focus:border-brand-600 focus:outline-none focus-visible:outline-none"
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Expand ${name}` : `Collapse ${name}`}
            className="rounded-full p-2 text-muted hover:bg-gray-100"
          >
            <ChevronDownIcon size={20} className={cx("transition-transform", !collapsed && "rotate-180")} />
          </button>
        </div>

        {!collapsed && (
          <div className="space-y-3 border-t border-line bg-forms-bg/50 p-3 sm:p-4">
            {isDetails ? (
              <>
                <ol className="space-y-3" aria-label="Student Identification fields">
                  {config.fields.map((field, i) => (
                    <FieldCard
                      key={field.id}
                      field={field}
                      index={i}
                      total={config.fields.length}
                      selected={selectedFieldId === field.id}
                      onSelect={() => onSelectField(field.id)}
                      update={update}
                    />
                  ))}
                </ol>
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-brand-300 bg-white p-3">
                  <Button variant="secondary" onClick={() => addOfType("short")} disabled={config.fields.length >= CONFIG_LIMITS.maxFields}>
                    <PlusCircleIcon size={18} /> Add Field
                  </Button>
                  {[...QUICK_TYPES, ...(moreTypes ? MORE_TYPES : [])].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => addOfType(type)}
                      disabled={config.fields.length >= CONFIG_LIMITS.maxFields}
                      aria-label={`Add ${FIELD_TYPE_LABELS[type]} field`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-gray-50 disabled:opacity-40 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-gray-600"
                    >
                      {TYPE_ICONS[type]}
                      {FIELD_TYPE_LABELS[type]}
                    </button>
                  ))}
                  {!moreTypes && (
                    <button type="button" onClick={() => setMoreTypes(true)} className="rounded-md border border-brand-200 px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50">
                      More…
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                {children}
                {section.questions.some((n) => questions.has(n)) ? (
                  <ol className="space-y-3" aria-label={`Questions in ${name}`}>
                    {section.questions.map((n, i) => {
                      const q = questions.get(n);
                      if (!q) return null;
                      return (
                        <QuestionCard
                          key={n}
                          question={q}
                          number={displayNumber.get(n) ?? i + 1}
                          required={config.defaults.required}
                          graded={config.quiz.isQuiz}
                          controls={
                            <>
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
                                  className="h-8 max-w-[12rem] rounded-lg border border-line bg-white px-2 text-xs text-ink"
                                >
                                  <option value="">Move to section…</option>
                                  {others.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.title.trim() || "Untitled section"}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </>
                          }
                        />
                      );
                    })}
                  </ol>
                ) : (
                  !children && <p className="rounded-xl border border-dashed border-line bg-white p-4 text-center text-sm text-muted">No questions in this section yet.</p>
                )}
                {candidates.length > 0 && (
                  <select
                    aria-label={`Add a question to ${name}`}
                    value=""
                    onChange={(e) => e.target.value && update((c) => moveQuestionToSection(c, Number(e.target.value), section.id))}
                    className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink"
                  >
                    <option value="">+ Add a question to this section…</option>
                    {candidates.map(({ n, from }) => (
                      <option key={n} value={n}>
                        Q{n}: {(questions.get(n)?.text ?? "").slice(0, 60)} — {from.title.trim() || "untitled"}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {deleting && <DeleteSectionModal section={section} config={config} onClose={() => setDeleting(false)} onConfirm={remove} />}
    </section>
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
  onConfirm: (strategy: RemoveSectionStrategy) => void;
}) {
  const targets = config.sections.filter((s) => s.kind === "questions" && s.id !== section.id);
  const [mode, setMode] = useState<"move" | "discard">("move");
  const [target, setTarget] = useState(targets[0]?.id ?? "");
  const name = section.title.trim() || "this section";
  const n = section.questions.length;

  if (section.kind === "details") {
    const count = config.fields.length;
    return (
      <Modal
        open
        onClose={onClose}
        title={`Delete “${name}”?`}
        description={`Its ${count} ${count === 1 ? "field" : "fields"} will be deleted too.`}
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
      description={`It contains ${n} ${n === 1 ? "question" : "questions"}.`}
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
            <span className="block text-xs text-muted">Removes {section.questions.map((q) => `Q${q}`).join(", ")} from your pasted text. This can&apos;t be undone.</span>
          </span>
        </label>
      </div>
    </Modal>
  );
}
