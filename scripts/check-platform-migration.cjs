/* Creates and removes only its own temporary database. Source data is read-only. */
require("dotenv").config({ path: ".env.local", quiet: true });
const assert = require("node:assert/strict");
const { createHash, randomBytes } = require("node:crypto");
const fs = require("node:fs");
const { schemaContract } = require("./lib/schema-contract.cjs");
const { Client } = require("pg");
const { assertRuntimeTarget, assertDatabaseTarget } = require("../src/lib/database-target.cjs");

const migrationPath = "migrations/20261026_stage1_platform_foundation.sql";
const tables = ["gallery_users", "gallery_projects", "gallery_project_authors", "gallery_sessions", "gallery_likes"];
const quote = name => '"' + name.replaceAll('"', '""') + '"';
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const canonicalRows = rows => rows.map(row => JSON.stringify(row)).sort();
const report = { checks: [], sourceUnchanged: false, testDatabaseRemoved: false };
const mark = message => { report.checks.push(message); console.log(message); };

async function snapshot(client) {
  const result = {};
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    for (const table of tables) {
      const columns = (await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position", [table])).rows;
      assert.ok(columns.length, `Missing source table: ${table}`);
      result[table] = { columns, rows: (await client.query(`SELECT * FROM ${quote(table)}`)).rows };
    }
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

function fingerprints(data) {
  return Object.fromEntries(tables.map(table => [table, digest(canonicalRows(data[table].rows))]));
}

async function originalData(client, source) {
  const result = {};
  for (const table of tables) {
    const columns = source[table].columns;
    result[table] = { columns, rows: (await client.query(`SELECT ${columns.map(c => quote(c.column_name)).join(",")} FROM ${quote(table)}`)).rows };
  }
  return fingerprints(result);
}

async function rejected(client, query, values, expectedCodes) {
  await client.query("SAVEPOINT expected_rejection");
  let code;
  try { await client.query(query, values); } catch (error) { code = error.code; }
  await client.query("ROLLBACK TO SAVEPOINT expected_rejection");
  await client.query("RELEASE SAVEPOINT expected_rejection");
  assert.ok(expectedCodes.includes(code), `Expected rejection ${expectedCodes.join("/")}; received ${code || "success"}`);
}


async function run() {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required; its contents are never printed");
  const sourceUrl = process.env.DATABASE_URL;
  assertRuntimeTarget(sourceUrl);
  assert.equal(process.env.GALLERY_DATABASE_ENV, "test", "Legacy migration checks require a temporary test branch");
  const databaseName = `gallery_platform_test_${Date.now()}_${randomBytes(4).toString("hex")}`;
  assert.match(databaseName, /^gallery_platform_test_\d+_[a-f0-9]{8}$/);
  const testUrl = new URL(sourceUrl);
  testUrl.pathname = "/" + databaseName;
  assert.notEqual(testUrl.pathname, new URL(sourceUrl).pathname);
  const source = new Client({ connectionString: sourceUrl });
  const test = new Client({ connectionString: testUrl.toString() });
  report.testDatabase = databaseName;
  let created = false;
  let sourceConnected = false;
  let testConnected = false;
  let before;
  let failure;
  try {
    await source.connect(); sourceConnected = true;
    await assertDatabaseTarget(source, process.env, "test");
    before = await snapshot(source);
    report.sourceCounts = Object.fromEntries(tables.map(table => [table, before[table].rows.length]));
    await source.query(`CREATE DATABASE ${quote(databaseName)}`); created = true;
    await test.connect(); testConnected = true;
    assert.equal((await test.query("SELECT current_database() AS name")).rows[0].name, databaseName);

    await test.query(fs.readFileSync("migrations/fixtures/legacy-schema.sql", "utf8"));
    for (const table of tables) {
      const { columns, rows } = before[table];
      for (const row of rows) {
        const values = columns.map(c => ["json", "jsonb"].includes(c.data_type) ? JSON.stringify(row[c.column_name]) : row[c.column_name]);
        await test.query(`INSERT INTO ${quote(table)} (${columns.map(c => quote(c.column_name)).join(",")}) VALUES (${columns.map((_, i) => "$" + (i + 1)).join(",")})`, values);
      }
    }
    assert.equal(digest(await originalData(test, before)), digest(fingerprints(before)), "Copied rows differ from the source");
    mark("Copied the existing database rows into an isolated database without saving secrets to disk");

    const fixtureHash = "legacy-fixture-salt:legacy-fixture-key";
    await test.query(`INSERT INTO gallery_users(id,name,email,password_hash,cohort,year) VALUES
      ('fixture-admin','Fixture Admin','platform-admin@example.invalid',$1,'Fixture Turma A',2025),
      ('fixture-student','Fixture Student','platform-student@example.invalid',$1,'Fixture Turma A',2026),
      ('fixture-other','Fixture Other','platform-other@example.invalid',$1,'Fixture Turma B',2026)`, [fixtureHash]);
    await test.query(`INSERT INTO gallery_projects(id,slug,title,description,technologies,github_url,author_id,is_final)
      VALUES ('fixture-project','fixture-project','Fixture project','A shared project used only for migration checks.','["React"]','https://github.com','fixture-admin',true)`);
    await test.query("INSERT INTO gallery_project_authors(project_id,user_id) VALUES ('fixture-project','fixture-admin'),('fixture-project','fixture-student')");
    await test.query("INSERT INTO gallery_likes(project_id,visitor_key) VALUES ('fixture-project','fixture-visitor')");
    await test.query("INSERT INTO gallery_sessions(token,user_id,expires_at) VALUES ('fixture-legacy-session','fixture-admin',now()+interval '1 day')");
    const legacy = await snapshot(test);
    const migration = fs.readFileSync(migrationPath, "utf8");

    // An invalid identity must abort the whole migration, not merge users.
    await test.query("INSERT INTO gallery_users(id,name,email,password_hash,cohort,year) VALUES ('fixture-duplicate','Duplicate','PLATFORM-ADMIN@example.invalid',$1,'Fixture Turma A',2025)", [fixtureHash]);
    let preflightRejected = false;
    try { await test.query(migration); } catch (error) { preflightRejected = error.code === "P0001"; }
    await test.query("ROLLBACK");
    assert.ok(preflightRejected, "Duplicate normalized email was not rejected");
    assert.equal((await test.query("SELECT to_regclass('gallery_turmas') AS name")).rows[0].name, null);
    await test.query("DELETE FROM gallery_users WHERE id='fixture-duplicate'");
    assert.equal(digest(await originalData(test, legacy)), digest(fingerprints(legacy)), "Failed migration changed existing data");
    mark("Ambiguous email identities abort atomically without merging or losing data");

    await test.query(migration);
    assert.equal(digest(await originalData(test, legacy)), digest(fingerprints(legacy)), "Migration changed a legacy value");
    assert.equal((await test.query("SELECT count(*)::int AS n FROM gallery_users WHERE role <> 'user' OR status <> 'active' OR email_verified")).rows[0].n, 0);
    assert.equal((await test.query(`SELECT count(*)::int AS n FROM gallery_users u
      LEFT JOIN gallery_turma_members m ON m.user_id=u.id LEFT JOIN gallery_turmas t ON t.id=m.turma_id
      WHERE t.name=u.cohort AND m.joined_at=u.created_at`)).rows[0].n, legacy.gallery_users.rows.length);
    assert.equal((await test.query(`SELECT count(*)::int AS n FROM gallery_projects p JOIN gallery_users u ON u.id=p.author_id
      JOIN gallery_turmas t ON t.id=p.turma_id WHERE t.name=u.cohort AND p.visibility='published'`)).rows[0].n, legacy.gallery_projects.rows.length);
    for (const table of ["gallery_auth_accounts", "gallery_auth_sessions", "gallery_auth_verifications", "gallery_invitations"]) {
      assert.equal((await test.query(`SELECT count(*)::int AS n FROM ${quote(table)}`)).rows[0].n, 0);
    }
    const conflicts = (await test.query(`SELECT count(*)::int AS n FROM (
      SELECT cohort FROM gallery_users GROUP BY cohort HAVING count(DISTINCT year)>1
    ) t`)).rows[0].n;
    report.unresolvedTurmaYearsIncludingFixture = conflicts;
    report.sourceTurmasWithConflictingYears = [...new Set(before.gallery_users.rows.map(row => row.cohort))].filter(cohort =>
      new Set(before.gallery_users.rows.filter(row => row.cohort === cohort).map(row => row.year)).size > 1).length;
    assert.equal((await test.query("SELECT graduation_year FROM gallery_turmas WHERE name='Fixture Turma A'")).rows[0].graduation_year, null);
    assert.equal((await test.query("SELECT count(*)::int AS n FROM gallery_turmas WHERE name IN ('Turma 25','Turma 24','Turma 23','Turma 22','Turma 21')")).rows[0].n, 5);
    mark("Preserved every original column, user ID, hash, session, project, author link and like; backfilled turmas and memberships");

    let reapplyRejected = false;
    try { await test.query(migration); } catch (error) { reapplyRejected = error.code === "42P07"; }
    await test.query("ROLLBACK");
    assert.ok(reapplyRejected, "An accidental second application was not rejected");
    assert.equal(digest(await originalData(test, legacy)), digest(fingerprints(legacy)));
    mark("Accidental migration reapplication is rejected without changing data");

    // Compare the actual migrated schema with a fresh export of the target model.
    await test.query("CREATE SCHEMA schema_contract");
    await test.query("SET search_path TO schema_contract");
    await test.query(fs.readFileSync("migrations/fixtures/stage1-schema.sql", "utf8").replaceAll('"public".', '"schema_contract".'));
    await test.query("SET search_path TO public");
    const actual = await schemaContract(test, "public");
    const expected = await schemaContract(test, "schema_contract");
    assert.equal(digest(actual.columns), digest(expected.columns), "Migrated columns differ from target schema");
    assert.equal(digest(actual.constraints), digest(expected.constraints), "Migrated constraints differ from target schema");
    assert.equal(digest(actual.indexes), digest(expected.indexes), "Migrated indexes differ from target schema");
    mark("SQL migration matches the target Drizzle columns, defaults, constraints, foreign keys and indexes");

    await test.query("BEGIN");
    await test.query("UPDATE gallery_users SET role='admin' WHERE id='fixture-admin'");
    const turmaA = (await test.query("SELECT id FROM gallery_turmas WHERE name='Fixture Turma A'")).rows[0].id;
    const turmaB = (await test.query("SELECT id FROM gallery_turmas WHERE name='Fixture Turma B'")).rows[0].id;
    await test.query("INSERT INTO gallery_turma_members(turma_id,user_id) VALUES ($1,'fixture-student')", [turmaB]);
    assert.equal((await test.query("SELECT count(*)::int AS n FROM gallery_turma_members WHERE user_id='fixture-student'")).rows[0].n, 2);
    await rejected(test, "INSERT INTO gallery_turma_members(turma_id,user_id) VALUES ($1,'fixture-student')", [turmaB], ["23505"]);
    const credits = (await test.query("SELECT * FROM gallery_project_authors WHERE project_id='fixture-project' ORDER BY user_id")).rows;
    await test.query("UPDATE gallery_turmas SET archived_at=now(), name='Archived fixture turma' WHERE id=$1", [turmaA]);
    await test.query("DELETE FROM gallery_turma_members WHERE turma_id=$1 AND user_id='fixture-student'", [turmaA]);
    assert.equal(digest((await test.query("SELECT * FROM gallery_project_authors WHERE project_id='fixture-project' ORDER BY user_id")).rows), digest(credits));
    assert.equal((await test.query("SELECT turma_id FROM gallery_projects WHERE id='fixture-project'")).rows[0].turma_id, turmaA);
    await test.query(`INSERT INTO gallery_projects(id,slug,title,description,technologies,github_url,author_id,turma_id)
      VALUES ('fixture-alumni-project','fixture-alumni-project','Alumni project','An archived turma still accepts its members projects.','["React"]','https://github.com','fixture-admin',$1)`, [turmaA]);
    await rejected(test, "DELETE FROM gallery_turmas WHERE id=$1", [turmaA], ["23503", "23001"]);
    await rejected(test, "DELETE FROM gallery_users WHERE id='fixture-admin'", [], ["23503", "23001"]);
    mark("Multiple turmas work; archiving, renaming and changing membership preserve project turma and authors; archived-turma publications remain possible");

    await test.query("INSERT INTO gallery_users(id,name,email) VALUES ('fixture-pending','Pending student','platform-pending@example.invalid')");
    const pending = (await test.query("SELECT role,status,email_verified,password_hash FROM gallery_users WHERE id='fixture-pending'")).rows[0];
    assert.equal(digest(pending), digest({ role: "user", status: "pending", email_verified: false, password_hash: null }));
    await test.query(`INSERT INTO gallery_auth_accounts(id,user_id,account_id,provider_id) VALUES
      ('fixture-google','fixture-pending','fixture-google-subject','google')`);
    await test.query("UPDATE gallery_users SET status='active',email_verified=true WHERE id='fixture-pending'");
    await test.query("INSERT INTO gallery_auth_accounts(id,user_id,account_id,provider_id,password) VALUES ('fixture-credential','fixture-pending','fixture-pending','credential',$1)", [fixtureHash]);
    assert.equal((await test.query("SELECT count(DISTINCT user_id)::int AS n FROM gallery_auth_accounts WHERE user_id='fixture-pending'")).rows[0].n, 1);
    await rejected(test, "INSERT INTO gallery_auth_accounts(id,user_id,account_id,provider_id) VALUES ('fixture-stolen','fixture-other','fixture-google-subject','google')", [], ["23505"]);
    await rejected(test, "INSERT INTO gallery_auth_accounts(id,user_id,account_id,provider_id) VALUES ('fixture-wrong-credential','fixture-other','fixture-pending','credential')", [], ["23514"]);
    await rejected(test, "INSERT INTO gallery_users(id,name,email) VALUES ('fixture-email-case','Case duplicate',' PLATFORM-PENDING@EXAMPLE.INVALID ')", [], ["23505"]);
    await rejected(test, "UPDATE gallery_users SET role='superadmin' WHERE id='fixture-pending'", [], ["23514"]);
    await rejected(test, "UPDATE gallery_users SET status='graduated' WHERE id='fixture-pending'", [], ["23514"]);
    mark("The model supports a passwordless Google identity and optional credentials on one existing user; uniqueness and role/status constraints hold (SQL only, not OAuth)");

    const tokenHash = createHash("sha256").update(randomBytes(32)).digest("hex");
    await test.query(`INSERT INTO gallery_invitations(id,user_id,created_by,purpose,token_hash,expires_at)
      VALUES ('fixture-invite','fixture-pending','fixture-admin','password_reset',$1,now()+interval '1 day')`, [tokenHash]);
    await rejected(test, "UPDATE gallery_invitations SET token_hash='raw-secret' WHERE id='fixture-invite'", [], ["23514"]);
    await rejected(test, "UPDATE gallery_invitations SET expires_at=created_at WHERE id='fixture-invite'", [], ["23514"]);
    await rejected(test, "UPDATE gallery_invitations SET purpose='bulk_email' WHERE id='fixture-invite'", [], ["23514"]);
    await rejected(test, "UPDATE gallery_invitations SET consumed_at=now(),revoked_at=now() WHERE id='fixture-invite'", [], ["23514"]);
    await test.query("UPDATE gallery_invitations SET consumed_at=now() WHERE id='fixture-invite'");
    await rejected(test, "UPDATE gallery_projects SET visibility='hidden' WHERE id='fixture-project'", [], ["23514"]);
    await test.query("UPDATE gallery_projects SET visibility='hidden', moderation_reason='Fixture moderation', moderated_by='fixture-admin', moderated_at=now() WHERE id='fixture-project'");
    await test.query("UPDATE gallery_users SET status='suspended' WHERE id='fixture-student'");
    assert.equal(digest((await test.query("SELECT * FROM gallery_project_authors WHERE project_id='fixture-project' ORDER BY user_id")).rows), digest(credits));
    await test.query("UPDATE gallery_projects SET visibility='published' WHERE id='fixture-project'");
    await test.query("ROLLBACK");
    mark("Invitation hash/expiry/lifecycle and reversible moderation constraints hold; suspension preserves credits");
    report.passed = true;
  } catch (error) {
    failure = error;
    report.passed = false;
    // Do not print database URLs, rows, passwords, tokens, or PostgreSQL DETAIL.
    report.failure = { code: error.code || "CHECK_FAILED", message: error.code ? "Database operation failed" : error.message };
  } finally {
    if (testConnected) { await test.query("ROLLBACK").catch(() => {}); await test.end(); }
    if (sourceConnected) {
      try {
        if (created) {
          assert.match(databaseName, /^gallery_platform_test_\d+_[a-f0-9]{8}$/);
          assert.notEqual(databaseName, new URL(sourceUrl).pathname.slice(1));
          // Neon pooled connections may outlive Client.end(). FORCE is scoped
          // strictly to the exact random database created by this invocation.
          await source.query(`DROP DATABASE ${quote(databaseName)} WITH (FORCE)`);
          report.testDatabaseRemoved = true;
        }
      } catch (error) { failure ||= error; report.passed = false; report.cleanupFailure = error.code || "Cleanup failed"; }
      try {
        if (before) {
          report.sourceUnchanged = digest(fingerprints(before)) === digest(fingerprints(await snapshot(source)));
          assert.ok(report.sourceUnchanged, "Source rows changed since the read-only snapshot");
        }
      } catch (error) { failure ||= error; report.passed = false; report.sourceComparisonFailure = error.code || "Source comparison failed"; }
      await source.end();
    }
    fs.mkdirSync("tmp/platform-foundation-review", { recursive: true });
    fs.writeFileSync("tmp/platform-foundation-review/report.json", JSON.stringify(report, null, 2) + "\n");
  }
  console.log(JSON.stringify(report, null, 2));
  if (failure) process.exitCode = 1;
}

run().catch(error => { console.error(error.code || "Migration check could not start"); process.exitCode = 1; });
