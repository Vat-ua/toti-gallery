import { createHash } from "node:crypto";
import { test as base } from "@playwright/test";

export { expect, type Page } from "@playwright/test";

// Model independent clients on the isolated server, without disabling the
// application's rate limits. Applies to both browser and API request fixtures.
export const test = base.extend({
  extraHTTPHeaders: async ({}, provide, info) => {
    const bytes = createHash("sha256").update(`${info.testId}:${info.retry}:${info.repeatEachIndex}`).digest();
    await provide({ "x-real-ip": `198.18.${bytes[0]}.${bytes[1]}` });
  },
});
