import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import * as schema from "../../src/db/schema";
import { assertDatabaseTarget } from "../../src/lib/database-target.cjs";

export const fixturePath = "tmp/smoke/fixture.private.json";
export type SmokeFixture = { studentId: string; adminId: string; turmaId: string; email: string; adminEmail: string; password: string; projectId: string; slug: string };
export function fixture(): SmokeFixture { return JSON.parse(readFileSync(fixturePath, "utf8")); }

export default async function setup() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
  try {
    await assertDatabaseTarget(pool, process.env, "test");
    // Never schema-push or reset a populated test copy. This suite owns an empty DB.
    const existing = await pool.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' LIMIT 1");
    if (existing.rowCount) throw new Error("Smoke setup requires an empty disposable database; it will not reset existing data.");
    const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema));
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const statement of statements) await client.query(statement);
      const data: SmokeFixture = { studentId: randomUUID(), adminId: randomUUID(), turmaId: randomUUID(), email: "smoke-student@example.invalid", adminEmail: "smoke-admin@example.invalid", password: `Smoke-${randomBytes(24).toString("hex")}`, projectId: randomUUID(), slug: "smoke-project" };
      await client.query("INSERT INTO gallery_turmas(id,name,number,course_name,start_year) VALUES($1,'Turma 900001',900001,'Smoke course',2026)", [data.turmaId]);
      for (const [id, email, role] of [[data.studentId, data.email, "user"], [data.adminId, data.adminEmail, "admin"]]) {
        await client.query("INSERT INTO gallery_users(id,name,email,role,status,email_verified) VALUES($1,$2,$3,$4,'active',true)", [id, role === "user" ? "Estudante smoke" : "Administrador smoke", email, role]);
        await client.query("INSERT INTO gallery_auth_accounts(id,user_id,account_id,provider_id,password) VALUES($1,$2,$2,'credential',$3)", [randomUUID(), id, await hashPassword(data.password)]);
      }
      await client.query("INSERT INTO gallery_turma_members(turma_id,user_id) VALUES($1,$2)", [data.turmaId, data.studentId]);
      await client.query("INSERT INTO gallery_projects(id,slug,title,description,technologies,github_url,author_id,turma_id,is_final) VALUES($1,$2,'Projeto smoke inicial','Uma descrição sintética para verificar a galeria e a página do projeto.','[\"React\"]','https://github.com/example/smoke',$3,$4,true)", [data.projectId, data.slug, data.studentId, data.turmaId]);
      await client.query("INSERT INTO gallery_project_authors(project_id,user_id) VALUES($1,$2)", [data.projectId, data.studentId]);
      await client.query("COMMIT");
      mkdirSync("tmp/smoke", { recursive: true, mode: 0o700 });
      writeFileSync(fixturePath, JSON.stringify(data), { mode: 0o600 });
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  } finally { await pool.end(); }
  // The disposable DB is discarded by CI (or its explicit local owner).
  // No teardown with broad DELETE/TRUNCATE or cloud operations is necessary.
}
