"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { MenuIcon, XIcon } from "@/components/ui/icons";
import { buttonClass } from "@/components/ui/primitives";

const NAV = [
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-brand-50 hover:text-brand-700">
              {item.label}
            </Link>
          ))}
          <Link href="/dashboard" className={buttonClass("primary", "sm", "ml-3 px-4")}>
            Get Started
          </Link>
        </nav>
        <button
          type="button"
          className="rounded-lg p-2 text-ink hover:bg-brand-50 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <XIcon /> : <MenuIcon />}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line bg-white px-4 pb-4 pt-2 md:hidden">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 font-medium text-ink hover:bg-brand-50">
              {item.label}
            </Link>
          ))}
          <Link href="/dashboard" onClick={() => setOpen(false)} className={buttonClass("primary", "md", "mt-2 w-full")}>
            Get Started
          </Link>
        </nav>
      )}
    </header>
  );
}
