"use client";

import { useEffect, useState } from "react";
import { GoogleGIcon, Spinner } from "@/components/ui/icons";
import { buttonClass, cx } from "@/components/ui/primitives";

/**
 * Starts the real server-side OAuth flow (GET /api/auth/google). It is a plain
 * link so it works without JavaScript; JS only adds the loading state.
 */
export function GoogleSignInButton({ label = "Sign in with Google", size = "lg", className, fullWidth }: { label?: string; size?: "md" | "lg"; className?: string; fullWidth?: boolean }) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Reset when the user comes back with the browser's Back button (bfcache).
    const reset = () => setLoading(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  return (
    <a
      href="/api/auth/google"
      onClick={(event) => {
        if (loading) event.preventDefault();
        else setLoading(true);
      }}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      className={cx(buttonClass("google", size, "pl-1.5"), fullWidth && "w-full", loading && "pointer-events-none opacity-90", className)}
      data-testid="google-sign-in"
    >
      <span className="g-badge flex h-9 w-9 items-center justify-center rounded-lg bg-white">
        {loading ? <Spinner size={18} className="text-brand-600" /> : <GoogleGIcon size={20} />}
      </span>
      <span className="pr-2">{loading ? "Redirecting to Google…" : label}</span>
    </a>
  );
}
