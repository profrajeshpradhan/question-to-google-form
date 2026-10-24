import { ArrowRightIcon, CheckCircleIcon, CheckIcon } from "@/components/ui/icons";

/** Illustrative hero visual: pasted text → validated → Google Forms quiz. */
export function WorkflowPreview() {
  return (
    <figure className="relative mx-auto w-full max-w-xl" aria-label="Example: pasted questions become a Google Forms quiz">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-100 via-lavender to-white blur-2xl" aria-hidden="true" />
      <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
        {/* Pasted text */}
        <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
          <div className="mb-3 flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
            <span className="ml-2 text-[11px] font-medium text-muted">Your questions</span>
          </div>
          <pre className="overflow-hidden font-mono text-[11px] leading-5 text-ink">
{`Q1: What does CPU stand for?
OPTIONS:
A. Central Processing Unit
B. Computer Personal Unit
C. Central Program Utility
D. Control Processing User
`}<span className="text-success-700">ANSWER: A</span>{`
`}<span className="text-brand-700">MARKS: 2</span>
          </pre>
        </div>

        <div className="flex justify-center" aria-hidden="true">
          <span className="flex h-10 w-10 rotate-90 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg sm:rotate-0">
            <ArrowRightIcon size={18} />
          </span>
        </div>

        {/* Resulting Google Form */}
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <div className="h-2 bg-brand-600" />
          <div className="p-4">
            <p className="text-sm font-bold text-ink">Introduction to IT Systems</p>
            <p className="text-[11px] text-muted">Quiz · 2 points</p>
            <div className="mt-3 rounded-xl border border-line p-3">
              <p className="text-[12px] font-semibold text-ink">
                What does CPU stand for? <span className="text-danger-600">*</span>
              </p>
              <ul className="mt-2 space-y-1.5 text-[11px] text-ink">
                {["Central Processing Unit", "Computer Personal Unit", "Central Program Utility"].map((option, i) => (
                  <li key={option} className={`flex items-center gap-2 rounded-md px-1.5 py-1 ${i === 0 ? "bg-success-50 ring-1 ring-green-200" : ""}`}>
                    {i === 0 ? (
                      <CheckIcon size={12} className="text-success-600" />
                    ) : (
                      <span className="h-3 w-3 rounded-full border border-gray-400" />
                    )}
                    {String.fromCharCode(65 + i)}. {option}
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-success-700">
              <CheckCircleIcon size={14} /> Answer key & marks set
            </p>
          </div>
        </div>
      </div>
      <figcaption className="sr-only">Illustration of the conversion workflow.</figcaption>
    </figure>
  );
}
