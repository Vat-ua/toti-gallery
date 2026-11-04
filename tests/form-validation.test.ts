import { test } from "node:test";
import assert from "node:assert/strict";
import { validateProject, validateCoauthorIds, validateProjectTurma } from "../src/lib/validation";
import { validateProfile, validatePasswordChange } from "../src/lib/account";
import { FormValidationError, identityErrors, responseError, turmaErrors } from "../src/lib/form-validation";

const project = { title: "Projeto de teste", description: "Uma descrição do projeto com mais de trinta caracteres.", technologies: ["React"], githubUrl: "https://github.com/example/project" };
function fields(check: () => unknown) {
  try { check(); assert.fail("Expected field validation to fail"); }
  catch (error) { assert(error instanceof FormValidationError); return Object.keys(error.fieldErrors).filter(key => error.fieldErrors[key]); }
}

test("project reports independent field errors together and rejects unsupported technologies", () => {
  assert.deepEqual(fields(() => validateProject({ ...project, title: " ", description: "short", technologies: ["unknown"], githubUrl: "" })), ["title", "description", "technologies", "githubUrl"]);
  assert.deepEqual(fields(() => validateProject({ ...project, technologies: ["React", 123] })), ["technologies"]);
  assert.deepEqual(fields(() => validateCoauthorIds({ coauthorIds: [null] })), ["coauthorIds"]);
});

test("profile and project use the same HTTPS, GitHub host, and credential rules", () => {
  for (const github of ["http://github.com/example", "https://github.com.evil.test/example", "https://user:secret@github.com/example", 123]) {
    assert.deepEqual(fields(() => validateProject({ ...project, githubUrl: github })), ["githubUrl"]);
    assert.deepEqual(fields(() => validateProfile({ name: "Pessoa", bio: "", avatar: null, github })), ["github"]);
  }
  assert.deepEqual(fields(() => validateProject({ ...project, liveUrl: "http://example.test" })), ["liveUrl"]);
  const valid = validateProject({ ...project, title: " Projeto ", liveUrl: " https://example.test " });
  assert.equal(valid.title, "Projeto"); assert.equal(valid.liveUrl, "https://example.test/");
  assert.equal(validateProfile({ name: " Pessoa ", bio: "", avatar: null, github: " " }).github, null);
});

test("password errors identify the correct fields without including submitted passwords", () => {
  assert.deepEqual(fields(() => validatePasswordChange({ currentPassword: "", newPassword: "short", confirmPassword: "different" })), ["currentPassword", "newPassword", "confirmPassword"]);
  const password = "a sufficiently long password";
  assert.deepEqual(fields(() => validatePasswordChange({ currentPassword: password, newPassword: password, confirmPassword: password })), ["newPassword"]);
  assert.deepEqual(validatePasswordChange({ currentPassword: "old", newPassword: password, confirmPassword: password }), { currentPassword: "old", newPassword: password });
});

test("admin input rules and response parsing preserve field errors and general failures", () => {
  assert(identityErrors(" ", "wrong").name); assert(identityErrors("Pessoa", "wrong").email);
  assert(turmaErrors({ number: 0, courseName: "A", startYear: 1999 }).startYear);
  assert(!Object.values(turmaErrors({ number: 58, courseName: "Full Stack", startYear: 2026 })).some(Boolean));
  const error = responseError({ error: "Revise", fieldErrors: { name: "Confira o nome.", ignored: 12 } }, "Falha");
  assert(error instanceof FormValidationError); assert.deepEqual(error.fieldErrors, { name: "Confira o nome." });
  assert.equal(responseError({ error: "Acesso restrito." }, "Falha").message, "Acesso restrito.");
  assert.equal(responseError(null, "Falha").message, "Falha");
});

test("server validators reject malformed JSON field types and respect description bounds", () => {
  for (const invalid of [null, false, [], {}]) {
    assert.deepEqual(fields(() => validateProject({ ...project, description: invalid })), ["description"]);
  }
  for (const length of [29, 6001]) assert.deepEqual(fields(() => validateProject({ ...project, description: "a".repeat(length) })), ["description"]);
  for (const length of [30, 6000]) assert.equal(validateProject({ ...project, description: "a".repeat(length) }).description.length, length);
  assert.deepEqual(fields(() => validateProject({ ...project, imageUrl: {}, turmaId: false, isFinal: "true" })), ["isFinal", "turmaId", "imageUrl"]);
  assert.deepEqual(fields(() => validateCoauthorIds({ coauthorIds: Array(201).fill("id") })), ["coauthorIds"]);
  const normalized = validateProject({ ...project, authorId: "someone-else", visibility: "hidden", likes: 1000 });
  for (const forbidden of ["authorId", "visibility", "likes"]) assert(!Object.hasOwn(normalized, forbidden));
});

test("turma selection is checked against server-authorized memberships", () => {
  assert.equal(validateProjectTurma(undefined, ["turma-58", "turma-51"]), "turma-58");
  assert.equal(validateProjectTurma("turma-51", ["turma-58", "turma-51"]), "turma-51");
  for (const value of ["other-turma", false, null, {}]) assert.deepEqual(fields(() => validateProjectTurma(value, ["turma-58"])), ["turmaId"]);
  assert.deepEqual(fields(() => validateProjectTurma("turma-58", [])), ["turmaId"]);
});
