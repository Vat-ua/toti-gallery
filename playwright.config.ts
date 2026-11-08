import { defineConfig, devices } from "@playwright/test";
// This CJS helper is also used by the build/server wrapper.
const { smokeEnvironment, origin } = require("./scripts/lib/smoke-environment.cjs");
Object.assign(process.env, smokeEnvironment());

export default defineConfig({
  testDir: "./tests/smoke",
  testMatch: "**/*.spec.ts",
  globalSetup: "./tests/smoke/setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: origin, trace: "retain-on-failure", screenshot: "only-on-failure", launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {} },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: { command: "node scripts/run-smoke.cjs start", url: origin + "/entrar", reuseExistingServer: false, timeout: 60_000 },
});
