import Link from "next/link";
import { cx } from "@/components/ui/primitives";

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="10" fill="#673AB7" />
      <path d="M13 9h10l6 6v14a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2Z" fill="#fff" />
      <path d="M23 9v6h6" fill="#D1C4E9" />
      <circle cx="15.5" cy="19.5" r="1.3" fill="#673AB7" />
      <circle cx="15.5" cy="24.5" r="1.3" fill="#673AB7" />
      <rect x="18.5" y="18.6" width="7" height="1.8" rx=".9" fill="#673AB7" />
      <rect x="18.5" y="23.6" width="7" height="1.8" rx=".9" fill="#673AB7" />
    </svg>
  );
}

export function Logo({ href = "/", inverted = false, className }: { href?: string; inverted?: boolean; className?: string }) {
  return (
    <Link href={href} className={cx("flex items-center gap-2.5 rounded-lg", className)} aria-label="Question to Google Form home">
      <LogoMark size={34} className={inverted ? "rounded-[10px] ring-2 ring-white/30" : undefined} />
      <span className={cx("text-[15px] font-bold tracking-tight sm:text-base", inverted ? "text-white" : "text-ink")}>
        Question to Google Form
      </span>
    </Link>
  );
}
