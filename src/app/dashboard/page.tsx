import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { QuizWorkflowLoader } from "@/components/dashboard/quiz-workflow-loader";
import { getSessionState, toPublicSession } from "@/lib/auth/session";
import { isOAuthConfigured } from "@/lib/config";

export const metadata: Metadata = { title: "Create a quiz", robots: { index: false } };

export default async function DashboardPage() {
  // Always render per request: the page depends on the session cookie.
  await connection();
  if (!isOAuthConfigured()) redirect("/login?error=config_missing");
  const state = await getSessionState();
  if (state.status === "none") redirect("/login");
  if (state.status === "expired") redirect("/login?error=session_expired");

  const session = toPublicSession(state.session);
  return (
    <DashboardShell session={session}>
      <QuizWorkflowLoader session={session} />
    </DashboardShell>
  );
}
