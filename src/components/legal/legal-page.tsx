import type { ReactNode } from "react";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";

export function LegalPage({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1 bg-canvas">
        <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{title}</h1>
          {updated && <p className="mt-2 text-sm text-muted">Last updated: {updated}</p>}
          <div className="mt-8 space-y-5 rounded-2xl border border-line bg-white p-6 text-[15px] leading-relaxed text-ink shadow-card sm:p-8 [&_a]:font-semibold [&_a]:text-brand-700 [&_a:hover]:underline [&_h2]:pt-3 [&_h2]:text-xl [&_h2]:font-bold [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-6">
            {children}
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

/** Support contact configured by the operator through the SUPPORT_EMAIL environment variable. */
export function SupportContact() {
  const email = process.env.SUPPORT_EMAIL?.trim();
  return email ? <a href={`mailto:${email}`}>{email}</a> : <>the operator of this website</>;
}
