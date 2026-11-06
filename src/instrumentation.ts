import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (error, _request, context) => {
  const { logServerError } = await import("./lib/server-log");
  // Never include request.path, headers, cookies or query tokens.
  logServerError("next.request.failed", error, {
    operation: `${context.routerKind}.${context.routeType}`,
    digest: error && typeof error === "object" && "digest" in error && typeof error.digest === "string" ? error.digest : undefined,
  });
};
