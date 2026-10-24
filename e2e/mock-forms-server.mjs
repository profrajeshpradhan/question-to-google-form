// Local stand-in for the Google Forms REST API, used ONLY by the Playwright tests.
// It implements the four endpoints the app calls and applies batchUpdate requests
// the way Google does, so the app's real verification logic runs against it.
//
// Failure modes are triggered by markers in the form title:
//   [fail-create-disabled]  forms.create -> 403 SERVICE_DISABLED (no form exists)
//   [fail-questions]        first question batchUpdate -> 503 (partial failure; resume succeeds)
//   [fail-auth]             forms.create -> 401
import http from "node:http";

const PORT = Number(process.env.MOCK_FORMS_PORT ?? 4010);
const forms = new Map();
let stats = { creates: 0, batchUpdates: 0, gets: 0, publishes: 0 };
let counter = 0;

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}
const googleError = (code, status, message, reason) => ({
  error: { code, status, message, details: reason ? [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason }] : [] },
});

function publicView(form) {
  const copy = { ...form };
  delete copy._failQuestions;
  return copy;
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;

  if (path === "/__stats") return send(res, 200, stats);
  if (path === "/__reset") {
    forms.clear();
    stats = { creates: 0, batchUpdates: 0, gets: 0, publishes: 0 };
    return send(res, 200, { ok: true });
  }

  if (!/^Bearer \S+/.test(req.headers.authorization ?? "")) {
    return send(res, 401, googleError(401, "UNAUTHENTICATED", "Request is missing required authentication credential."));
  }

  try {
    if (req.method === "POST" && path === "/v1/forms") {
      const body = await readJson(req);
      const title = body.info?.title ?? "";
      if (title.includes("[fail-create-disabled]")) {
        return send(res, 403, googleError(403, "PERMISSION_DENIED", "Google Forms API has not been used in project 123 before or it is disabled.", "SERVICE_DISABLED"));
      }
      if (title.includes("[fail-auth]")) return send(res, 401, googleError(401, "UNAUTHENTICATED", "Invalid Credentials"));
      stats.creates += 1;
      const formId = `MOCKFORM${String(++counter).padStart(6, "0")}abcdef`;
      const unpublished = url.searchParams.get("unpublished") === "true";
      const form = {
        formId,
        info: { title, documentTitle: body.info?.documentTitle ?? title },
        settings: {},
        items: [],
        revisionId: "1",
        responderUri: `https://docs.google.com/forms/d/e/${formId}-resp/viewform`,
        publishSettings: { publishState: { isPublished: !unpublished, isAcceptingResponses: !unpublished } },
        _failQuestions: title.includes("[fail-questions]"),
      };
      forms.set(formId, form);
      return send(res, 200, publicView(form));
    }

    const match = /^\/v1\/forms\/([^/:]+)(?::(batchUpdate|setPublishSettings))?$/.exec(path);
    if (!match) return send(res, 404, googleError(404, "NOT_FOUND", "Not found"));
    const form = forms.get(decodeURIComponent(match[1]));
    if (!form) return send(res, 404, googleError(404, "NOT_FOUND", "Requested entity was not found."));

    if (req.method === "GET" && !match[2]) {
      stats.gets += 1;
      return send(res, 200, publicView(form));
    }

    if (req.method === "POST" && match[2] === "batchUpdate") {
      stats.batchUpdates += 1;
      const { requests = [] } = await readJson(req);
      if (form._failQuestions && requests.some((r) => r.createItem)) {
        form._failQuestions = false; // fail once, then let "Finish this form" succeed
        return send(res, 503, googleError(503, "UNAVAILABLE", "The service is currently unavailable."));
      }
      for (const r of requests) {
        if (r.updateSettings) {
          if (r.updateSettings.updateMask !== "quizSettings.isQuiz") return send(res, 400, googleError(400, "INVALID_ARGUMENT", "bad mask"));
          form.settings = { ...form.settings, quizSettings: { isQuiz: Boolean(r.updateSettings.settings?.quizSettings?.isQuiz) } };
        } else if (r.updateFormInfo) {
          form.info = { ...form.info, description: r.updateFormInfo.info?.description };
        } else if (r.createItem) {
          const item = r.createItem.item;
          const q = item.questionItem?.question;
          if (q?.grading && !form.settings?.quizSettings?.isQuiz) {
            return send(res, 400, googleError(400, "INVALID_ARGUMENT", "Grading requires quiz mode"));
          }
          if (q?.grading && !Number.isInteger(q.grading.pointValue)) {
            return send(res, 400, googleError(400, "INVALID_ARGUMENT", "pointValue must be an integer"));
          }
          const values = q?.choiceQuestion?.options?.map((o) => o.value) ?? [];
          if (new Set(values).size !== values.length) return send(res, 400, googleError(400, "INVALID_ARGUMENT", "Duplicate option values"));
          form.items.splice(r.createItem.location.index, 0, {
            itemId: `item${form.items.length}`,
            ...item,
            questionItem: { question: { questionId: `q${form.items.length}`, ...q } },
          });
        }
      }
      form.revisionId = String(Number(form.revisionId) + 1);
      return send(res, 200, { replies: requests.map(() => ({})), writeControl: { requiredRevisionId: form.revisionId } });
    }

    if (req.method === "POST" && match[2] === "setPublishSettings") {
      stats.publishes += 1;
      const body = await readJson(req);
      form.publishSettings = body.publishSettings;
      return send(res, 200, { formId: form.formId, publishSettings: form.publishSettings });
    }
    return send(res, 405, googleError(405, "METHOD_NOT_ALLOWED", "Method not allowed"));
  } catch (error) {
    return send(res, 500, googleError(500, "INTERNAL", String(error)));
  }
});

server.listen(PORT, "127.0.0.1", () => console.log(`mock forms api on http://127.0.0.1:${PORT}`));
