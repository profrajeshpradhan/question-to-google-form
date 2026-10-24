import type { Metadata } from "next";
import { LegalPage, SupportContact } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="23 October 2026">
      <p>
        Question to Google Form (“the app”) helps teachers turn multiple-choice questions into a Google Forms quiz in their own Google account. This
        policy explains what data the app handles and why. Version one of the app has no database.
      </p>

      <h2>Information the app accesses from Google</h2>
      <ul>
        <li>
          <strong>Basic profile</strong> (name, email address, profile picture): shown in the dashboard so you know which account is connected.
        </li>
        <li>
          <strong>Google Drive files you use with this app</strong> (the <code>drive.file</code> permission): used to create the quiz in Google Forms, add
          questions, answer keys and marks, read the form back to verify it, and publish it if you choose. This permission covers only files the app
          creates or that you open with it; it does not give access to your other Google Drive files.
        </li>
      </ul>
      <p>The app never asks for or receives your Google password. Sign-in happens on Google’s own pages.</p>

      <h2>How your data is handled</h2>
      <ul>
        <li>
          <strong>Questions and answer keys</strong> you paste are validated in your browser. When you confirm, they are sent to the app’s server only to
          create the form, processed in memory and not stored. They are not sent to analytics or error-monitoring services.
        </li>
        <li>
          <strong>Your Google access token</strong> is kept in an encrypted, HTTP-only session cookie that scripts in the page cannot read. The app does not
          request offline access, so no refresh token is issued or stored. The session ends when Google’s access token expires (about one hour) or when you
          sign out.
        </li>
        <li>
          <strong>Drafts</strong>: while you work, your title, description and questions are kept in your browser’s session storage for this tab, so a
          reload or reconnecting your account does not lose your work. They are removed when you create the form, sign out or close the tab.
        </li>
        <li>
          <strong>Logs</strong>: the hosting provider may record standard request logs (such as IP address, time and URL). The app’s own logs record only
          error codes, never question content, tokens or account details. IP addresses and account IDs are held briefly in memory for rate limiting.
        </li>
      </ul>

      <h2>What the app does not do</h2>
      <ul>
        <li>It does not keep a history of your questions, answer keys or forms.</li>
        <li>It does not sell or share your Google data, use it for advertising, or use it to train AI models.</li>
        <li>It does not use a service account: forms are created as you, in your account, and you own them.</li>
      </ul>

      <h2>Google API Services User Data Policy</h2>
      <p>
        The app’s use and transfer of information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Signing out revokes the app’s Google access token and clears your session cookie and draft.</li>
        <li>
          You can remove the app’s access at any time from your Google Account’s{" "}
          <a href="https://myaccount.google.com/connections" target="_blank" rel="noopener noreferrer">
            third-party connections
          </a>{" "}
          page.
        </li>
        <li>Forms the app created stay in your Google account until you delete them in Google Forms or Google Drive.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        Questions about this policy: <SupportContact />.
      </p>
    </LegalPage>
  );
}
