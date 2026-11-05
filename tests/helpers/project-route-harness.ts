import { createRequire } from "node:module";
import type { ImageMetadata } from "../../src/lib/image-policy";

/** Replace external boundaries only. Routes, validation and PostgreSQL stay real. */
export function projectRouteHarness() {
  const require = createRequire(`${process.cwd()}/package.json`);
  const originals = new Map<string, NodeJS.Module | undefined>();
  const state = {
    actorId: null as string | null,
    allowUpload: true,
    uploadError: null as Error | null,
    uploaded: [] as ImageMetadata[],
    deleted: [] as ImageMetadata[],
    retired: [] as ImageMetadata[],
    deferred: [] as (() => Promise<void>)[],
    processingDeferred: false,
  };
  function replace(path: string, exports: object) {
    const id = require.resolve(path);
    originals.set(id, require.cache[id]);
    require.cache[id] = { id, filename: id, loaded: true, exports } as NodeJS.Module;
  }
  replace("./src/lib/auth.ts", {
    getCurrentUser: async () => state.actorId ? { id: state.actorId } : null,
    isSameOrigin: (request: Request) => request.headers.get("origin") === "http://localhost:3000",
  });
  replace("next/headers", { cookies: async () => ({ get: () => undefined }) });
  replace("next/server", { after: (work: () => Promise<void>) => state.deferred.push(work) });
  replace("./src/lib/auth-rate-limit.ts", { allowAttempt: async () => state.allowUpload });
  replace("./src/lib/image-storage.ts", {
    saveImage: async () => {
      if (state.uploadError) throw state.uploadError;
      const { randomUUID } = await import("node:crypto");
      const key = `covers/${randomUUID()}/image.webp`;
      const metadata: ImageMetadata = { key, width: 1600, height: 1000, bytes: 1234, format: "webp" };
      state.uploaded.push(metadata);
      return { url: `/media/${key}`, metadata };
    },
    deleteImage: async (metadata: ImageMetadata) => { state.deleted.push(metadata); },
    retireImage: async (metadata: ImageMetadata) => {
      if (!state.processingDeferred && state.uploaded.some(image => image.key === metadata.key)) state.deleted.push(metadata);
      else state.retired.push(metadata);
    },
  });
  return {
    state,
    collection: require("./src/app/api/projects/route.ts") as typeof import("../../src/app/api/projects/route"),
    item: require("./src/app/api/projects/[id]/route.ts") as typeof import("../../src/app/api/projects/[id]/route"),
    authors: require("./src/app/api/projects/[id]/authors/me/route.ts") as typeof import("../../src/app/api/projects/[id]/authors/me/route"),
    async flush() {
      state.processingDeferred = true;
      try { for (const work of state.deferred.splice(0)) await work(); }
      finally { state.processingDeferred = false; }
    },
    reset() { state.allowUpload = true; state.uploadError = null; state.uploaded = []; state.deleted = []; state.retired = []; state.deferred = []; },
    restore() { for (const [id, original] of originals) { if (original) require.cache[id] = original; else delete require.cache[id]; } },
  };
}
