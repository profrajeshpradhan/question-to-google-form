# Question to Google Form

A Progressive Web App for teachers: sign in with Google, paste multiple-choice questions, validate them, preview the quiz, and create a real **Google Forms quiz** (answer keys + marks) in the teacher's own Google account.

- Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4
- Google OAuth 2.0 authorization-code flow with PKCE (`google-auth-library`)
- Google Forms API (`@googleapis/forms`) called server-side as the signed-in teacher
- Zod request validation · Vitest unit tests · Playwright end-to-end tests
- No database: stateless encrypted-cookie sessions, no question/form history

---

## 1. How it works

| Screen | Route / component |
| --- | --- |
| Landing page | `/` (`src/app/page.tsx`) |
| Sign in & permission explanation, OAuth error states | `/login` |
| Dashboard: title, description, question editor, format example | `/dashboard` → `QuizWorkflow` |
| Validation results / question-specific errors | `validation-step.tsx`, `editor-step.tsx` |
| Preview + confirmation dialog | `preview-step.tsx` |
| Creation progress (real API steps) | `creation-steps.tsx` |
| Success / partial failure / reconnect | `result-steps.tsx` |
| Privacy, Terms, Support, Offline | `/privacy`, `/terms`, `/support`, `/offline` |

API routes:

| Method & path | Purpose |
| --- | --- |
| `GET /api/auth/google` | Starts OAuth (state + PKCE stored in a short-lived encrypted HTTP-only cookie) |
| `GET /api/auth/google/callback` | Validates state, exchanges the code, verifies the ID token, checks the granted scope, sets the session |
| `GET /api/auth/session` | Public session info (name, email, expiry, CSRF token). Never returns the access token |
| `POST /api/auth/logout` | CSRF-protected; revokes the Google token and clears the cookie |
| `POST /api/forms` | Creates the quiz. Streams newline-delimited JSON progress events |
| `POST /api/forms/:formId/resume` | Finishes a partially created form **on the same form** (never creates a duplicate) |

### Form creation sequence (`src/lib/forms/forms-service.ts`)

1. `forms.create` with `unpublished=true`. Only `info.title`/`documentTitle` are accepted at creation.
2. `forms.batchUpdate`: `updateSettings` (`quizSettings.isQuiz`, mask `quizSettings.isQuiz`) + `updateFormInfo` (mask `description`).
3. `forms.batchUpdate`: one `createItem` per question at explicit indices. Each is a required `RADIO` choice question with `grading.pointValue` (integer) and one `correctAnswers` value. A batch is atomic.
4. `forms.get`: verifies quiz mode, description, question text, options, answer key and points for every question. If anything differs, the app reports a failure and does **not** publish.
5. `forms.setPublishSettings` (`publishState.isPublished` + `isAcceptingResponses`, mask `publishState`). Optional: the teacher can keep an unpublished draft.

The edit link uses Google's documented format `https://docs.google.com/forms/d/{formId}/edit`. The respondent link is Google's `responderUri`.

**Partial failures:** if anything fails after step 1, the UI shows the form ID and edit link and offers **Finish this form**. That runs `/resume`, which reads the existing form and only continues if it is empty or already matches the quiz exactly. Otherwise it refuses (`resume_unsafe`). A form is never re-created automatically. The form ID is also kept in the tab's draft, so after a reconnect the app offers to finish that form instead of creating another one.

### Input format and title rule

```
FORM TITLE: Introduction to IT Systems      (optional)
FORM DESCRIPTION: Unit 1 Assessment         (optional)

Q1: What does CPU stand for?
OPTIONS:
A. Central Processing Unit
B. Computer Personal Unit
C. Central Program Utility
D. Control Processing User
ANSWER: A
MARKS: 2
```

- **Title/description rule:** values typed in the *Form Title* / *Form Description* fields take priority. `FORM TITLE:` / `FORM DESCRIPTION:` lines are used only when the matching field is empty.
- Also accepted: `Question 1)`, `1.`, `(a)`/`a)` labels, `Ans:`, `Correct answer:`, `Points:`, `2 marks`, the answer as option text (`ANSWER: HTML`), and wrapped lines.
- **Marks must be whole numbers.** Google Forms `grading.pointValue` is an integer, so decimal marks such as `1.5` are rejected with an explanation (`2.0` is accepted as 2).
- Limits (`src/lib/quiz/limits.ts`): 100,000 characters, 100 questions, 2–20 options per question, 1–1,000 marks per question, a 200-character title and a 4,000-character description. Option texts within a question must be unique, because Google rejects duplicates.
- If any question is invalid, the whole input is rejected before any Google call, with errors listed by question number and line. The server re-parses the raw input with the same parser.

---

## 2. Local setup

Requirements: Node.js ≥ 20.9 (tested on Node 24), npm.

```bash
npm install
cp .env.example .env.local      # then fill in the values (see below)
npm run dev                      # http://localhost:3000
```

