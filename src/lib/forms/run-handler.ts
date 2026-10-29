import "server-only";
import type { NextRequest } from "next/server";
import { getRateLimits } from "@/lib/config";
import { legacyConfig, reconcileSections, validateFormConfig } from "@/lib/quiz/form-config";
import { parseQuiz } from "@/lib/quiz/parser";
import { apiError, requireSessionForMutation } from "@/lib/security/guard";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { createGoogleFormsApi } from "./google-forms-api";
import { createQuiz, resumeQuiz } from "./forms-service";
import type { CreateEvent } from "./events";
import { createFormRequestSchema, formIdSchema, MAX_REQUEST_BYTES } from "./request-schema";

/**
 * Shared handler for creating a form and for resuming a partially created one.
 * Responds with a stream of newline-delimited JSON {@link CreateEvent}s so the
 * browser can show real progress as each Google API call completes.
 */
export async function handleFormRun(request: NextRequest, formIdParam?: string): Promise<Response> {
  const guard = requireSessionForMutation(request);
  if ("response" in guard) return guard.response;
  const { session } = guard;

  const limits = getRateLimits();
  const perUser = rateLimit(`create:user:${session.sub}`, limits.createPerUser, limits.createWindowMs);
  const perIp = rateLimit(`create:ip:${clientIp(request.headers)}`, limits.createPerIp, limits.createWindowMs);
  if (!perUser.allowed || !perIp.allowed) {
    const retry = Math.max(perUser.retryAfterSeconds, perIp.retryAfterSeconds);
    return apiError("rate_limited", `Too many forms created recently. Please try again in about ${Math.ceil(retry / 60)} minute(s).`, 429, {
      retryAfterSeconds: retry,
    });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_REQUEST_BYTES) return apiError("payload_too_large", "The request is too large.", 413);

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return apiError("invalid_request", "Could not read the request.", 400);
  }
  if (raw.length > MAX_REQUEST_BYTES) return apiError("payload_too_large", "The request is too large.", 413);

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return apiError("invalid_request", "The request body must be JSON.", 400);
  }
  const body = createFormRequestSchema.safeParse(json);
  if (!body.success) return apiError("invalid_request", "The request is missing required fields.", 400);

  let formId: string | undefined;
  if (formIdParam !== undefined) {
    const parsedId = formIdSchema.safeParse(formIdParam);
    if (!parsedId.success) return apiError("invalid_request", "Invalid form ID.", 400);
    formId = parsedId.data;
  }

  // Validate everything again on the server before any Google API call.
  const parsed = parseQuiz({ input: body.data.input, title: body.data.title, description: body.data.description });
  if (!parsed.ok) {
    return apiError("validation_failed", "Some questions are invalid. Fix them and validate again.", 422, { issues: parsed.errors });
  }
  const config = body.data.config ?? reconcileSections(legacyConfig(), parsed.quiz.questions.map((q) => q.number));
  const configIssues = validateFormConfig(config, parsed.quiz).errors;
  if (configIssues.length > 0) {
    return apiError("validation_failed", "Some form settings are invalid. Fix them and validate again.", 422, { issues: configIssues });
  }

  const api = createGoogleFormsApi(session.accessToken);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: CreateEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // Client disconnected; Google operations continue to completion server-side.
        }
      };
      const options = { publish: body.data.publish };
      if (formId) await resumeQuiz(api, formId, parsed.quiz, config, options, emit);
      else await createQuiz(api, parsed.quiz, config, options, emit);
      try {
        controller.close();
      } catch {
        // already closed
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
