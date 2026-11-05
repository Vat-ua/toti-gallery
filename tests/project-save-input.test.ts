import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { creationRequestId, expectedProjectVersion } from "../src/lib/project-save-input";
import { creationAttempt, finishCreationAttempt } from "../src/lib/project-creation-attempt";
const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
after(() => { if (original) Object.defineProperty(globalThis, "sessionStorage", original); else Reflect.deleteProperty(globalThis, "sessionStorage"); });

test("save guards require explicit well-formed IDs/versions", () => {
  const id = randomUUID(); assert.equal(creationRequestId(id.toUpperCase()), id); assert.equal(expectedProjectVersion(5), 5);
  for (const value of [undefined, null, {}, [], 1, "not-an-id"]) assert.throws(() => creationRequestId(value));
  for (const value of [undefined, null, {}, [], 0, -1, 1.5, "1", NaN, Infinity]) assert.throws(() => expectedProjectVersion(value));
});
test("creation identity survives remounts, stays owner-scoped and clears only after acknowledgement", () => {
  const data = new Map(); Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: { getItem: (key: string) => data.get(key), setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) } });
  const first = randomUUID(), second = randomUUID();
  assert.equal(creationAttempt("owner", first), first);
  assert.equal(creationAttempt("owner", second), first);
  assert.equal(creationAttempt("other", second), second);
  finishCreationAttempt("owner", second); assert.equal(creationAttempt("owner", second), first);
  finishCreationAttempt("owner", first); assert.equal(creationAttempt("owner", second), second);
  assert.deepEqual([...data.values()], [second, second]);
});
test("blocked browser storage retains the editor's in-memory attempt ID", () => {
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw new Error("Blocked storage"); } });
  const id = randomUUID(); assert.equal(creationAttempt("owner", id), id); assert.doesNotThrow(() => finishCreationAttempt("owner", id));
});