Generate `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Without Google credentials, the site runs and the login page explains that sign-in is not configured.

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `APP_BASE_URL` | yes | Public origin, no trailing slash (e.g. `https://quiz.example.com`). The redirect URI is `${APP_BASE_URL}/api/auth/google/callback`. HTTPS turns on `Secure` + `__Host-` cookies |
| `GOOGLE_CLIENT_ID` | yes | OAuth client ID (Web application) |
| `GOOGLE_CLIENT_SECRET` | yes | OAuth client secret (server only) |
| `SESSION_SECRET` | yes | ≥ 32 random characters; encrypts session and OAuth cookies (AES-256-GCM) |
| `SUPPORT_EMAIL` | no | Contact shown on the Privacy/Terms/Support pages |
| `RATE_LIMIT_AUTH_PER_IP` | no | Default 20 per 10 min |
| `RATE_LIMIT_CREATE_PER_USER` | no | Default 10 forms per hour per Google account |
| `RATE_LIMIT_CREATE_PER_IP` | no | Default 60 forms per hour per IP |
| `ALLOW_TEST_OVERRIDES`, `GOOGLE_FORMS_API_ROOT_URL_TEST_ONLY` | **never in production** | Used only by the Playwright suite to point at a local mock. Ignored unless `ALLOW_TEST_OVERRIDES=1`, and always ignored when `VERCEL_ENV=production` |

---

## 3. Google Cloud configuration

1. **Create a project** at <https://console.cloud.google.com/>.
2. **Enable the Google Forms API**: *APIs & Services → Library → Google Forms API → Enable*. (The Drive API does not need to be enabled.)
3. **Google Auth Platform / OAuth consent screen**:
   - User type: **External** (for teachers worldwide).
   - App name: *Question to Google Form*; support email; logo (optional, triggers brand verification).
   - Authorized domain: your production domain.
   - Links: Home page `https://YOUR_DOMAIN/`, Privacy policy `https://YOUR_DOMAIN/privacy`, Terms `https://YOUR_DOMAIN/terms`.
   - **Data access (scopes):** `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `https://www.googleapis.com/auth/drive.file`.
4. **Create credentials**: *Clients → Create client → Web application*.
   - Authorized JavaScript origins: `http://localhost:3000`, `https://YOUR_DOMAIN`
   - **Authorized redirect URIs:**
     - `http://localhost:3000/api/auth/google/callback`
     - `https://YOUR_DOMAIN/api/auth/google/callback`
     - (each preview domain you use, if any)
5. While the app is in **Testing** status, add your teacher accounts as *test users* (max 100), and their grants expire after 7 days.

### Scopes and why they are minimal

| Scope | Classification | Used for |
| --- | --- | --- |
| `openid`, `email`, `profile` | non-sensitive | Show the connected account |
| `https://www.googleapis.com/auth/drive.file` | **non-sensitive** | Accepted by `forms.create`, `forms.batchUpdate`, `forms.get` and `forms.setPublishSettings`. Access is limited to files the app creates |

The app does **not** request `forms.body` (sensitive) or `drive` (restricted). Access is **online only**: no refresh token is requested or stored. A session lasts until Google's access token expires (~1 h), and then the teacher clicks *Reconnect* (their draft is kept in the tab).

If a teacher unticks the Drive-files permission on the consent screen (granular consent), the callback detects the missing scope, revokes the token and shows a "permission is required" message.

### API access requirements (verified 23 Oct 2026 against Google's docs)

- **Forms created through the API after 30 June 2026 are unpublished by default.** The app creates the form unpublished on purpose and publishes it explicitly with `forms.setPublishSettings` only after verification. The `publishSettings` field and `setPublishSettings` are documented in the v1 REST reference.
- `forms.create` copies only `info.title` and `info.document_title`. Everything else (quiz mode, description, items) is set with `batchUpdate`, as implemented.
- `grading.pointValue` is an integer, which is why marks must be whole numbers.
- Google's quickstart pages still link to "Early Adopter Program" setup instructions for authorization. The methods used here are part of the generally available v1 API with the listed scopes, and enabling the API in your project is required. **This could not be confirmed against a real Google project from this development environment** (no credentials were available), so do the live check in §6 before launch.
- Respondent access: Google's change guide recommends controlling responders by sharing with specific users (Drive permissions). The app does not change sharing; responder access follows the teacher's account/domain defaults and can be adjusted in Google Forms → *Publish* settings. School (Workspace) accounts may restrict responses to the organisation.
- Quotas: the Forms API has per-project and per-user read/write quotas (see *APIs & Services → Google Forms API → Quotas*). The app maps HTTP 429 to a "please wait and try again" message, uses one write for all questions, and limits forms per user/IP.

---

## 4. OAuth verification and public launch

Before teachers outside your test-user list can sign in:

