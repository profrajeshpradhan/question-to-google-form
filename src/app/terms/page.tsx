import type { Metadata } from "next";
import { LegalPage, SupportContact } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="23 October 2026">
      <p>By using Question to Google Form (“the app”) you agree to these terms.</p>

      <h2>The service</h2>
      <p>
        The app converts multiple-choice questions you provide into a Google Forms quiz created in your own Google account. It is provided free of charge,
        “as is”, without warranties of any kind, and may change or be unavailable at any time.
      </p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>You must have the right to use the questions you paste, and you are responsible for their content and for the forms created from them.</li>
        <li>
          Check the preview and the created form before sharing it with students. The app verifies the questions, answer keys and marks it sends, but you
          remain responsible for the accuracy of your quiz.
        </li>
        <li>Use of Google Forms is subject to Google’s own terms and your organisation’s policies.</li>
        <li>Do not misuse the app: no automated bulk use, attempts to bypass rate limits or security controls, or use that disrupts the service.</li>
      </ul>

      <h2>Limits</h2>
      <p>To keep the service reliable, the app limits input size, questions per form and how many forms can be created in a period of time.</p>

      <h2>Liability</h2>
      <p>To the extent permitted by law, the operator of the app is not liable for any loss arising from use of the app, including lost or incorrect forms or data.</p>

      <h2>Not affiliated with Google</h2>
      <p>
        The app is an independent tool that uses the Google Forms API. It is not affiliated with, sponsored or endorsed by Google. Google Forms is a trademark
        of Google LLC.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <SupportContact />.
      </p>
    </LegalPage>
  );
}
