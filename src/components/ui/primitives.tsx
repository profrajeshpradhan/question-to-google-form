import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { AlertIcon, CheckCircleIcon, InfoIcon, Spinner, XCircleIcon } from "./icons";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "google";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300 disabled:shadow-none",
  secondary:
    "bg-white text-brand-700 border border-brand-300 hover:bg-brand-50 hover:border-brand-400 disabled:text-brand-300 disabled:border-brand-200",
  ghost: "text-muted hover:text-brand-700 hover:bg-brand-50 disabled:text-gray-400",
  danger: "bg-danger-600 text-white hover:bg-danger-700 disabled:bg-red-300",
  google:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-400 [&_.g-badge]:bg-white",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2.5 rounded-xl",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center font-semibold whitespace-nowrap transition-colors select-none disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
    extra,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  loadingText?: string;
}

export function Button({ variant = "primary", size = "md", loading, loadingText, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? (
        <>
          <Spinner size={16} />
          <span>{loadingText ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function ButtonLink({ variant = "primary", size = "md", className, ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

export function Card({ className, children, ...rest }: ComponentProps<"div">) {
  return (
    <div className={cx("rounded-2xl border border-line bg-white shadow-card", className)} {...rest}>
      {children}
    </div>
  );
}

type Tone = "info" | "success" | "error" | "warning";
const toneStyles: Record<Tone, { box: string; icon: ReactNode }> = {
  info: { box: "bg-brand-50 border-brand-200 text-brand-900", icon: <InfoIcon className="text-brand-600" /> },
  success: { box: "bg-success-50 border-green-200 text-green-900", icon: <CheckCircleIcon className="text-success-600" /> },
  error: { box: "bg-danger-50 border-red-200 text-red-900", icon: <XCircleIcon className="text-danger-600" /> },
  warning: { box: "bg-amber-50 border-amber-200 text-amber-900", icon: <AlertIcon className="text-amber-600" /> },
};

export function Alert({ tone = "info", title, children, className, role, action }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string; role?: "alert" | "status"; action?: ReactNode }) {
  const style = toneStyles[tone];
  return (
    <div role={role} className={cx("flex gap-3 rounded-xl border p-4 text-sm", style.box, className)}>
      <span className="mt-0.5 shrink-0">{style.icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(Boolean(title) && "mt-1", "leading-relaxed")}>{children}</div>}
        {action && <div className="mt-3 flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}

export function Badge({ tone = "brand", children, className }: { tone?: "brand" | "success" | "error" | "neutral" | "warning"; children: ReactNode; className?: string }) {
  const tones = {
    brand: "bg-brand-50 text-brand-700 ring-brand-200",
    warning: "bg-amber-50 text-amber-800 ring-amber-200",
    success: "bg-success-50 text-success-700 ring-green-200",
    error: "bg-danger-50 text-danger-700 ring-red-200",
    neutral: "bg-gray-50 text-gray-700 ring-gray-200",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", tones[tone], className)}>{children}</span>;
}
