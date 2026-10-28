import { PRODUCTION } from "./database-target.cjs";

export function storageSettings(env: Record<string, string | undefined> = process.env) {
  const production = env.VERCEL_ENV === "production";
  const branch = production ? PRODUCTION.branchId : env.NEON_BRANCH_ID;
  if (!branch || (!production && (branch === PRODUCTION.branchId || !["development", "test"].includes(env.GALLERY_DATABASE_ENV || "")))) throw new Error("Invalid storage environment");
  const endpoint = new URL(env.AWS_ENDPOINT_URL_S3 || "https://unconfigured.invalid");
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.port || endpoint.search || endpoint.hash || !["", "/"].includes(endpoint.pathname)
    || !endpoint.hostname.startsWith(branch + ".storage.") || !/^br-[a-z0-9-]+\.storage\.c-\d+\.us-east-1\.aws\.neon\.tech$/.test(endpoint.hostname)
    || env.AWS_REGION !== "us-east-1" || !env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || env.GALLERY_IMAGE_BUCKET !== "gallery-images") throw new Error("Storage must match the selected database branch");
  return { endpoint: endpoint.origin, branch, bucket: env.GALLERY_IMAGE_BUCKET, region: env.AWS_REGION,
    credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY } };
}
