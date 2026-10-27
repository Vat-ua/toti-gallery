import { parseArgs } from "node:util";
import { config } from "dotenv";
import { assertDatabaseTarget } from "../src/lib/database-target.cjs";

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    "env-file": { type: "string" }, production: { type: "boolean" }, origin: { type: "string" }, database: { type: "string" }, name: { type: "string" }, email: { type: "string" }, actor: { type: "string" }, turma: { type: "string" },
  } });
  const loaded = config({ path: values["env-file"] || ".env.local", override: true, quiet: true });
  if (loaded.error) throw new Error("The selected environment file is unavailable.");
  delete process.env.GALLERY_ALLOW_PRODUCTION_DATABASE;
  delete process.env.VERCEL_ENV;
  if (values.production) {
    if (!values["env-file"] || process.env.GALLERY_DATABASE_ENV !== "operations") throw new Error("Use --production with an explicit operations environment file.");
    process.env.GALLERY_ALLOW_PRODUCTION_DATABASE = "1";
  }
  if (values.origin) process.env.BETTER_AUTH_URL = values.origin;
  if (!values.database || !values.email) throw new Error("Use --database EXACT_DATABASE_NAME --email EMAIL; bootstrap/add-student also require --name.");
  const { pool, db } = await import("../src/db/index");
  try {
    await assertDatabaseTarget(pool, process.env, values.production ? "operations" : "development");
    const actual = (await pool.query("SELECT current_database() AS name")).rows[0].name;
    if (actual !== values.database) throw new Error("The connected database does not match --database. No changes made.");
    const { eq } = await import("drizzle-orm");
    const { users, turmas } = await import("../src/db/schema");
    const { bootstrapAdmin, provisionStudent } = await import("../src/lib/admin-provision");
    const { createAccessLink } = await import("../src/lib/access-links");
    let grant;
    if (positionals[0] === "bootstrap") {
      grant = await bootstrapAdmin(values.name || "", values.email);
    } else {
      if (!values.actor) throw new Error("Use --actor ADMIN_EMAIL for this operation.");
      const [actor] = await db.select({ id: users.id }).from(users).where(eq(users.email, values.actor.trim().toLowerCase())).limit(1);
      if (!actor) throw new Error("Administrator not found.");
      if (positionals[0] === "add-student") {
        const [turma] = await db.select({ id: turmas.id }).from(turmas).where(eq(turmas.name, values.turma || "")).limit(1);
        if (!turma) throw new Error("Use --turma with an existing turma name.");
        const student = await provisionStudent(actor.id, values.name || "", values.email, turma.id);
        if (student.status !== "pending") { console.log("Existing active account retained; membership added. No activation link needed."); return; }
        grant = await createAccessLink(actor.id, student.id, "activation");
      } else {
        if (!["activation-link", "reset-link"].includes(positionals[0])) throw new Error("Commands: bootstrap, add-student, activation-link, reset-link.");
        const [target] = await db.select({ id: users.id }).from(users).where(eq(users.email, values.email.trim().toLowerCase())).limit(1);
        if (!target) throw new Error("User not found.");
        grant = await createAccessLink(actor.id, target.id, positionals[0] === "activation-link" ? "activation" : "password_reset");
      }
    }
    console.log("Send this single-use link privately to the intended email. Do not save it in project notes or shared logs.");
    console.log(grant.url);
    console.log(`Expires: ${grant.expiresAt.toISOString()}`);
  } finally { await pool.end(); }
}

main().catch(error => { console.error(error instanceof Error && !('query' in error) && !('detail' in error) ? error.message : "Database operation failed; no connection details are printed."); process.exitCode = 1; });
