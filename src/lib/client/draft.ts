/**
 * The teacher's in-progress input is kept in this browser tab's sessionStorage
 * only (never sent anywhere except to create the form). It survives reloads and
 * the OAuth reconnect redirect, and is cleared on success, sign-out or tab close.
 */

export interface Draft {
  title: string;
  description: string;
  input: string;
  /** A form created by a run that did not finish, so the teacher can find it again. */
  pendingForm?: { formId: string; editUrl: string };
}

const KEY = "qgf:draft:v1";

export function loadDraft(): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Draft>;
    return {
      title: typeof parsed.title === "string" ? parsed.title : "",
      description: typeof parsed.description === "string" ? parsed.description : "",
      input: typeof parsed.input === "string" ? parsed.input : "",
      pendingForm:
        parsed.pendingForm && typeof parsed.pendingForm.formId === "string" && typeof parsed.pendingForm.editUrl === "string"
          ? parsed.pendingForm
          : undefined,
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Storage may be unavailable (private mode, quota); the app still works.
  }
}

export function clearDraft() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
