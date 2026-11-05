import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ErrorRecovery } from "../src/components/error-recovery";

test("failure UI exposes only an opaque digest and a retry action, never error details", () => {
  const html = renderToStaticMarkup(<ErrorRecovery error={Object.assign(new Error("private password token"), { digest: "123456789" })} retry={() => {}}/>);
  assert.match(html, /Tentar novamente/); assert.match(html, /Referência: 123456789/);
  assert.match(html, /href="\/"/); assert.ok(!html.includes("private"));
});
test("malformed digests and arbitrary thrown values cannot leak into the recovery UI", () => {
  for (const error of [null, "private details", { digest: "email@example.invalid secret" }]) {
    const html = renderToStaticMarkup(<ErrorRecovery error={error} retry={() => {}}/>);
    assert.ok(!html.includes("Referência")); assert.ok(!html.includes("private")); assert.ok(!html.includes("secret"));
  }
});
