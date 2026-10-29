"use client";

import { useId, type ReactNode } from "react";
import { CollapsibleCard, inputClass, StatusBadge, Switch } from "@/components/ui/controls";
import { Button, cx } from "@/components/ui/primitives";
import { defaultConfig, emailCollectionLabel, UNAVAILABLE_SETTINGS, type EmailCollection, type FormConfig } from "@/lib/quiz/form-config";
import { LIMITS } from "@/lib/quiz/limits";

type Update = (fn: (config: FormConfig) => FormConfig) => void;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-line pt-4 first:border-t-0 first:pt-0">
      <legend className="text-xs font-bold uppercase tracking-wide text-brand-700">{title}</legend>
      <div className="mt-3 space-y-4">{children}</div>
    </fieldset>
  );
}

const EMAIL_EFFECTS: Record<EmailCollection, string> = {
  verified: "Students must sign in to Google; their account email is recorded automatically and can't be faked.",
  responder_input: "Students type an email address. It is checked for format only, not ownership.",
  do_not_collect: "No email is recorded. Identify students only through your identification fields.",
};

export function QuizSettingsCard({ config, update }: { config: FormConfig; update: Update }) {
  const ids = { email: useId(), copy: useId(), points: useId(), release: useId() };
  const { quiz, responses, defaults } = config;
  const setQuiz = (patch: Partial<FormConfig["quiz"]>) => update((c) => ({ ...c, quiz: { ...c.quiz, ...patch } }));
  const setResponses = (patch: Partial<FormConfig["responses"]>) => update((c) => ({ ...c, responses: { ...c.responses, ...patch } }));
  const setDefaults = (patch: Partial<FormConfig["defaults"]>) => update((c) => ({ ...c, defaults: { ...c.defaults, ...patch } }));
  const manual = <StatusBadge status="manual" />;
  const auto = <StatusBadge status="auto" />;

  return (
    <CollapsibleCard
      step={3}
      title="Quiz Settings"
      summary={`${quiz.isQuiz ? "Quiz" : "Not a quiz"} · Emails: ${emailCollectionLabel(responses.emailCollection)} · ${responses.limitOneResponse ? "1 response" : "Multiple responses"}`}
      defaultOpen={false}
      testId="quiz-settings"
    >
      <p className="mb-4 rounded-xl bg-canvas p-3 text-xs leading-relaxed text-muted">
        Settings marked {auto} are set and verified by this app. The Google Forms API has no option for settings marked {manual} — they are
        added to a checklist with the exact place to change them after the form is created. These apply to this form only; your Google Forms
        global defaults are not changed.
      </p>

      <div className="space-y-5">
        <Group title="Quiz mode">
          <Switch
            checked={quiz.isQuiz}
            onChange={(isQuiz) => setQuiz({ isQuiz })}
            label="Make this a quiz"
            description={
              quiz.isQuiz
                ? "Assign point values, set answers and automatically grade the MCQs."
                : "Off: the form is a survey. Your ANSWER and MARKS lines will NOT be added, and no grading happens."
            }
            badge={auto}
          />
        </Group>

        {quiz.isQuiz && (
          <>
            <Group title="Release grades">
              <div role="radiogroup" aria-labelledby={ids.release} className="space-y-2">
                <p id={ids.release} className="sr-only">
                  Release grades
                </p>
                {(
                  [
                    ["immediately", "Immediately after each submission"],
                    ["later", "Later, after manual review", "Turns on email collection in Google Forms."],
                  ] as const
                ).map(([value, label, hint]) => (
                  <label key={value} className="flex items-start gap-2.5 text-sm">
                    <input
                      type="radio"
                      name="release-grades"
                      value={value}
                      checked={quiz.releaseGrades === value}
                      onChange={() => setQuiz({ releaseGrades: value })}
                      className="mt-0.5 h-4 w-4 accent-brand-600"
                    />
                    <span>
                      <span className="font-semibold text-ink">{label}</span>
                      {hint && <span className="block text-xs text-muted">{hint}</span>}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                {manual} Google Forms usually releases grades immediately unless you change it.
              </div>
            </Group>

            <Group title="Respondent settings">
              <Switch checked={quiz.showMissed} onChange={(showMissed) => setQuiz({ showMissed })} label="Missed questions" description="Students can see which questions they answered incorrectly." badge={manual} />
              <Switch checked={quiz.showCorrect} onChange={(showCorrect) => setQuiz({ showCorrect })} label="Correct answers" description="Students can see the correct answers after grades are released." badge={manual} />
              <Switch checked={quiz.showPoints} onChange={(showPoints) => setQuiz({ showPoints })} label="Point values" description="Students can see total points and the points for each question." badge={manual} />
            </Group>
          </>
        )}

        <Group title="Responses">
          <div>
            <label htmlFor={ids.email} className="text-sm font-semibold text-ink">
              Collect email addresses
            </label>
            <select
              id={ids.email}
              value={responses.emailCollection}
              onChange={(e) => setResponses({ emailCollection: e.target.value as EmailCollection })}
              className={cx(inputClass, "mt-1 h-10 text-sm")}
            >
              <option value="verified">Verified</option>
              <option value="responder_input">Responder input</option>
              <option value="do_not_collect">Do not collect</option>
            </select>
            <p className="mt-1 text-xs text-muted">{EMAIL_EFFECTS[responses.emailCollection]}</p>
            <div className="mt-1.5">{auto}</div>
          </div>
          <div>
            <label htmlFor={ids.copy} className="text-sm font-semibold text-ink">
              Send respondents a copy of their response
            </label>
            <select
              id={ids.copy}
              value={responses.sendCopy}
              onChange={(e) => setResponses({ sendCopy: e.target.value as FormConfig["responses"]["sendCopy"] })}
              className={cx(inputClass, "mt-1 h-10 text-sm")}
            >
              <option value="off">Off</option>
              <option value="requested">When requested</option>
              <option value="always">Always</option>
            </select>
            <div className="mt-1.5">{manual}</div>
          </div>
          <Switch
            checked={responses.allowEditing}
            onChange={(allowEditing) => setResponses({ allowEditing })}
            label="Allow response editing"
            description="Students can change their answers after submitting."
            badge={manual}
          />
          <Switch
            checked={responses.limitOneResponse}
            onChange={(limitOneResponse) => setResponses({ limitOneResponse })}
            label="Limit to 1 response"
            description="Students must sign in to Google, and each Google account can submit once."
            badge={manual}
          />
        </Group>

        <Group title="Question defaults">
          <Switch checked={defaults.required} onChange={(required) => setDefaults({ required })} label="Questions are required" description="Students must answer every MCQ before submitting." badge={auto} />
          <div>
            <label htmlFor={ids.points} className="text-sm font-semibold text-ink">
              Default points for new questions
            </label>
            <input
              id={ids.points}
              type="number"
              inputMode="numeric"
              min={1}
              max={LIMITS.maxMarksPerQuestion}
              value={defaults.defaultPoints}
              onChange={(e) => {
                const n = Math.trunc(Number(e.target.value));
                if (Number.isFinite(n)) setDefaults({ defaultPoints: Math.max(1, Math.min(LIMITS.maxMarksPerQuestion, n)) });
              }}
              className={cx(inputClass, "mt-1 h-10 w-28 text-sm")}
            />
            <p className="mt-1 text-xs text-muted">
              Used for the MARKS line of questions added with “Insert question template”. Every question still needs its own MARKS line, which always
              takes priority.
            </p>
          </div>
        </Group>

        <Group title="Not available through the Google Forms API">
          <ul className="space-y-1.5 text-sm">
            {UNAVAILABLE_SETTINGS.map((s) => (
              <li key={s.label} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-ink">{s.label}</span>
                <span className="text-xs text-muted">{s.where}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">Set these in Google Forms if you need them. Option order from your questions is always kept.</p>
        </Group>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => update((c) => ({ ...c, quiz: defaultConfig().quiz, responses: defaultConfig().responses, defaults: defaultConfig().defaults }))}
        >
          Reset settings to defaults
        </Button>
      </div>
    </CollapsibleCard>
  );
}
