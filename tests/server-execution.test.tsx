import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { PassThrough } from "node:stream";
import { renderToPipeableStream } from "react-dom/server";
import type { ReactNode } from "react";
import type { Person, Project } from "../src/lib/types";

const require = createRequire(`${process.cwd()}/package.json`);
const originals = new Map<string, NodeJS.Module | undefined>();
const navigation = require("next/navigation") as typeof import("next/navigation");
let pathname = "/", demoCookie = false;
let identity: Promise<(Person & { role: "user" }) | null>;
const logs: string[] = [], originalConsole = console.error;
console.error = value => logs.push(String(value));
function replace(path: string, exports: object) {
  const id = require.resolve(path); originals.set(id, require.cache[id]);
  require.cache[id] = { id, filename: id, loaded: true, exports } as NodeJS.Module;
}
replace("next/navigation", { ...navigation, usePathname: () => pathname, useSearchParams: () => new URLSearchParams(), useRouter: () => ({ replace() {}, refresh() {} }) });
replace("next/headers", { cookies: async () => ({ get: () => demoCookie ? { value: "1" } : undefined }) });
replace("./src/lib/auth.ts", { getCurrentUser: () => identity, isCurrentUser: async (id: string) => (await identity)?.id === id });
replace("./src/components/header.tsx", { Header: ({ pending, unavailable, user }: { pending?: boolean; unavailable?: boolean; user: Person | null }) => <header>{pending ? "ACCOUNT_PENDING" : unavailable ? "ACCOUNT_UNAVAILABLE" : user ? "ACCOUNT_READY" : "GUEST_READY"}</header> });
replace("./src/components/footer.tsx", { Footer: () => <footer>FOOTER_READY</footer> });
replace("./src/components/ui.tsx", { ToastProvider: ({ children }: { children: ReactNode }) => children, useToast: () => () => {}, Avatar: () => <span>AVATAR</span>, LikeButton: () => <button>Curtir</button> });
replace("./src/app/globals.css", {});
const RootLayout = (require("./src/app/layout.tsx") as typeof import("../src/app/layout")).default;
const { PublishProjectLink } = require("./src/components/publish-project-link.tsx") as typeof import("../src/components/publish-project-link");
after(() => { console.error = originalConsole; for (const [id, value] of originals) { if (value) require.cache[id] = value; else delete require.cache[id]; } });

function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: unknown) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }
async function within<T>(promise: Promise<T>) {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Unrelated identity blocked rendering")), 2000); })]); }
  finally { clearTimeout(timer!); }
}
function stream(node: ReactNode) {
  const output = new PassThrough(); let html = "";
  const waiters = new Map<string, () => void>();
  output.on("data", chunk => { html += String(chunk); for (const [marker, done] of waiters) if (html.includes(marker)) { waiters.delete(marker); done(); } });
  const errors: unknown[] = [];
  const rendering = renderToPipeableStream(node, { onError: error => { errors.push(error); } });
  rendering.pipe(output);
  const finished = new Promise<void>((resolve, reject) => { output.on("end", resolve); output.on("error", reject); });
  return { html: () => html, finished, errors, abort: rendering.abort, waitFor: (marker: string) => html.includes(marker) ? Promise.resolve() : new Promise<void>(resolve => { waiters.set(marker, resolve); }) };
}
const person: Person & { role: "user" } = { id: "fixture", slug: "fixture", name: "Fixture", cohort: "Turma 58", cohorts: ["Turma 58"], turmaId: "turma", courseName: "Full Stack", year: 2026, bio: "", avatar: null, github: null, linkedin: null, role: "user" };
const project: Project = { id: "fixture-project", version: 1, slug: "fixture-project", title: "PUBLIC_PROJECT_READY", description: "Public description",
  technologies: ["React"], coverStyle: "abstract", imageUrl: null, githubUrl: "https://github.com", liveUrl: null,
  featured: false, isFinal: false, turmaId: "turma", createdAt: "2026-01-01T12:00:00Z", author: person, authors: [person], likes: 0, liked: false, visibility: "published" };
replace("./src/lib/queries.ts", {
  getProjectBySlug: async () => project, getRelatedProjects: async () => [],
  getPersonBySlug: async () => person, getProfileProjectStats: async () => ({ total: 0, totalLikes: 0 }),
  readInitialProjects: async () => ({ items: [], total: 0, loadedPages: 1, pageSize: 12, hasMore: false }),
});
const ProjectPage = (require("./src/app/projetos/[slug]/page.tsx") as typeof import("../src/app/projetos/[slug]/page")).default;
const ProfilePage = (require("./src/app/pessoas/[slug]/page.tsx") as typeof import("../src/app/pessoas/[slug]/page")).default;

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

