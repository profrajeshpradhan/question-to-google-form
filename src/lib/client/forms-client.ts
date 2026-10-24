import type { CreateEvent } from "@/lib/forms/events";
import type { ValidationIssue } from "@/lib/quiz/types";

export interface RunRequest {
  title: string;
  description: string;
  input: string;
  publish: boolean;
}

export type RunOutcome =
  | { kind: "completed" }
  | { kind: "http-error"; status: number; code: string; message: string; issues?: ValidationIssue[] }
  | { kind: "network-error" };

/**
 * Calls POST /api/forms (or /api/forms/:id/resume) and forwards each streamed
 * progress event as soon as it arrives.
 */
export async function runFormRequest(
  { request, csrfToken, resumeFormId, onEvent, signal }: { request: RunRequest; csrfToken: string; resumeFormId?: string; onEvent: (event: CreateEvent) => void; signal?: AbortSignal },
): Promise<RunOutcome> {
  const url = resumeFormId ? `/api/forms/${encodeURIComponent(resumeFormId)}/resume` : "/api/forms";
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify(request),
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
  } catch {
    return { kind: "network-error" };
  }

  if (!response.ok || !response.body) {
    let body: { error?: { code?: string; message?: string; issues?: ValidationIssue[] } } = {};
    try {
      body = await response.json();
    } catch {
      // non-JSON error
    }
    return {
      kind: "http-error",
      status: response.status,
      code: body.error?.code ?? "unknown",
      message: body.error?.message ?? "The server could not process the request.",
      issues: body.error?.issues,
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawTerminal = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) {
          const event = JSON.parse(line) as CreateEvent;
          if (event.type === "result" || event.type === "error") sawTerminal = true;
          onEvent(event);
        }
        newline = buffer.indexOf("\n");
      }
    }
  } catch {
    return { kind: "network-error" };
  }
  // The stream ended without a final result: the connection dropped mid-way.
  return sawTerminal ? { kind: "completed" } : { kind: "network-error" };
}
