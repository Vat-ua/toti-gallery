import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { updateAccountProfile, changeAccountPassword } from "../src/lib/account-client";
import { HttpError } from "../src/lib/http-client";
import { FormValidationError } from "../src/lib/form-validation";

const fetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetch; });
const values = { name: "Pessoa", bio: "Apresentação", github: "", linkedin: "", avatar: null };
const saved = { ...values, github: null, linkedin: null };
const passwords = { currentPassword: "Fixture current password", newPassword: "Fixture next password", confirmPassword: "Fixture next password" };
test("profile sends editable values and optional photo using multipart", async () => {
  const photo = new File(["fixture"], "avatar.png", { type: "image/png" });
  let requests = 0;
  globalThis.fetch = async (path, init) => {
    assert.equal(path, "/api/account"); assert.equal(init?.method, "PATCH"); assert.equal(init.headers, undefined); assert(init.body instanceof FormData);
    assert.deepEqual(JSON.parse(String(init.body.get("data"))), values);
    assert.equal(init.body.get("image"), requests++ ? null : photo);
    return Response.json({ user: { ...saved, id: "private-response-id", role: "user" } });
  };
  assert.deepEqual(await updateAccountProfile(values, photo), saved);
  assert.deepEqual(await updateAccountProfile(values), saved);
});
test("password sends exactly the three password fields and does not return session tokens to UI", async () => {
  globalThis.fetch = async (path, init) => {
    assert.equal(path, "/api/account/password"); assert.equal(init?.method, "POST");
    assert.deepEqual(init.headers, { "Content-Type": "application/json" }); assert.deepEqual(JSON.parse(String(init.body)), passwords);
    return Response.json({ token: "fixture-token", user: { id: "fixture-user" } });
  };
  assert.equal(await changeAccountPassword(passwords), undefined);
});
test("field errors remain structured and 401 remains distinguishable for UI navigation", async () => {
  globalThis.fetch = async () => Response.json({ fieldErrors: { currentPassword: "Senha atual incorreta" } }, { status: 400 });
  await assert.rejects(() => changeAccountPassword(passwords), error => error instanceof FormValidationError && error.fieldErrors.currentPassword === "Senha atual incorreta");
  globalThis.fetch = async () => Response.json({ error: "Entre novamente." }, { status: 401 });
  for (const operation of [() => updateAccountProfile(values), () => changeAccountPassword(passwords)]) {
    await assert.rejects(operation, error => error instanceof HttpError && error.status === 401 && error.message === "Entre novamente.");
  }
  globalThis.fetch = async () => new Response("not JSON", { status: 401 });
  await assert.rejects(() => updateAccountProfile(values), error => error instanceof HttpError && error.status === 401);
});
test("network and non-JSON failures have readable messages rather than parser errors", async () => {
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(() => updateAccountProfile(values), /Confira sua conexão/);
  for (const status of [200, 502]) {
    globalThis.fetch = async () => new Response("<html>upstream error</html>", { status });
    await assert.rejects(() => updateAccountProfile(values), /Não foi possível salvar seu perfil/);
    await assert.rejects(() => changeAccountPassword(passwords), /Não foi possível alterar sua senha/);
  }
});
test("malformed success payloads never masquerade as a saved profile or changed password", async () => {
  for (const user of [null, [], {}, { ...saved, name: 3 }, { ...saved, avatar: {} }, { ...saved, linkedin: undefined }]) {
    globalThis.fetch = async () => Response.json({ user });
    await assert.rejects(() => updateAccountProfile(values), /Não foi possível salvar seu perfil/);
  }
  for (const data of [{}, { user: null, token: null }, { user: { id: 3 }, token: "token" }, { user: { id: "id" }, token: 3 }]) {
    globalThis.fetch = async () => Response.json(data);
    await assert.rejects(() => changeAccountPassword(passwords), /Não foi possível alterar sua senha/);
  }
});
