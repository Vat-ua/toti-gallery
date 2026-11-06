import { test } from "node:test";
import assert from "node:assert/strict";
import { profileSlugBase } from "../src/lib/profile-slug";

test("profile addresses normalize names without email or permanent identifiers", () => {
  assert.equal(profileSlugBase("  João da Conceição  "), "joao-da-conceicao");
  assert.equal(profileSlugBase("Ana Souza"), "ana-souza");
  assert.equal(profileSlugBase("Ana___2"), "ana-2");
  assert.equal(profileSlugBase("中文"), "pessoa");
  assert.equal(profileSlugBase("---"), "pessoa");
  assert.equal(profileSlugBase("A".repeat(100)), "a".repeat(80));
});
