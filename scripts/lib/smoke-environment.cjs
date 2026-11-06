const fs = require("node:fs");
const { randomBytes } = require("node:crypto");
const { parse } = require("dotenv");
const { assertRuntimeTarget } = require("../../src/lib/database-target.cjs");
const origin = "http://127.0.0.1:3102";

function smokeEnvironment() {
  const file = process.env.GALLERY_SMOKE_ENV_FILE || ".env.smoke";
  const source = fs.existsSync(file) ? parse(fs.readFileSync(file)) : process.env.CI && process.env.GALLERY_LOCAL_TEST_DATABASE === "1" ? process.env : null;
  if (!source || source.GALLERY_DATABASE_ENV !== "test" || !/^gallery_test_[a-z0-9_]+$/.test(source.DATABASE_NAME || "")
    || source.VERCEL_ENV || source.GALLERY_ALLOW_PRODUCTION_DATABASE) throw new Error("Smoke tests require an explicit, empty gallery_test_* database. See docs/testing.md.");
  const env = { ...process.env };
  for (const key of ["DATABASE_URL", "DATABASE_NAME", "GALLERY_DATABASE_ENV", "GALLERY_LOCAL_TEST_DATABASE", "NEON_PROJECT_ID", "NEON_BRANCH_ID", "NEON_ENDPOINT_ID"]) env[key] = source[key] || "";
  // Next loads .env.local even for a production build. Explicit empty values
  // prevent inheriting development/cloud credentials into the smoke server.
  for (const key of ["VERCEL_ENV", "VERCEL", "GALLERY_ALLOW_PRODUCTION_DATABASE", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "AWS_ENDPOINT_URL_S3", "AWS_REGION", "GALLERY_IMAGE_BUCKET"]) env[key] = "";
  env.GALLERY_SMOKE_AUTH_SECRET = process.env.GALLERY_SMOKE_AUTH_SECRET || randomBytes(48).toString("base64url");
  env.BETTER_AUTH_SECRET = env.GALLERY_SMOKE_AUTH_SECRET;
  env.BETTER_AUTH_URL = origin;
  assertRuntimeTarget(env.DATABASE_URL, env);
  return env;
}
module.exports = { smokeEnvironment, origin };
