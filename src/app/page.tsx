import Link from "next/link";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { FaqList } from "@/components/content/faq-list";
import { HOW_IT_WORKS } from "@/components/content/help-content";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { WorkflowPreview } from "@/components/landing/workflow-preview";
import { CheckCircleIcon, ClipboardIcon, FormDocIcon, ListChecksIcon, NoHistoryIcon } from "@/components/ui/icons";
import { Badge, buttonClass } from "@/components/ui/primitives";

const FEATURES = [
  { title: "Paste questions in one textbox", body: "No clicking through Google Forms question by question. Paste the whole quiz at once.", icon: <ClipboardIcon size={22} /> },
  { title: "Automatically validate answers and marks", body: "Missing answers, mismatched options and invalid marks are flagged with the question and line number.", icon: <ListChecksIcon size={22} /> },
  { title: "Create a quiz in your Google account", body: "The quiz is created as you, in your own Google Forms, with answer keys and points already set.", icon: <FormDocIcon size={22} /> },
  { title: "No application question history", body: "Version one has no database. Your questions are used to create the form and are not stored by the app.", icon: <NoHistoryIcon size={22} /> },
];

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-gradient-to-b from-lavender to-white" aria-hidden="true" />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:pb-24">
            <div className="text-center lg:text-left">
              <Badge className="mb-5">For teachers · Multiple-choice quizzes</Badge>
              <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">
                Turn Your Questions into <span className="text-brand-600">Google Forms</span> in Seconds
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted lg:mx-0">
                Paste your multiple-choice questions, validate your answers, and create a quiz directly in your Google account.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <GoogleSignInButton />
                <Link href="#how-it-works" className={buttonClass("secondary", "lg")}>
                  See How It Works
                </Link>
              </div>
              <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted lg:justify-start">
                {["Free to use", "No question history stored", "Made for teachers"].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <CheckCircleIcon size={16} className="text-success-600" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <WorkflowPreview />
          </div>
        </section>

        {/* Features */}
        <section aria-labelledby="features-title" className="border-y border-line bg-canvas">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 id="features-title" className="sr-only">Features</h2>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <li key={f.title} className="rounded-2xl border border-line bg-white p-6 shadow-card">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{f.icon}</span>
                  <h3 className="mt-4 font-bold text-ink">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">How it works</p>
              <h2 id="how-title" className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Three steps from questions to quiz</h2>
            </div>
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {HOW_IT_WORKS.map((step, i) => (
                <li key={step.title} className="relative rounded-2xl border border-line bg-white p-6 shadow-card">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">{i + 1}</span>
                    <span className="text-brand-600">{step.icon}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Example */}
        <section aria-labelledby="example-title" className="bg-lavender">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Example</p>
              <h2 id="example-title" className="mt-2 text-3xl font-extrabold tracking-tight text-ink">A simple, readable format</h2>
              <p className="mt-4 leading-relaxed text-muted">
                Start each question with <code className="rounded bg-white px-1.5 py-0.5 font-mono text-sm text-brand-700">Q1:</code>, list options as
                <code className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-sm text-brand-700">A.</code>,
                <code className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-sm text-brand-700">B.</code> and so on, then add the correct
                <code className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-sm text-brand-700">ANSWER</code> and
                <code className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-sm text-brand-700">MARKS</code>. One correct answer per question.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <pre className="rounded-2xl border border-line bg-white p-5 font-mono text-[13px] leading-6 text-ink shadow-card">
{`Q1: Which language is used
for web page structure?
OPTIONS:
A. Python
B. HTML
C. SQL
D. C
ANSWER: B
MARKS: 1`}
              </pre>
              <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-ink">Which language is used for web page structure?</p>
                  <Badge>1 mark</Badge>
                </div>
                <ul className="mt-4 space-y-2 text-sm">
                  {["Python", "HTML", "SQL", "C"].map((o, i) => (
                    <li key={o} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${i === 1 ? "border-green-300 bg-success-50" : "border-line"}`}>
                      <span>{String.fromCharCode(65 + i)}. {o}</span>
                      {i === 1 && <Badge tone="success">Correct</Badge>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
            <h2 id="faq-title" className="text-center text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Frequently asked questions</h2>
            <div className="mt-10">
              <FaqList />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 rounded-3xl bg-brand-600 px-6 py-12 text-center text-white shadow-pop md:flex-row md:justify-between md:text-left">
            <div>
              <h2 className="text-2xl font-extrabold sm:text-3xl">Ready to build your next quiz?</h2>
              <p className="mt-2 text-brand-100">Sign in with Google and paste your questions.</p>
            </div>
            <Link href="/dashboard" className={buttonClass("secondary", "lg", "border-white text-brand-700")}>
              Get Started
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
