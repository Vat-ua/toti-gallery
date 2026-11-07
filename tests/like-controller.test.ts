import { test } from "node:test";
import assert from "node:assert/strict";
import { createLikeController } from "../src/lib/like-controller";
import { LikeRequestError, type LikeState } from "../src/lib/likes-client";
function controlled() {
  const calls: { liked: boolean; resolve: (state: LikeState) => void; reject: (error: Error) => void }[] = [];
  const controller = createLikeController({ liked: false, likes: 7 }, liked => new Promise<LikeState>((resolve, reject) => { calls.push({ liked, resolve, reject }); }));
  return { controller, calls };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test("rapid like then unlike keeps the latest intent and only one request in flight", async () => {
  const { controller: c, calls } = controlled();
  c.toggle(); c.toggle(); assert.equal(calls.length, 1); assert.equal(c.getSnapshot().liked, false);
  calls[0].resolve({ liked: true, likes: 8 }); await tick();
  assert.equal(calls.length, 2); assert.equal(calls[1].liked, false);
  calls[1].resolve({ liked: false, likes: 7 }); await tick();
  assert.deepEqual(c.getSnapshot(), { liked: false, likes: 7, pending: false, error: null });
});
test("many rapid clicks coalesce to the final state without generating a request per click", async () => {
  const { controller: c, calls } = controlled();
  for (let i = 0; i < 9; i++) c.toggle();
  assert.equal(calls.length, 1); calls[0].resolve({ liked: true, likes: 8 }); await tick();
  assert.equal(calls.length, 1); assert.equal(c.getSnapshot().liked, true); assert.equal(c.getSnapshot().pending, false);
});
test("failed writes restore confirmed state and allow the next normal click", async () => {
  const { controller: c, calls } = controlled();
  c.toggle(); calls[0].reject(new LikeRequestError("Aguarde um minuto.")); await tick();
  assert.equal(c.getSnapshot().likes, 7); assert.equal(c.getSnapshot().liked, false); assert.equal(c.getSnapshot().pending, false);
  assert.equal(c.getSnapshot().error, "Aguarde um minuto.");
  c.toggle(); assert.equal(calls.length, 2); assert.equal(c.getSnapshot().error, null);
  calls[1].resolve({ liked: true, likes: 8 }); await tick(); assert.equal(c.getSnapshot().liked, true);
});
test("reconciliation after a failure preserves a newer unlike intent", async () => {
  const { controller: c, calls } = controlled();
  c.toggle(); c.toggle(); calls[0].reject(new LikeRequestError("Resposta perdida", { liked: true, likes: 8 })); await tick();
  assert.equal(calls.length, 2); assert.equal(calls[1].liked, false);
  calls[1].resolve({ liked: false, likes: 7 }); await tick(); assert.equal(c.getSnapshot().likes, 7);
});
test("failed reconciliation stops cleanly instead of retrying forever", async () => {
  const { controller: c, calls } = controlled();
  c.toggle(); c.toggle(); calls[0].reject(new LikeRequestError("Confira sua conexão.")); await tick();
  assert.equal(calls.length, 1); assert.equal(c.getSnapshot().pending, false); assert.equal(c.getSnapshot().liked, false);
});
test("server prop refreshes cannot overwrite an in-flight user action", async () => {
  const { controller: c, calls } = controlled();
  const snapshots: boolean[] = []; const unsubscribe = c.subscribe(() => snapshots.push(c.getSnapshot().liked));
  c.toggle(); c.refresh({ liked: false, likes: 100 }); assert.equal(c.getSnapshot().liked, true); assert.equal(c.getSnapshot().likes, 8);
  calls[0].resolve({ liked: true, likes: 8 }); await tick();
  c.refresh({ liked: true, likes: 10 }); assert.equal(c.getSnapshot().likes, 10); assert.ok(snapshots.includes(true)); unsubscribe();
});

test("fresh SQL snapshots update remounted views while older prefetch snapshots cannot revert a confirmed like", async () => {
  const c = createLikeController({ liked: false, likes: 20, observedAt: 100 }, async () => ({ liked: true, likes: 21, observedAt: 300 }));
  c.refresh({ liked: false, likes: 30, observedAt: 200 }); assert.equal(c.getSnapshot().likes, 30);
  c.toggle(); await tick();
  c.refresh({ liked: false, likes: 20, observedAt: 100 }); assert.equal(c.getSnapshot().liked, true); assert.equal(c.getSnapshot().likes, 21);
  c.refresh({ liked: true, likes: 40, observedAt: 400 }); assert.equal(c.getSnapshot().likes, 40);
  c.refresh({ liked: true, likes: 45, observedAt: 500 });
  c.refresh({ liked: false, likes: 20, observedAt: 450 }); assert.equal(c.getSnapshot().liked, true);
});
