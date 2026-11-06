import { createHash, randomUUID } from "node:crypto";

const networkCodes = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "EPIPE", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET"]);
const unavailableDatabaseCodes = new Set(["53300", "53400", "57014", "57P01", "57P02", "57P03", "55P03", "40P01", "40001", "25P03"]);
const storageNames = new Set(["SlowDown", "ServiceUnavailable", "RequestTimeout", "TimeoutError", "AccessDenied", "NoSuchBucket", "NoSuchKey"]);

/** Never serialize messages, stacks, SQL, bodies, headers, URLs or arbitrary metadata. */
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

export function logServerError(event: string, error: unknown, context: { requestId?: string; operation?: string; status?: number; digest?: string } = {}) {
  const details = errorDetails(error);
  let origin = error;
  const seen = new Set<unknown>();
  for (let depth = 0; origin instanceof Error && origin.cause && !seen.has(origin) && depth < 6; depth++) {
    seen.add(origin); origin = origin.cause;
  }
  const fingerprint = createHash("sha256").update(origin instanceof Error ? origin.stack || origin.name : typeof origin).digest("hex").slice(0, 16);
  const safeLabel = (value: string | undefined) => value && /^[a-zA-Z0-9_.:[\]/-]{1,100}$/.test(value) ? value : undefined;
  const entry = {
    timestamp: new Date().toISOString(), level: "error", event: safeLabel(event) || "server.error",
    requestId: context.requestId && /^[a-f0-9-]{36}$/.test(context.requestId) ? context.requestId : randomUUID(),
    operation: safeLabel(context.operation), status: Number.isInteger(context.status) && context.status! >= 100 && context.status! <= 599 ? context.status : undefined,
    digest: context.digest && /^[a-zA-Z0-9_-]{1,80}$/.test(context.digest) ? context.digest : undefined,
    ...details, fingerprint,
  };
  console.error(JSON.stringify(entry));
  return entry.requestId;
}
