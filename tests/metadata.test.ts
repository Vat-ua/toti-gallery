import { test } from "node:test";
import assert from "node:assert/strict";
import { metadataDescription, sharingMetadata, siteDescription } from "../src/lib/metadata";

test("sharing descriptions keep readable CommonMark text rather than formatting or destinations", () => {
  assert.equal(metadataDescription("### **DevNotes**\n\nUm *projeto* com [uma experiência](https://example.test/path?q=1) e `React`."), "DevNotes Um projeto com uma experiência e React.");
  assert.equal(metadataDescription("[Uma **ideia**][repo]\n\n[repo]: https://example.test/private-url"), "Uma ideia");
  assert.equal(metadataDescription("- Primeiro\n- Segundo\n\n> Uma citação\n\nTexto  \nseguinte &amp; útil."), "Primeiro Segundo Uma citação Texto seguinte & útil.");
  assert.equal(metadataDescription("Preserve foo_bar_baz e \\*asteriscos\\*."), "Preserve foo_bar_baz e *asteriscos*.");
});

test("hidden markup, image URLs and code examples do not leak into descriptions", () => {
  const value = 'Introdução.\n\n<script>alert("bad")</script>\n\n![Imagem](https://example.test/tracker.png)\n\n```js\nconst secret = "example";\n```\n\nTexto com <b>ênfase</b>.';
  assert.equal(metadataDescription(value), "Introdução. Texto com ênfase.");
  assert.equal(sharingMetadata({ description: "![Só imagem](https://example.test/image.png)" }).description, siteDescription);
});

test("descriptions normalize whitespace and shorten at a word boundary without splitting Unicode", () => {
  assert.equal(metadataDescription("Descrição simples.\n\nOutra parte."), "Descrição simples. Outra parte.");
  const short = "a".repeat(160);
  assert.equal(metadataDescription(short), short);
  const result = metadataDescription("Um projeto interessante para aprender. ".repeat(12));
  assert.ok(Array.from(result).length <= 160);
  assert.ok(result.endsWith("…"));
  assert.ok(("Um projeto interessante para aprender. ".repeat(12)).startsWith(result.slice(0, -1)));
  const emoji = metadataDescription("🚀".repeat(170));
  assert.equal(emoji, "🚀".repeat(159) + "…");
});

test("each public page retains complete shared-image metadata with its own title and description", () => {
  const metadata = sharingMetadata({ title: "DevNotes", description: "Um **projeto** de estudo.", path: "/projetos/devnotes" });
  assert.equal(metadata.title, "DevNotes");
  assert.equal(metadata.description, "Um projeto de estudo.");
  const graph = metadata.openGraph;
  assert.ok(graph && "type" in graph && graph.type === "website");
  assert.equal(graph.title, "DevNotes · Toti Gallery");
  assert.equal(graph.description, metadata.description);
  assert.equal(graph.url, "/projetos/devnotes");
  assert.equal(graph.locale, "pt_BR");
  assert.deepEqual(graph.images, [{ url: "/social-card.png", width: 1200, height: 630, alt: "Toti Gallery — Projetos de quem aprende fazendo." }]);
  assert.ok(metadata.twitter && "card" in metadata.twitter && metadata.twitter.card === "summary_large_image");
  assert.equal(metadata.twitter.title, graph.title);
  assert.equal(metadata.twitter.description, metadata.description);
  assert.deepEqual(metadata.twitter.images, [{ url: "/social-card.png", alt: "Toti Gallery — Projetos de quem aprende fazendo." }]);
  assert.equal(sharingMetadata().title, sharingMetadata().openGraph?.title);
});
