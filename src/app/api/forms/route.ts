import type { NextRequest } from "next/server";
import { handleFormRun } from "@/lib/forms/run-handler";

export const maxDuration = 60;

/** POST /api/forms — creates a Google Forms quiz in the signed-in teacher's account. */
export function POST(request: NextRequest) {
  return handleFormRun(request);
}
