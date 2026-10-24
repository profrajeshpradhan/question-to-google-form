import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${PORT}`;
export const E2E_SESSION_SECRET = "e2e-session-secret-e2e-session-secret-0123456789";

/**
 * End-to-end tests run against the production build (`npm run build` first).
 * Google's OAuth and Forms endpoints are never called for real here: OAuth is
 * tested up to the redirect, and Forms calls go to e2e/mock-forms-server.mjs via
 * a test-only override that the app ignores unless ALLOW_TEST_OVERRIDES=1.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: [
    {
      command: "node e2e/mock-forms-server.mjs",
      url: "http://127.0.0.1:4010/__stats",
      reuseExistingServer: false,
      env: { MOCK_FORMS_PORT: "4010" },
    },
    {
      command: `npx next start -p ${PORT}`,
      url: `${E2E_BASE_URL}/`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        APP_BASE_URL: E2E_BASE_URL,
        GOOGLE_CLIENT_ID: "e2e-test-client.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET: "e2e-test-secret",
        SESSION_SECRET: E2E_SESSION_SECRET,
        ALLOW_TEST_OVERRIDES: "1",
        GOOGLE_FORMS_API_ROOT_URL_TEST_ONLY: "http://127.0.0.1:4010/",
        RATE_LIMIT_CREATE_PER_USER: "1000",
        RATE_LIMIT_AUTH_PER_IP: "1000",
      },
    },
  ],
});
