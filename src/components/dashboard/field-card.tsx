"use client";

import type { ReactNode } from "react";
import { IconButton, Menu, ToggleSwitch } from "@/components/ui/controls";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarIcon,
  CheckboxIcon,
  ChevronDownIcon,
  ClockIcon,
  CopyIcon,
  DropdownIcon,
  ParagraphIcon,
  RadioIcon,
  ShortTextIcon,
  TrashIcon,
  XIcon,
} from "@/components/ui/icons";
import { cx } from "@/components/ui/primitives";
import {
  CONFIG_LIMITS,
  duplicateField,
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  hasOptions,
  moveField,
  removeField,
  updateField,
  type FieldType,
  type FormConfig,
  type IdField,
} from "@/lib/quiz/form-config";

type Update = (fn: (config: FormConfig) => FormConfig) => void;

export const TYPE_ICONS: Record<FieldType, ReactNode> = {
  short: <ShortTextIcon size={20} />,
  paragraph: <ParagraphIcon size={20} />,
  choice: <RadioIcon size={20} />,
  checkbox: <CheckboxIcon size={20} />,
  dropdown: <DropdownIcon size={20} />,
  date: <CalendarIcon size={20} />,
  time: <ClockIcon size={20} />,
};

/** A Student Identification field, edited in place like a Google Forms question. */
export function FieldCard({
  field,
  index,
  total,
  selected,
  onSelect,
  update,
}: {
  field: IdField;
  index: number;
  total: number;
  selected: boolean;
  onSelect: () => void;
  update: Update;
}) {
  const set = (patch: Partial<Omit<IdField, "id">>) => update((c) => updateField(c, field.id, patch));
  const name = field.label.trim() || `Field ${index + 1}`;

  return (
    <li
      className={cx(
        "relative rounded-lg border border-line bg-white transition-shadow",
        selected && "shadow-card before:absolute before:inset-y-[-1px] before:left-[-1px] before:w-1.5 before:rounded-l-lg before:bg-brand-600",
      )}
      onFocusCapture={onSelect}
      onClick={onSelect}
      data-testid="id-field"
      data-selected={selected || undefined}
    >
      <div className="px-4 pb-2 pt-5 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem] sm:items-start sm:gap-4">
          <input
            aria-label="Field label"
            value={field.label}
            onChange={(e) => set({ label: e.target.value })}
            maxLength={CONFIG_LIMITS.maxLabelChars}
            placeholder="Question"
            className={cx(
              "block w-full min-w-0 border-b px-3.5 py-3.5 text-base text-ink transition-colors placeholder:text-gray-500 focus:border-b-2 focus:border-brand-600 focus:outline-none focus-visible:outline-none",
              selected ? "rounded-t border-gray-300 bg-gray-50" : "border-transparent bg-transparent hover:bg-gray-50",
            )}
          />
          <Menu
            label={`Field type for ${name}`}
            align="right"
            items={FIELD_TYPES.map((t) => ({
              label: FIELD_TYPE_LABELS[t],
              icon: TYPE_ICONS[t],
              role: "menuitemradio" as const,
              checked: field.type === t,
              onSelect: () => set({ type: t }),
            }))}
            triggerClassName="flex h-12 w-full items-center gap-3 rounded border border-line bg-white px-3 text-left text-sm text-ink transition-colors hover:bg-gray-50"
            trigger={
              <>
                <span className="text-gray-600">{TYPE_ICONS[field.type]}</span>
                <span className="flex-1">{FIELD_TYPE_LABELS[field.type]}</span>
                <ChevronDownIcon size={18} className="text-gray-600" />
              </>
            }
          />
        </div>

        <div className="mt-4 px-1">{hasOptions(field.type) ? <OptionsEditor field={field} name={name} set={set} /> : <AnswerPlaceholder type={field.type} />}</div>
      </div>

      <div className="flex items-center gap-1 border-t border-line px-3 py-2 sm:px-4">
        <IconButton label={`Move ${name} up`} onClick={() => update((c) => moveField(c, field.id, -1))} disabled={index === 0}>
          <ArrowUpIcon size={18} />
        </IconButton>
        <IconButton label={`Move ${name} down`} onClick={() => update((c) => moveField(c, field.id, 1))} disabled={index === total - 1}>
          <ArrowDownIcon size={18} />
        </IconButton>
        <span className="flex-1" />
        <IconButton label={`Duplicate ${name}`} onClick={() => update((c) => duplicateField(c, field.id))} disabled={total >= CONFIG_LIMITS.maxFields}>
          <CopyIcon size={20} />
        </IconButton>
        <IconButton label={`Delete ${name}`} onClick={() => update((c) => removeField(c, field.id))}>
          <TrashIcon size={20} />
        </IconButton>
        <span className="mx-2 h-8 w-px bg-line" aria-hidden="true" />
        <span className="mr-3 text-sm text-ink" aria-hidden="true">
          Required
        </span>
        <ToggleSwitch label={`Required: ${name}`} checked={field.required} onChange={(required) => set({ required })} />
      </div>
    </li>
  );
}

