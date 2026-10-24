import type { NextRequest } from "next/server";
import { handleFormRun } from "@/lib/forms/run-handler";

export const maxDuration = 60;

/** POST /api/forms/:formId/resume — finishes a partially created form without creating a duplicate. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ formId: string }> }) {
  const { formId } = await ctx.params;
  return handleFormRun(request, formId);
}
