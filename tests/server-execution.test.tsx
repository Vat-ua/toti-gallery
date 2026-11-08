import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { PassThrough } from "node:stream";
import { renderToPipeableStream } from "react-dom/server";
import type { ReactNode } from "react";
import type { Person } from "../src/lib/types";

const require = createRequire(`${process.cwd()}/package.json`);
const originals = new Map<string, NodeJS.Module | undefined>();
let pathname = "/", demoCookie = false;
let identity: Promise<(Person & { role: "user" }) | null>;
function replace(path: string, exports: object) {
  const id = require.resolve(path); originals.set(id, require.cache[id]);
  require.cache[id] = { id, filename: id, loaded: true, exports } as NodeJS.Module;
}
replace("next/navigation", { usePathname: () => pathname, useRouter: () => ({ replace() {} }) });
replace("next/headers", { cookies: async () => ({ get: () => demoCookie ? { value: "1" } : undefined }) });
replace("./src/lib/auth.ts", { getCurrentUser: () => identity });
replace("./src/components/header.tsx", { Header: ({ pending, user }: { pending?: boolean; user: Person | null }) => <header>{pending ? "ACCOUNT_PENDING" : user ? "ACCOUNT_READY" : "GUEST_READY"}</header> });
replace("./src/components/footer.tsx", { Footer: () => <footer>FOOTER_READY</footer> });
replace("./src/components/ui.tsx", { ToastProvider: ({ children }: { children: ReactNode }) => children, useToast: () => () => {} });
replace("./src/app/globals.css", {});
const RootLayout = (require("./src/app/layout.tsx") as typeof import("../src/app/layout")).default;
const { PublishProjectLink } = require("./src/components/publish-project-link.tsx") as typeof import("../src/components/publish-project-link");
after(() => { for (const [id, value] of originals) { if (value) require.cache[id] = value; else delete require.cache[id]; } });

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
async function within<T>(promise: Promise<T>) {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Unrelated identity blocked rendering")), 2000); })]); }
  finally { clearTimeout(timer!); }
}
function stream(node: ReactNode) {
  const output = new PassThrough(); let html = "";
  const waiters = new Map<string, () => void>();
  output.on("data", chunk => { html += String(chunk); for (const [marker, done] of waiters) if (html.includes(marker)) { waiters.delete(marker); done(); } });
  const rendering = renderToPipeableStream(node);
  rendering.pipe(output);
  const finished = new Promise<void>((resolve, reject) => { output.on("end", resolve); output.on("error", reject); });
  return { html: () => html, finished, abort: rendering.abort, waitFor: (marker: string) => html.includes(marker) ? Promise.resolve() : new Promise<void>(resolve => { waiters.set(marker, resolve); }) };
}
const person: Person & { role: "user" } = { id: "fixture", slug: "fixture", name: "Fixture", cohort: "Turma 58", cohorts: ["Turma 58"], turmaId: "turma", courseName: "Full Stack", year: 2026, bio: "", avatar: null, github: null, linkedin: null, role: "user" };

test("root and public content stream before unresolved identity; chrome resolves independently", async () => {
  pathname = "/"; demoCookie = false;
  const user = deferred<typeof person | null>(); identity = user.promise;
  const root = await within(RootLayout({ children: <main>PUBLIC_CONTENT_READY<PublishProjectLink>Publicar projeto</PublishProjectLink></main> }));
  const result = stream(root);
  try {
    await within(result.waitFor("PUBLIC_CONTENT_READY"));
    assert(result.html().includes("ACCOUNT_PENDING")); assert(!result.html().includes("ACCOUNT_READY"));
    assert(result.html().includes('href="/meus-projetos/novo"'));
    user.resolve(person); await within(result.finished);
    assert(result.html().includes("ACCOUNT_READY")); assert(result.html().includes("FOOTER_READY"));
  } finally { user.resolve(null); result.abort(); }
});

test("publication links resolve the existing identity to direct login or editor destinations", async () => {
  pathname = "/"; demoCookie = false;
  for (const user of [null, person]) {
    identity = Promise.resolve(user);
    const result = stream(await RootLayout({ children: <main><PublishProjectLink>Publicar projeto</PublishProjectLink></main> }));
    try {
      await within(result.finished);
      assert.equal(result.html().includes('href="/entrar?next=%2Fmeus-projetos%2Fnovo"'), !user);
      if (user) assert(result.html().includes('href="/meus-projetos/novo"'));
    } finally { result.abort(); }
  }
});

test("demo waits for identity and never renders demo content for an authenticated user", async () => {
  pathname = "/demo"; demoCookie = true;
  const user = deferred<typeof person | null>(); identity = user.promise;
  const result = stream(await within(RootLayout({ children: <main>FORBIDDEN_DEMO_CONTENT</main> })));
  try {
    user.resolve(person); await within(result.finished);
    assert(!result.html().includes("FORBIDDEN_DEMO_CONTENT")); assert(result.html().includes("Abrindo seus projetos"));
  } finally { user.resolve(null); result.abort(); }
});

test("anonymous demo keeps its existing mode, banner and content after identity resolves", async () => {
  pathname = "/demo"; demoCookie = true;
  const user = deferred<typeof person | null>(); identity = user.promise;
  const result = stream(await within(RootLayout({ children: <main>LOCAL_DEMO_CONTENT<PublishProjectLink>Publicar projeto</PublishProjectLink></main> })));
  try {
    user.resolve(null); await within(result.finished);
    assert(result.html().includes("LOCAL_DEMO_CONTENT")); assert(result.html().includes("Modo de demonstração"));
    assert(result.html().includes('href="/demo/novo"'));
    assert(!result.html().includes('href="/entrar?next='));
  } finally { user.resolve(null); result.abort(); }
});