function AnswerPlaceholder({ type }: { type: FieldType }) {
  if (type === "date" || type === "time") {
    return (
      <div className="flex w-52 items-center justify-between border-b border-dotted border-gray-400 pb-1.5 text-sm text-gray-500">
        {type === "date" ? "Day, month, year" : "Time"}
        {type === "date" ? <CalendarIcon size={18} /> : <ClockIcon size={18} />}
      </div>
    );
  }
  return (
    <div className={cx("border-b border-dotted border-gray-400 pb-1.5 text-sm text-gray-500", type === "paragraph" ? "w-full sm:w-4/5" : "w-full sm:w-1/2")}>
      {type === "paragraph" ? "Long answer text" : "Short answer text"}
    </div>
  );
}

function OptionsEditor({ field, name, set }: { field: IdField; name: string; set: (patch: Partial<Omit<IdField, "id">>) => void }) {
  const marker = (i: number) =>
    field.type === "dropdown" ? (
      <span className="w-5 shrink-0 text-right text-sm text-gray-600">{i + 1}.</span>
    ) : (
      <span className={cx("h-[18px] w-[18px] shrink-0 border-2 border-gray-400", field.type === "checkbox" ? "rounded-[3px]" : "rounded-full")} aria-hidden="true" />
    );
  return (
    <ul className="space-y-0.5">
      {field.options.map((option, i) => (
        <li key={i} className="flex items-center gap-3">
          {marker(i)}
          <input
            aria-label={`${name} option ${i + 1}`}
            value={option}
            onChange={(e) => set({ options: field.options.map((o, j) => (j === i ? e.target.value : o)) })}
            maxLength={CONFIG_LIMITS.maxFieldOptionChars}
            className="min-w-0 flex-1 border-b border-transparent bg-transparent py-2 text-sm text-ink hover:border-gray-300 focus:border-b-2 focus:border-brand-600 focus:outline-none focus-visible:outline-none"
          />
          <button
            type="button"
            aria-label={`Remove ${name} option ${i + 1}`}
            onClick={() => set({ options: field.options.filter((_, j) => j !== i) })}
            disabled={field.options.length <= 1}
            className="rounded-full p-2 text-gray-600 hover:bg-gray-100 disabled:invisible"
          >
            <XIcon size={18} />
          </button>
        </li>
      ))}
      {field.options.length < CONFIG_LIMITS.maxFieldOptions && (
        <li className="flex items-center gap-3">
          {marker(field.options.length)}
          <button
            type="button"
            onClick={() => set({ options: [...field.options, `Option ${field.options.length + 1}`] })}
            className="py-2 text-sm text-gray-500 hover:border-b hover:border-gray-300"
          >
            Add option
          </button>
        </li>
      )}
    </ul>
  );
}
