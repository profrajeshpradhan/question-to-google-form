import { ChevronDownIcon } from "@/components/ui/icons";
import { FAQ } from "./help-content";

/** Accessible FAQ built on native <details>/<summary>. */
export function FaqList({ compact = false }: { compact?: boolean }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
      {FAQ.map((item) => (
        <details key={item.q} className="group">
          <summary
            className={`flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink hover:bg-brand-50/60 [&::-webkit-details-marker]:hidden ${compact ? "px-4 py-3 text-sm" : "px-5 py-4"}`}
          >
            {item.q}
            <ChevronDownIcon className="shrink-0 text-brand-600 transition-transform group-open:rotate-180" />
          </summary>
          <div className={`leading-relaxed text-muted ${compact ? "px-4 pb-4 text-sm" : "px-5 pb-5"}`}>{item.a}</div>
        </details>
      ))}
    </div>
  );
}