test("rejected optional identity preserves public content, links and footer without assuming an anonymous demo", async () => {
  for (const storedDemo of [false, true]) {
    pathname = "/"; demoCookie = storedDemo;
    const user = deferred<typeof person | null>(); identity = user.promise;
    const result = stream(await RootLayout({ children: <main>PUBLIC_FAILURE_CONTENT<PublishProjectLink>Publicar projeto</PublishProjectLink></main> }));
    try {
      user.reject(new TypeError("fixture-sensitive-session-token@example.invalid"));
      await within(result.finished);
      const html = result.html();
      assert(html.includes("PUBLIC_FAILURE_CONTENT")); assert(html.includes("ACCOUNT_UNAVAILABLE")); assert(html.includes("FOOTER_READY"));
      assert(!html.includes('href="/demo')); assert(!html.includes("Modo de demonstração"));
      assert(!html.includes("fixture-sensitive-session-token")); assert.deepEqual(result.errors, []);
    } finally { user.resolve(null); result.abort(); }
  }
});

test("failed identity never admits demo content or private administration", async () => {
  pathname = "/demo"; demoCookie = true;
  const user = deferred<typeof person | null>(); identity = user.promise;
  const result = stream(await RootLayout({ children: <main>FORBIDDEN_DEMO_CONTENT</main> }));
  const error = new Error("fixture identity unavailable");
  try {
    user.reject(error); await within(result.finished);
    assert(!result.html().includes("FORBIDDEN_DEMO_CONTENT")); assert(!result.html().includes("Modo de demonstração"));
    assert(result.html().includes("Tentar novamente")); assert.deepEqual(result.errors, []);
    const AdminLayout = (require("./src/app/admin/layout.tsx") as typeof import("../src/app/admin/layout")).default;
    await assert.rejects(() => AdminLayout({ children: "FORBIDDEN_ADMIN_CONTENT" }), caught => caught === error);
  } finally { user.resolve(null); result.abort(); }
});

test("public project and profile content streams before ownership and remains usable after identity failure", async () => {
  for (const kind of ["project", "profile"]) {
    pathname = kind === "project" ? "/projetos/fixture-project" : "/pessoas/fixture"; demoCookie = false;
    const user = deferred<typeof person | null>(); identity = user.promise;
    const content = await within(kind === "project" ? ProjectPage({ params: Promise.resolve({ slug: project.slug }) })
      : ProfilePage({ params: Promise.resolve({ slug: person.slug }), searchParams: Promise.resolve({}) }));
    const result = stream(await RootLayout({ children: content }));
    try {
      await within(result.waitFor(kind === "project" ? project.title : person.name));
      assert(!result.html().includes("Editar projeto")); assert(!result.html().includes("Editar perfil"));
      user.reject(new TypeError("fixture-private-owner-token@example.invalid"));
      await within(result.finished);
      assert.deepEqual(result.errors, []);
      assert(!result.html().includes("fixture-private-owner-token"));
      assert(!result.html().includes("Editar projeto")); assert(!result.html().includes("Editar perfil"));
      assert(result.html().includes("FOOTER_READY"));
    } finally { user.resolve(null); result.abort(); }
  }
});

test("resolved public ownership still renders the project's and profile's own edit actions", async () => {
  demoCookie = false; identity = Promise.resolve(person);
  for (const kind of ["project", "profile"]) {
    pathname = kind === "project" ? "/projetos/fixture-project" : "/pessoas/fixture";
    const content = kind === "project" ? await ProjectPage({ params: Promise.resolve({ slug: project.slug }) })
      : await ProfilePage({ params: Promise.resolve({ slug: person.slug }), searchParams: Promise.resolve({}) });
    const result = stream(await RootLayout({ children: content }));
    try {
      await within(result.finished); assert.deepEqual(result.errors, []);
      assert(result.html().includes(kind === "project" ? "Editar projeto" : "Editar perfil"));
    } finally { result.abort(); }
  }
});

test("public identity fallbacks preserve Next.js redirect and dynamic-render control signals", async () => {
  const { getPublicIdentity, getPublicOwnership } = require("./src/lib/public-identity.ts") as typeof import("../src/lib/public-identity");
  let redirect: unknown;
  try { navigation.redirect("/entrar"); } catch (error) { redirect = error; }
  const dynamic = Object.assign(new Error("Framework dynamic rendering signal"), { digest: "DYNAMIC_SERVER_USAGE" });
  for (const signal of [redirect, dynamic]) {
    const user = deferred<typeof person | null>(); identity = user.promise;
    const before = logs.length;
    const presentation = getPublicIdentity(), ownership = getPublicOwnership(person.id);
    user.reject(signal);
    await assert.rejects(() => presentation, error => error === signal);
    await assert.rejects(() => ownership, error => error === signal);
    assert.equal(logs.length, before, "Framework control flow is not an account outage");
  }
});
