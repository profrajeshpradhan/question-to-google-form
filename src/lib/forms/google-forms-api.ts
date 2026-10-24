import "server-only";
import { forms } from "@googleapis/forms";
import { OAuth2Client } from "google-auth-library";
import { getFormsApiRootUrl } from "@/lib/config";
import type { FormsApi } from "./forms-service";

/** Real Google Forms API adapter, authenticated as the signed-in teacher. */
export function createGoogleFormsApi(accessToken: string): FormsApi {
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: accessToken });
  const rootUrl = getFormsApiRootUrl();
  const client = forms({ version: "v1", auth, ...(rootUrl ? { rootUrl } : {}) });
  const requestOptions = { timeout: 30_000, retry: false } as const;

  return {
    async create(title) {
      const res = await client.forms.create(
        // Created unpublished; published explicitly only after verification.
        { unpublished: true, requestBody: { info: { title, documentTitle: title } } },
        requestOptions,
      );
      return res.data;
    },
    async batchUpdate(formId, requests) {
      await client.forms.batchUpdate({ formId, requestBody: { requests, includeFormInResponse: false } }, requestOptions);
    },
    async get(formId) {
      const res = await client.forms.get({ formId }, requestOptions);
      return res.data;
    },
    async publish(formId) {
      await client.forms.setPublishSettings(
        {
          formId,
          requestBody: {
            publishSettings: { publishState: { isPublished: true, isAcceptingResponses: true } },
            updateMask: "publishState",
          },
        },
        requestOptions,
      );
    },
  };
}
