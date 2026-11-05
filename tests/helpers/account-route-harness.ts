import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import type { ImageMetadata } from "../../src/lib/image-policy";

/** Keep Better Auth and PostgreSQL real; replace only Next request context/storage. */
export function accountRouteHarness() {
  const require = createRequire(`${process.cwd()}/package.json`);
  const originals = new Map<string, NodeJS.Module | undefined>();
  const state = {
    headers: new Headers(),
    sessionChecks: 0,
    failSecondSessionCheck: false,
    allowUpload: true,
    allowPassword: true,
    uploadError: null as Error | null,
    uploaded: [] as ImageMetadata[], deleted: [] as ImageMetadata[], retired: [] as ImageMetadata[],
    deferred: [] as (() => Promise<void>)[],
  };
  function replace(path: string, exports: object) {
    const id = require.resolve(path);
    originals.set(id, require.cache[id]);
    require.cache[id] = { id, filename: id, loaded: true, exports } as NodeJS.Module;
  }
  replace("next/headers", { headers: async () => state.headers, cookies: async () => ({ get: () => undefined }) });
  replace("next/server", { after: (work: () => Promise<void>) => state.deferred.push(work) });
  replace("./src/lib/auth-rate-limit.ts", { allowAttempt: async (scope: string) => scope === "change-password" ? state.allowPassword : state.allowUpload });
  replace("./src/lib/image-storage.ts", {
    saveImage: async () => {
      if (state.uploadError) throw state.uploadError;
      const metadata: ImageMetadata = { key: `avatars/${randomUUID()}.webp`, width: 512, height: 512, bytes: 1234, format: "webp" };
      state.uploaded.push(metadata); return { url: `/media/${metadata.key}`, metadata };
    },
    deleteImage: async (metadata: ImageMetadata) => { state.deleted.push(metadata); },
    retireImage: async (metadata: ImageMetadata) => { state.retired.push(metadata); },
  });
  const authModule = require("./src/lib/auth.ts") as typeof import("../../src/lib/auth");
  replace("./src/lib/auth.ts", { ...authModule, getCurrentUser: async () => {
    state.sessionChecks++;
    if (state.failSecondSessionCheck && state.sessionChecks > 1) throw new Error("Fixture session lookup unavailable after commit");
    return authModule.getCurrentUser();
  } });
  return {
    state,
    auth: (require("./src/lib/auth-core.ts") as typeof import("../../src/lib/auth-core")).getAuth(),
    profile: require("./src/app/api/account/route.ts") as typeof import("../../src/app/api/account/route"),
    password: require("./src/app/api/account/password/route.ts") as typeof import("../../src/app/api/account/password/route"),
    async flush() { for (const work of state.deferred.splice(0)) await work(); },
    reset() { state.sessionChecks = 0; state.failSecondSessionCheck = false; state.allowUpload = true; state.allowPassword = true; state.uploadError = null; state.uploaded = []; state.deleted = []; state.retired = []; state.deferred = []; },
    restore() { for (const [id, original] of originals) { if (original) require.cache[id] = original; else delete require.cache[id]; } },
  };
}
