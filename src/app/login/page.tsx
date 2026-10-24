import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { LogoMark } from "@/components/brand/logo";
import { FormDocIcon, ShieldIcon, UserIcon } from "@/components/ui/icons";
import { Alert, Card } from "@/components/ui/primitives";
import { getSessionState } from "@/lib/auth/session";
import { isOAuthConfigured } from "@/lib/config";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, { tone: "error" | "warning" | "success" | "info"; title: string; body: string }> = {
  access_denied: {
    tone: "warning",
    title: "Sign-in was cancelled",
    body: "Google sign-in was cancelled or permission was not granted. Nothing was created. You can try again whenever you're ready.",
  },
  scope_denied: {
    tone: "warning",
    title: "Google Forms permission is required",
    body: "The app can't create quizzes without access to the Google Drive files it creates. Sign in again and keep the Google Drive files permission ticked on Google's consent screen.",
  },
  session_expired: {
    tone: "info",
    title: "Your session has expired",
    body: "For your security, Google access lasts about an hour. Sign in again to continue — your draft in this tab is kept.",
  },
  state_mismatch: {
    tone: "error",
    title: "Sign-in could not be verified",
    body: "The sign-in response didn't match this browser session (it may have been opened in another tab). Please try again.",
  },
  state_expired: {
    tone: "error",
    title: "Sign-in timed out",
    body: "The sign-in attempt expired or cookies are blocked for this site. Please allow cookies and try again.",
  },
  oauth_error: {
    tone: "error",
    title: "Google sign-in couldn't be completed",
    body: "Something went wrong while talking to Google. Please try again in a moment.",
  },
  rate_limited: {
    tone: "warning",
    title: "Too many sign-in attempts",
    body: "Please wait a few minutes before trying again.",
  },
  config_missing: {
    tone: "error",
    title: "Sign-in is not configured yet",
    body: "This server has no Google OAuth credentials. The site administrator needs to set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_BASE_URL and SESSION_SECRET (see README).",
  },
  signed_out: {
    tone: "success",
    title: "You've been signed out",
    body: "Your Google access for this app was revoked and the draft in this tab was cleared.",
  },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const configured = isOAuthConfigured();
  if (configured) {
    const state = await getSessionState();
    if (state.status === "active") redirect("/dashboard");
  }
  const { error } = await searchParams;
  const code = typeof error === "string" ? error : undefined;
  const message = code ? ERRORS[code] : !configured ? ERRORS.config_missing : undefined;

  return (
    <main id="main" className="flex flex-1 items-center justify-center bg-gradient-to-b from-lavender to-white px-4 py-12">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <LogoMark size={52} />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">Sign in to Question to Google Form</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Connect your Google account to turn your multiple-choice questions into a Google Forms quiz in your own account.
          </p>
        </div>

        {message && (
          <Alert tone={message.tone} title={message.title} role={message.tone === "error" ? "alert" : "status"} className="mt-6">
            {message.body}
          </Alert>
        )}

        <div className="mt-6">
          <GoogleSignInButton fullWidth label={code && code !== "signed_out" ? "Try again with Google" : "Sign in with Google"} />
        </div>

        <div className="mt-6 rounded-xl border border-line bg-canvas p-4">
          <p className="text-sm font-semibold text-ink">Google will ask you to allow:</p>
          <ul className="mt-3 space-y-3 text-sm text-muted">
            <li className="flex gap-3">
              <UserIcon size={18} className="mt-0.5 shrink-0 text-brand-600" />
              <span><strong className="font-semibold text-ink">Your name, email and profile picture</strong> — to show which account is connected.</span>
            </li>
            <li className="flex gap-3">
              <FormDocIcon size={18} className="mt-0.5 shrink-0 text-brand-600" />
              <span>
                <strong className="font-semibold text-ink">Only the Google Drive files you use with this app</strong> — required to create your quiz in Google Forms and add
                questions, answer keys and marks. It does not give access to your other files.
              </span>
            </li>
            <li className="flex gap-3">
              <ShieldIcon size={18} className="mt-0.5 shrink-0 text-brand-600" />
              <span>The app never sees your Google password. Sign-in happens on Google’s own page.</span>
            </li>
          </ul>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link href="/" className="font-medium text-muted hover:text-brand-700">
            ← Cancel
          </Link>
          <span className="text-muted">
            <Link href="/privacy" className="hover:text-brand-700 hover:underline">Privacy</Link>
            <span aria-hidden="true"> · </span>
            <Link href="/terms" className="hover:text-brand-700 hover:underline">Terms</Link>
          </span>
        </div>
      </Card>
    </main>
  );
}
