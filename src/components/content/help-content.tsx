import type { ReactNode } from "react";
import { ClipboardIcon, ListChecksIcon, ShareIcon } from "@/components/ui/icons";

export const HOW_IT_WORKS: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: "Paste your questions",
    body: "Enter a form title, then paste your multiple-choice questions with options, the correct answer and marks for each.",
    icon: <ClipboardIcon size={22} />,
  },
  {
    title: "Validate and preview your quiz",
    body: "Every question is checked. Fix any problem using the question and line number shown, then review the full quiz with answers and marks.",
    icon: <ListChecksIcon size={22} />,
  },
  {
    title: "Create and share your Google Form",
    body: "Confirm, and the quiz is created in your own Google account. Open it to edit, or copy the respondent link to share with students.",
    icon: <ShareIcon size={22} />,
  },
];

export const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "Do I need a Google account?",
    a: "Yes. You sign in with a personal Google account or a school Google Workspace account. Some schools restrict third-party apps; if sign-in is blocked, ask your Google Workspace administrator.",
  },
  {
    q: "Will the form be created in my own account?",
    a: "Yes. The quiz is created with your permission, as you, and appears in your own Google Forms and Google Drive. You own it and can edit, share or delete it like any other form.",
  },
  {
    q: "Can I assign marks?",
    a: "Yes. Each question has its own marks, and the preview shows the total before anything is created. Google Forms quizzes use whole-number points, so marks must be whole numbers such as 1, 2 or 5.",
  },
  {
    q: "Does the app save my questions?",
    a: "No. This version has no database and keeps no question, answer-key or form history. Your questions are sent to our server only to create the form, then discarded. While you work, a draft is kept in this browser tab so a page reload or reconnecting your account doesn't lose your input; it is removed when you create the form, sign out, or close the tab.",
  },
  {
    q: "Why does Google ask for permissions?",
    a: "Google asks for your name and email address so the app can show which account is connected, and for access to the Google Drive files you use with this app, which is needed to create the form and add your questions. This permission only covers forms this app creates, not your other files.",
  },
  {
    q: "What happens if form creation fails?",
    a: "If it fails before the form exists, nothing is created and you can try again. If the form was created but a later step failed, you'll see a link to that form and a “Finish this form” option that completes the same form instead of creating a duplicate.",
  },
];
