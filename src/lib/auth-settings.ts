export function authSettings() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith("REPLACE_")) throw new Error("Set BETTER_AUTH_SECRET to a random secret of at least 32 characters.");
  if (process.env.NODE_ENV === "production" && !process.env.BETTER_AUTH_URL) throw new Error("Set BETTER_AUTH_URL to the exact deployment origin.");
  const url = new URL(process.env.BETTER_AUTH_URL || "http://localhost:3101");
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("BETTER_AUTH_URL must be the exact application origin.");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw new Error("Authentication requires HTTPS outside localhost.");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (Boolean(clientId) !== Boolean(clientSecret)) throw new Error("Configure both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither.");
  return { secret, baseURL: url.origin, google: clientId && clientSecret ? { clientId, clientSecret } : undefined };
}

export function safeNextPath(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !/[\u0000-\u001f]/.test(value) && !value.startsWith("/entrar") && !value.startsWith("/api/") ? value : "/meus-projetos";
}
