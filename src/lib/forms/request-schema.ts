import { z } from "zod";
import { LIMITS } from "@/lib/quiz/limits";

/** Body for POST /api/forms and POST /api/forms/:formId/resume. The raw text is re-parsed on the server. */
export const createFormRequestSchema = z.object({
  title: z.string().max(LIMITS.maxTitleChars * 2).default(""),
  description: z.string().max(LIMITS.maxDescriptionChars * 2).default(""),
  input: z.string().min(1).max(LIMITS.maxInputChars),
  publish: z.boolean().default(true),
});

export type CreateFormRequest = z.infer<typeof createFormRequestSchema>;

/** Google form IDs are URL-safe base64-like strings. */
export const formIdSchema = z.string().regex(/^[A-Za-z0-9_-]{10,200}$/);

export const MAX_REQUEST_BYTES = LIMITS.maxInputChars * 4 + 64_000;