1. Publish the app (*Audience → Publish app → In production*).
2. Because every scope is non-sensitive, **sensitive/restricted scope verification (and a CASA security assessment) is not required.** However, Google requires **brand verification** for production apps that show a logo or name on the consent screen: verify domain ownership in Google Search Console, and keep the homepage and privacy policy publicly reachable on the verified domain.
3. Google Workspace (school) domains can block third-party apps. Their administrators may need to allow your OAuth client ID.

**Do not consider the app publicly launch-ready until:** the Forms API is enabled, the consent screen is in production with brand verification complete, the production redirect URI is registered, and the live smoke test in §6 has passed with a real account.

---

## 5. Deploying to Vercel

1. Push the repository to GitHub/GitLab and import it in Vercel (framework preset: Next.js).
2. Set the environment variables (Production and Preview) under *Settings → Environment Variables*: `APP_BASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, optionally `SUPPORT_EMAIL`. Do **not** set the test-override variables.
3. **Domain:** *Settings → Domains → Add* your domain and create the DNS records Vercel shows. Set `APP_BASE_URL` to exactly `https://your-domain`, and register `https://your-domain/api/auth/google/callback` in Google Cloud.
4. Redeploy after changing environment variables.
5. Optional abuse protection: the built-in rate limiter is per server instance. For global limits, add a Vercel Firewall rate-limit rule on `/api/forms` and `/api/auth/google`.

Preview deployments get random URLs that are not registered redirect URIs, so test OAuth on a fixed preview domain or on production.

---

## 6. Testing

```bash
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest unit tests (parser, request builders, service, sessions, errors, rate limiting)
npm run build        # production build
npm run test:e2e     # Playwright (needs `npm run build` first; first run: `npx playwright install chromium`)
npm run check        # lint + typecheck + unit tests + build
```

The Playwright suite runs the production build against `e2e/mock-forms-server.mjs`, a local stand-in for the four Forms endpoints. The stand-in also enforces integer points, unique options and quiz-mode-before-grading. Signed-in state is created with a real encrypted session cookie, sealed with the test server's secret. OAuth is tested up to and including the redirect to Google and all callback error paths. **The mock is for automated tests only; the production code path always calls Google.**

### Live smoke test with a real Google account (required before launch)

Use a dedicated Google test account that is listed as a test user:

1. `npm run dev` with real credentials in `.env.local` (`APP_BASE_URL=http://localhost:3000`).
2. Sign in, paste the sample (*View Format Example → Insert example*), validate, preview and confirm.
3. In the created form, check: *Settings → Make this a quiz* is on; each question has the correct answer key and points; the total is right; the form is published; and the respondent link opens.
4. Test denial: sign in and click *Cancel* on Google's consent screen → you should see "Sign-in was cancelled".
5. Test revocation: remove the app at <https://myaccount.google.com/connections>, then try to create a form → you should see "Please reconnect your Google account".

---

## 7. Security and privacy summary

- Tokens are stored only inside an AES-256-GCM encrypted, `HttpOnly`, `SameSite=Lax` cookie (`Secure` and `__Host-` prefix on HTTPS). There is no refresh token and no database.
- OAuth uses `state` + PKCE (S256) bound to an encrypted 10-minute transaction cookie, ID-token verification (audience), and a granted-scope check.
- State-changing routes require a same-origin `Origin`/`Referer` and a per-session CSRF token (`x-csrf-token`).
- Server-side Zod validation, a request size cap, and the full parser run again on the server.
- Security headers: CSP, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy, COOP, and HSTS in production. API responses use `Cache-Control: no-store`.
- Logging is minimal: only step and error codes. No question text, tokens or emails are logged. No analytics or error monitoring receives pasted content.
- The service worker never caches `/api/*`, `/dashboard` or `/login`. It caches hashed static assets, icons, public pages and the offline page only.

## 8. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `redirect_uri_mismatch` on Google's page | Register exactly `${APP_BASE_URL}/api/auth/google/callback` (scheme, host, port, no trailing slash) |
| Login page says "Sign-in is not configured yet" | Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_BASE_URL`, `SESSION_SECRET` (≥ 32 chars) and restart |
| "Google Forms API is not enabled…" | Enable the Google Forms API in the same Cloud project as the OAuth client and wait a few minutes |
| `access_denied` / "app has not completed verification" | Add the account as a test user, or publish and verify the app |
| "Sign-in timed out" (`state_expired`) | Browser blocked cookies or the attempt took more than 10 minutes; allow cookies for the site |
| Session expires after about an hour | Expected (online access only). Click *Reconnect*; the draft is kept |
| Respondents can't open the form | Check it's published and review *Responses* settings (e.g. "Restrict to users in organisation") |
| Rate-limit message | Wait, or raise `RATE_LIMIT_CREATE_PER_USER` / `RATE_LIMIT_CREATE_PER_IP` |