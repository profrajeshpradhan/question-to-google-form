import type { Metadata } from "next";
import { FaqList } from "@/components/content/faq-list";
import { LegalPage, SupportContact } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Support" };

const TROUBLESHOOTING = [
  ["Validation errors", "Each problem shows the question number and line. Click the line number to jump to it in the editor, and use “View Format Example” to compare with the expected format."],
  ["“Marks must be a whole number”", "Google Forms quizzes accept only whole-number points (1, 2, 5…)."],
  ["“Your Google session has expired”", "Google access lasts about an hour. Click “Reconnect Google account”; your input in the tab is kept."],
  ["“Google Forms permission is required”", "On Google’s consent screen, keep the Google Drive files permission ticked."],
  ["Sign-in blocked at school", "Your Google Workspace administrator may need to allow this app."],
  ["The form was created but not finished", "Use “Finish this form” to complete it without creating a duplicate, or open it in Google Forms."],
  ["Students can’t open the respondent link", "Check that the form is published and review its response settings in Google Forms (for example, “Restrict to users in your organisation”)."],
] as const;

export default function SupportPage() {
  return (
    <LegalPage title="Support">
      <h2>Troubleshooting</h2>
      <ul>
        {TROUBLESHOOTING.map(([title, body]) => (
          <li key={title}>
            <strong>{title}</strong>: {body}
          </li>
        ))}
      </ul>
      <h2>Frequently asked questions</h2>
      <FaqList compact />
      <h2>Contact</h2>
      <p>
        Still stuck? Contact <SupportContact />. Please avoid sending question papers or answer keys unless they are needed to solve the problem.
      </p>
    </LegalPage>
  );
}
