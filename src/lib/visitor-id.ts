export const VISITOR_COOKIE = "toti_visitor";
export const isVisitorId = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9-]{36}$/.test(value);
