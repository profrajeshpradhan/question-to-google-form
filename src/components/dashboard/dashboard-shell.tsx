"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogoMark } from "@/components/brand/logo";
import { FaqList } from "@/components/content/faq-list";
import { HOW_IT_WORKS } from "@/components/content/help-content";
import { ChevronDownIcon, EditIcon, HelpIcon, InfoIcon, LogOutIcon, Spinner } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Button, cx } from "@/components/ui/primitives";
import { clearDraft } from "@/lib/client/draft";
import type { PublicSession } from "@/lib/auth/public-session";

export function DashboardShell({ session, children }: { session: PublicSession; children: ReactNode }) {
  const [panel, setPanel] = useState<"how" | "faq" | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { "x-csrf-token": session.csrfToken }, credentials: "same-origin" });
    } catch {
      // Even if the network fails, clear local state; the cookie expires on its own.
    }
    clearDraft();
    router.replace("/login?error=signed_out");
    router.refresh();
  }

  const nav = [
    { id: "create", label: "Create Form", icon: <EditIcon size={18} />, active: true, onClick: () => document.getElementById("main")?.focus() },
    { id: "how", label: "How It Works", icon: <InfoIcon size={18} />, onClick: () => setPanel("how") },
    { id: "faq", label: "FAQ", icon: <HelpIcon size={18} />, onClick: () => setPanel("faq") },
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col bg-forms-bg">
      <header className="sticky top-0 z-30 bg-brand-600 text-white shadow-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <a href="/dashboard" className="flex min-w-0 items-center gap-2.5 rounded-lg" aria-label="Question to Google Form dashboard">
            <LogoMark size={32} className="rounded-[10px] ring-2 ring-white/30" />
            <span className="truncate text-sm font-bold tracking-tight sm:text-base">Question to Google Form</span>
          </a>
          <AccountMenu session={session} onSignOut={signOut} signingOut={signingOut} />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:py-8">
        <nav aria-label="Dashboard" className="shrink-0 lg:w-56">
          <ul className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-white p-1.5 shadow-card sm:grid-cols-4 lg:sticky lg:top-24 lg:flex lg:flex-col lg:p-2">
            {nav.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={item.onClick}
                  aria-current={item.active ? "page" : undefined}
                  className={cx(
                    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                    item.active ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-brand-50/60 hover:text-brand-700",
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              </li>
            ))}
            <li className="lg:mt-2 lg:border-t lg:border-line lg:pt-2">
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted hover:bg-danger-50 hover:text-danger-700"
              >
                {signingOut ? <Spinner size={18} /> : <LogOutIcon size={18} />}
                Sign Out
              </button>
            </li>
          </ul>
        </nav>

        <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          {children}
        </main>
      </div>

      <Modal open={panel === "how"} onClose={() => setPanel(null)} title="How it works" size="lg" footer={<Button onClick={() => setPanel(null)}>Close</Button>}>
        <ol className="space-y-4">
          {HOW_IT_WORKS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{i + 1}</span>
              <div>
                <p className="font-semibold text-ink">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Modal>
      <Modal open={panel === "faq"} onClose={() => setPanel(null)} title="Frequently asked questions" size="lg" footer={<Button onClick={() => setPanel(null)}>Close</Button>}>
        <FaqList compact />
      </Modal>
    </div>
  );
}

function AccountMenu({ session, onSignOut, signingOut }: { session: PublicSession; onSignOut: () => void; signingOut: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { user } = session;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const expires = new Date(session.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-white/10"
        data-testid="account-menu"
      >
        <Avatar name={user.name} picture={user.picture} />
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-[14rem] truncate text-sm font-semibold leading-tight">{user.name}</span>
          <span className="block max-w-[14rem] truncate text-xs leading-tight text-brand-100">{user.email}</span>
        </span>
        <ChevronDownIcon size={16} className={cx("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-72 overflow-hidden rounded-2xl border border-line bg-white text-ink shadow-pop">
          <div className="border-b border-line p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Connected Google account</p>
            <p className="mt-1 truncate font-semibold">{user.name}</p>
            <p className="truncate text-sm text-muted">{user.email}</p>
            <p className="mt-2 text-xs text-muted">Google access expires around {expires}. You’ll be asked to reconnect after that.</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={onSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-danger-700 hover:bg-danger-50"
          >
            {signingOut ? <Spinner size={16} /> : <LogOutIcon size={16} />} Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Avatar({ name, picture }: { name: string; picture?: string }) {
  const [failed, setFailed] = useState(false);
  if (picture && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- small Google profile image; next/image adds no value here
      <img src={picture} alt="" width={36} height={36} referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-9 w-9 rounded-full ring-2 ring-white/40" />
    );
  }
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-bold ring-2 ring-white/40" aria-hidden="true">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
