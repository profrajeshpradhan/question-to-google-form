import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { WifiOffIcon } from "@/components/ui/icons";
import { buttonClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "You’re offline" };

export default function OfflinePage() {
  return (
    <main id="main" className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-lavender to-white px-4 py-16 text-center">
      <LogoMark size={52} />
      <span className="mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-white text-brand-600 shadow-card">
        <WifiOffIcon size={28} />
      </span>
      <h1 className="mt-4 text-2xl font-extrabold text-ink">You’re offline</h1>
      <p className="mt-2 max-w-md text-muted">
        Question to Google Form needs an internet connection to sign in with Google and create forms. Check your connection and try again.
      </p>
      <Link href="/" className={buttonClass("primary", "lg", "mt-6")}>
        Try again
      </Link>
    </main>
  );
}
