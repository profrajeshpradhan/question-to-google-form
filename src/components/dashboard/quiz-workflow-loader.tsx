"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/icons";
import { Card } from "@/components/ui/primitives";

/** Loads the workflow in the browser only: it restores the draft from this tab's sessionStorage. */
export const QuizWorkflowLoader = dynamic(() => import("./quiz-workflow").then((m) => m.QuizWorkflow), {
  ssr: false,
  loading: () => (
    <Card className="flex min-h-[24rem] items-center justify-center p-8">
      <span className="flex items-center gap-2 text-sm text-muted">
        <Spinner /> Loading editor…
      </span>
    </Card>
  ),
});
