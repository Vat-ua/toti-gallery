import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const networkCodes = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "EPIPE", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET"]);
const unavailableDatabaseCodes = new Set(["53300", "53400", "57014", "57P01", "57P02", "57P03", "55P03", "40P01", "40001", "25P03"]);
const storageNames = new Set(["SlowDown", "ServiceUnavailable", "RequestTimeout", "TimeoutError", "AccessDenied", "NoSuchBucket", "NoSuchKey"]);

/** Never serialize messages, raw stacks, SQL, bodies, headers, URLs or arbitrary metadata. */
export function errorDetails(error: unknown) {
  let current = error;
  const seen = new Set<unknown>();
  for (let depth = 0; current && typeof current === "object" && depth < 6 && !seen.has(current); depth++) {
    seen.add(current);
    const item = current as { code?: unknown; name?: unknown; cause?: unknown };
    if (typeof item.code === "string") {
      if (networkCodes.has(item.code)) return { category: "network", code: item.code, unavailable: true };
      if (/^(?:[0-9]{2}|[A-Z][0-9]|XX|HV)[A-Z0-9]{3}$/.test(item.code)) return { category: "database", code: item.code, unavailable: item.code.startsWith("08") || unavailableDatabaseCodes.has(item.code) };
    }
    if (typeof item.name === "string" && storageNames.has(item.name)) return { category: "storage", code: item.name, unavailable: true };
    if (current instanceof Error && ["Connection terminated unexpectedly", "Connection terminated due to connection timeout", "timeout exceeded when trying to connect", "Query read timeout"].includes(current.message)) return { category: "database", code: "DATABASE_TIMEOUT_OR_DISCONNECT", unavailable: true };
    current = item.cause;
  }
  return { category: "unexpected", code: "UNEXPECTED", unavailable: false };
}

function errorChain(error: unknown) {
  const chain: unknown[] = [], seen = new Set<unknown>();
  for (let current = error; current && typeof current === "object" && chain.length < 6 && !seen.has(current); current = (current as { cause?: unknown }).cause) {
    seen.add(current); chain.push(current);
  }
  return chain;
}

function errorKind(error: unknown) {
  for (const kind of [TypeError, ReferenceError, RangeError, SyntaxError, URIError, EvalError, AggregateError]) if (error instanceof kind) return kind.name;
  return error instanceof Error ? "Error" : "UnknownError";
}

function codeFile(path: string) {
  if (path.length > 250 || !/^(?:src\/(?:app|components|lib|db)\/|\.next\/server\/)[a-zA-Z0-9_./()[\]-]+\.(?:[cm]?js|tsx?)$/.test(path) || path.split("/").includes("..")) return false;
  return existsSync(resolve(process.cwd(), path));
}

/** Emit only existing repository-relative code locations; never function names. */
function applicationFrames(error: unknown) {
  if (!(error instanceof Error) || typeof error.stack !== "string") return [];
  const prefix = `${error.name}: ${error.message}`;
  // A multiline SQL/error message can itself contain fake "at ..." lines.
  // If the stack cannot be separated from its complete message, omit locations.
  if (!error.stack.startsWith(prefix)) return [];
  const frames: string[] = [];
  for (const line of error.stack.slice(prefix.length, prefix.length + 32768).split("\n").slice(0, 40)) {
    if (!/^\s+at\s/.test(line)) continue;
    const match = line.match(/(?:\(|\s)((?:file:\/\/\/|\/)[^()]+):(\d{1,9}):(\d{1,9})\)?$/);
    if (!match) continue;
    try {
      let path = match[1];
      if (path.startsWith("file:")) {
        const url = new URL(path);
        if (url.search || url.hash) continue;
        path = fileURLToPath(url);
      }
      if (!isAbsolute(path)) continue;
      const source = relative(process.cwd(), path).split(sep).join("/");
      if (codeFile(source)) frames.push(`${source}:${match[2]}:${match[3]}`);
    } catch { /* Unusable locations must not interfere with failure handling. */ }
  }
  return frames;
}

function routeTemplate(value: string | undefined) {
  if (!value || value.length > 180 || !/^\/[a-zA-Z0-9_/()[\].-]*$/.test(value)) return undefined;
  const route = value.replace(/^\/app\//, "/").replace(/\/(?:page|route)$/, "").replace(/\/$/, "");
  if (route.split("/").some(part => part === "." || part === "..")) return undefined;
  return ["page", "route"].some(kind => ["tsx", "ts", "jsx", "js"].some(extension => codeFile(`src/app${route}/${kind}.${extension}`))
    || codeFile(`.next/server/app${route}/${kind}.js`)) ? route || "/" : undefined;
}

export function logServerError(event: string, error: unknown, context: { requestId?: string; operation?: string; status?: number; digest?: string; route?: string } = {}) {
  const details = errorDetails(error);
  const chain = errorChain(error), origin = chain.at(-1) ?? error;
  const sourceFrames = [...new Set([...chain].reverse().flatMap(applicationFrames))].slice(0, 5);
  const fingerprint = createHash("sha256").update(origin instanceof Error ? origin.stack || origin.name : typeof origin).digest("hex").slice(0, 16);
  const safeLabel = (value: string | undefined) => value && /^[a-zA-Z0-9_.:[\]/-]{1,100}$/.test(value) ? value : undefined;
  const entry = {
    timestamp: new Date().toISOString(), level: "error", event: safeLabel(event) || "server.error",
    requestId: context.requestId && /^[a-f0-9-]{36}$/.test(context.requestId) ? context.requestId : randomUUID(),
    operation: safeLabel(context.operation), status: Number.isInteger(context.status) && context.status! >= 100 && context.status! <= 599 ? context.status : undefined,
    digest: context.digest && /^[a-zA-Z0-9_-]{1,80}$/.test(context.digest) ? context.digest : undefined,
    route: routeTemplate(context.route),
    environment: ["production", "preview", "development"].includes(process.env.VERCEL_ENV || "") ? process.env.VERCEL_ENV : undefined,
    commit: /^[a-f0-9]{40}$/.test(process.env.VERCEL_GIT_COMMIT_SHA || "") ? process.env.VERCEL_GIT_COMMIT_SHA : undefined,
    deploymentId: /^dpl_[a-zA-Z0-9]{12,64}$/.test(process.env.VERCEL_DEPLOYMENT_ID || "") ? process.env.VERCEL_DEPLOYMENT_ID : undefined,
    ...details, errorKind: errorKind(origin), ...(sourceFrames.length ? { sourceFrames } : {}), fingerprint,
  };
  console.error(JSON.stringify(entry));
  return entry.requestId;
}
