import test from "node:test";
import assert from "node:assert/strict";
import { parseStudents } from "../src/lib/student-import";
import { canManageAccount } from "../src/lib/permissions";

test("spreadsheet and CSV input preserve quoted names and normalize identity", () => {
  assert.deepEqual(parseStudents('Email;Nome\n ANA@EXAMPLE.COM ;"Ana; Silva"'), [{ line: 2, name: "Ana; Silva", email: "ana@example.com", error: undefined }]);
  assert.equal(parseStudents('Nome\tEmail\nAna Souza\tana@example.com')[0].email, "ana@example.com");
  assert.equal(parseStudents('"Silva, Ana",ana@example.com')[0].name, "Silva, Ana");
  assert.equal(parseStudents('"Ana ""A"" Souza",ana@example.com')[0].name, 'Ana "A" Souza');
  assert.equal(parseStudents('\uFEFFNome,Email\r\nAna Souza,ana@example.com\r\n').length, 1);
});
test("imports surface per-row errors and reject malformed or excessive input", () => {
  const rows = parseStudents('Nome,Email\nAna,ANA@example.com\nAna,ana@example.com\nJ,invalid\nAna,ana@example.com,extra');
  assert.equal(rows[0].error, undefined);
  assert.match(rows[1].error!, /repetido/);
  assert.ok(rows[2].error); assert.ok(rows[3].error);
  assert.throws(() => parseStudents('Nome,Email\n"Ana,ana@example.com'), /aspas/);
  assert.throws(() => parseStudents('Nome,Email'), /não contém/);
  assert.throws(() => parseStudents(Array.from({ length: 501 }, (_,i) => `Student ${i},student${i}@example.com`).join('\n')), /500/);
});
test("staff privileges do not let an administrator manage another staff account", () => {
  const admin = { id: "a", role: "admin" as const, status: "active", isDemo: false };
  assert.equal(canManageAccount(admin, { role: "user" }), true);
  assert.equal(canManageAccount(admin, { role: "owner" }), false);
  assert.equal(canManageAccount(admin, { role: "admin" }), false);
  assert.equal(canManageAccount({ ...admin, role: "owner" }, { role: "admin" }), true);
  assert.equal(canManageAccount({ ...admin, status: "suspended" }, { role: "user" }), false);
  assert.equal(canManageAccount({ ...admin, isDemo: true }, { role: "user" }), false);
});
