"use client";

import { useId, useState } from "react";
import { CollapsibleCard, IconButton, inputClass, StatusBadge, Switch } from "@/components/ui/controls";
import { ArrowDownIcon, ArrowUpIcon, CopyIcon, EyeIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { Badge, Button, cx } from "@/components/ui/primitives";
import {
  addField,
  blankField,
  CONFIG_LIMITS,
  duplicateField,
  FIELD_PRESETS,
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  fieldValidationSummary,
  moveField,
  newId,
  removeField,
  updateField,
  type FieldType,
  type FieldValidation,
  type FormConfig,
  type IdField,
} from "@/lib/quiz/form-config";

type Update = (fn: (config: FormConfig) => FormConfig) => void;

const TYPE_HINTS: Record<FieldType, string> = {
  short: "Free text. Best for names, enrollment, roll and mobile numbers (keeps leading zeros and +country codes).",
  number: "Created as a short answer. Google Forms' “Is number” validation must be turned on manually — the API can't set it.",
  email: "Created as a short answer. Email validation must be turned on manually. To collect verified emails, use “Collect email addresses” in Quiz Settings instead.",
  dropdown: "Students pick one option from a list, e.g. a batch or division.",
  choice: "Students pick one option shown as radio buttons.",
};

export function IdentificationCard({ config, update }: { config: FormConfig; update: Update }) {
  const count = config.fields.length;
  const usedPresets = new Set(config.fields.map((f) => f.label.trim().toLowerCase()));
  const atLimit = count >= CONFIG_LIMITS.maxFields;

  return (
    <CollapsibleCard
      step={2}
      title="Student Identification"
      summary={count ? `${count} ${count === 1 ? "field" : "fields"} before the questions` : "Optional — off"}
      defaultOpen={count > 0}
      testId="identification-card"
    >
      <p className="text-sm text-muted">
        Ask for details such as Enrollment No. or Name in a <strong className="text-ink">Student Details</strong> section before the questions. A
        required field doesn&apos;t prove who a student is — use <em>Collect email addresses → Verified</em> for that.
      </p>

      {config.fields.length > 0 && (
        <ol className="mt-4 space-y-3" aria-label="Identification fields">
          {config.fields.map((field, index) => (
            <FieldEditor
              key={field.id}
              field={field}
              index={index}
              total={config.fields.length}
              update={update}
            />
          ))}
        </ol>
      )}

      <div className="mt-4 space-y-3">
        <Button variant="secondary" onClick={() => update((c) => addField(c, blankField()))} disabled={atLimit}>
          <PlusIcon size={16} /> Add Identification Field
        </Button>
        <div>
          <p className="text-xs font-semibold text-muted">Quick add</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {FIELD_PRESETS.filter((p) => !usedPresets.has(p.field.label.toLowerCase())).map((preset) => (
              <button
                key={preset.name}
                type="button"
                disabled={atLimit}
                onClick={() => update((c) => addField(c, { ...structuredClone(preset.field), id: newId() }))}
                className="rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-40"
              >
                + {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </CollapsibleCard>
  );
}

function FieldEditor({ field, index, total, update }: { field: IdField; index: number; total: number; update: Update }) {
  const ids = { label: useId(), desc: useId(), type: useId(), options: useId(), rule: useId(), min: useId(), max: useId(), pattern: useId() };
  const [showPreview, setShowPreview] = useState(false);
  const [optionsText, setOptionsText] = useState(field.options.join("\n"));
  const set = (patch: Partial<Omit<IdField, "id">>) => update((c) => updateField(c, field.id, patch));
  const setRule = (validation: FieldValidation) => set({ validation });
  const name = field.label.trim() || `Field ${index + 1}`;
  const manual = fieldValidationSummary(field);
  const hasOptions = field.type === "dropdown" || field.type === "choice";
  const optionsShown = hasOptions && optionsText.trim() ? optionsText : field.options.join("\n");

  return (
    <li className="rounded-2xl border border-line bg-canvas p-4" data-testid="id-field">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-ink">
          {index + 1}. {name} {field.required && <span className="text-danger-600" aria-label="required">*</span>}
        </p>
        <div className="flex gap-1.5">
          <IconButton label={`Preview ${name}`} onClick={() => setShowPreview((v) => !v)}>
            <EyeIcon size={15} />
          </IconButton>
          <IconButton label={`Move ${name} up`} onClick={() => update((c) => moveField(c, field.id, -1))} disabled={index === 0}>
            <ArrowUpIcon size={15} />
          </IconButton>
          <IconButton label={`Move ${name} down`} onClick={() => update((c) => moveField(c, field.id, 1))} disabled={index === total - 1}>
            <ArrowDownIcon size={15} />
          </IconButton>
          <IconButton label={`Duplicate ${name}`} onClick={() => update((c) => duplicateField(c, field.id))} disabled={total >= CONFIG_LIMITS.maxFields}>
            <CopyIcon size={15} />
          </IconButton>
          <IconButton label={`Delete ${name}`} onClick={() => update((c) => removeField(c, field.id))} danger>
            <TrashIcon size={15} />
          </IconButton>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={ids.label} className="block text-xs font-semibold text-ink">
            Field label
          </label>
          <input
            id={ids.label}
            value={field.label}
            onChange={(e) => set({ label: e.target.value })}
            maxLength={CONFIG_LIMITS.maxLabelChars}
            placeholder="e.g. Enrollment No."
            className={cx(inputClass, "mt-1 h-10 text-sm")}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={ids.desc} className="block text-xs font-semibold text-ink">
            Instruction <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id={ids.desc}
            value={field.description}
            onChange={(e) => set({ description: e.target.value })}
            maxLength={CONFIG_LIMITS.maxFieldDescriptionChars}
            placeholder="e.g. As printed on your ID card"
            className={cx(inputClass, "mt-1 h-10 text-sm")}
          />
        </div>
        <div>
          <label htmlFor={ids.type} className="block text-xs font-semibold text-ink">
            Field type
          </label>
          <select
            id={ids.type}
            value={field.type}
            onChange={(e) => {
              const type = e.target.value as FieldType;
              set({ type });
              setOptionsText("");
            }}
            className={cx(inputClass, "mt-1 h-10 text-sm")}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {FIELD_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end pb-1">
          <div className="w-full">
            <Switch checked={field.required} onChange={(required) => set({ required })} label="Required" />
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">{TYPE_HINTS[field.type]}</p>

      {hasOptions && (
        <div className="mt-3">
          <label htmlFor={ids.options} className="block text-xs font-semibold text-ink">
            Options <span className="font-normal text-muted">(one per line)</span>
          </label>
          <textarea
            id={ids.options}
            value={optionsShown}
            rows={Math.min(6, Math.max(2, field.options.length + 1))}
            onChange={(e) => {
              setOptionsText(e.target.value);
              set({ options: e.target.value.split("\n") });
            }}
            onBlur={() => {
              const clean = field.options.map((o) => o.trim()).filter(Boolean);
              setOptionsText(clean.join("\n"));
              set({ options: clean });
            }}
            className={cx(inputClass, "mt-1 resize-y py-2 text-sm")}
          />
        </div>
      )}

      {field.type === "short" && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label htmlFor={ids.rule} className="block text-xs font-semibold text-ink">
              Validation
            </label>
            <select
              id={ids.rule}
              value={field.validation.kind}
              onChange={(e) => {
                const kind = e.target.value as FieldValidation["kind"];
                setRule(kind === "length" ? { kind, min: null, max: null } : kind === "pattern" ? { kind, pattern: "" } : { kind });
              }}
              className={cx(inputClass, "mt-1 h-10 text-sm")}
            >
              <option value="none">No validation</option>
              <option value="length">Length</option>
              <option value="pattern">Pattern (regular expression)</option>
            </select>
          </div>
          {field.validation.kind === "length" && (
            <>
              <NumberInput id={ids.min} label="Min characters" value={field.validation.min} onChange={(min) => field.validation.kind === "length" && setRule({ ...field.validation, min })} />
              <NumberInput id={ids.max} label="Max characters" value={field.validation.max} onChange={(max) => field.validation.kind === "length" && setRule({ ...field.validation, max })} />
            </>
          )}
          {field.validation.kind === "pattern" && (
            <div className="col-span-2">
              <label htmlFor={ids.pattern} className="block text-xs font-semibold text-ink">
                Pattern
              </label>
              <input
                id={ids.pattern}
                value={field.validation.pattern}
                onChange={(e) => setRule({ kind: "pattern", pattern: e.target.value })}
                maxLength={CONFIG_LIMITS.maxPatternChars}
                placeholder="e.g. ^[0-9]{10}$"
                spellCheck={false}
                className={cx(inputClass, "mt-1 h-10 font-mono text-sm")}
              />
            </div>
          )}
        </div>
      )}

      {manual && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <StatusBadge status="manual" />
          <span>The Forms API can&apos;t set response validation. It will be on your checklist: {manual}.</span>
        </div>
      )}

      {showPreview && <FieldPreview field={field} />}
    </li>
  );
}

function NumberInput({ id, label, value, onChange }: { id: string; label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={CONFIG_LIMITS.maxLengthValue}
        value={value ?? ""}
        onChange={(e) => {
          const n = e.target.value === "" ? null : Math.max(0, Math.min(CONFIG_LIMITS.maxLengthValue, Math.trunc(Number(e.target.value))));
          onChange(Number.isFinite(n) ? n : null);
        }}
        className={cx(inputClass, "mt-1 h-10 text-sm")}
      />
    </div>
  );
}

/** How the field will look to students in Google Forms. */
export function FieldPreview({ field }: { field: IdField }) {
  return (
    <div className="mt-3 rounded-xl border border-line bg-white p-4" aria-label={`Preview of ${field.label || "field"}`}>
      <p className="break-words text-sm font-semibold text-ink">
        {field.label.trim() || "Untitled field"} {field.required && <span className="text-danger-600" aria-label="required">*</span>}
      </p>
      {field.description.trim() && <p className="mt-0.5 break-words text-xs text-muted">{field.description.trim()}</p>}
      {field.type === "dropdown" ? (
        <div className="mt-2 inline-flex h-9 items-center rounded-md border border-line px-3 text-sm text-muted">Choose ▾</div>
      ) : field.type === "choice" ? (
        <ul className="mt-2 space-y-1">
          {field.options.filter((o) => o.trim()).map((o, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="h-4 w-4 rounded-full border-2 border-gray-300" aria-hidden="true" /> {o.trim()}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-2 border-b border-dashed border-gray-300 pb-1 text-sm text-gray-400">Short answer text</div>
      )}
      <Badge tone="neutral" className="mt-2">
        {FIELD_TYPE_LABELS[field.type]}
        {field.type === "number" || field.type === "email" ? " (as short answer)" : ""}
      </Badge>
    </div>
  );
}
