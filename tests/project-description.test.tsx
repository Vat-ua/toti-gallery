import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectDescription } from "../src/components/project-description";

const render = (value: string) => renderToStaticMarkup(<ProjectDescription>{value}</ProjectDescription>);

test("renders the agreed formatting and preserves the page heading hierarchy", () => {
  const html = render("# Introdução\n\n**Importante** e *útil*, com `código`.\n\n- Primeiro\n- Segundo\n\n1. Preparar\n2. Publicar\n\n> Uma citação\n\n#### Detalhes");
  for (const tag of ["h3", "h4", "strong", "em", "code", "ul", "ol", "blockquote"]) assert.match(html, new RegExp(`<${tag}[ >]`));
  assert.doesNotMatch(html, /<h[12][ >]/);
  const preview = renderToStaticMarkup(<ProjectDescription headingLevel={2}>{"### Ideia\n\n#### Detalhes"}</ProjectDescription>);
  assert.match(preview, /<h2>Ideia<\/h2>/); assert.match(preview, /<h3>Detalhes<\/h3>/);
});

test("raw HTML and embedded images never become executable elements", () => {
  for (const payload of [
    '<script>window.__xss = true</script>',
    '<img src="x" onerror="window.__xss = true">',
    '<svg onload="window.__xss = true"></svg>',
    '<iframe src="https://example.test"></iframe>',
    '<a href="javascript:alert(1)">Abrir</a>',
    '![Imagem](https://example.test/tracking.png)',
  ]) {
    const html = render(`Descrição do projeto.\n\n${payload}`);
    assert.doesNotMatch(html, /<(script|img|svg|iframe|a)\b/i);
  }
});

test("inline links allow only absolute HTTPS without embedded credentials", () => {
  for (const url of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "jav&#x61;script:alert(1)", "java&#x09;script:alert(1)", "data:text/html,malicious", "vbscript:evil", "http://example.test", "//example.test", "/relative", "#anchor", "https://user:secret@example.test"]) {
    const html = render(`[Abrir projeto](${url})`);
    assert.doesNotMatch(html, /<a\b/); assert.match(html, /Abrir projeto/);
  }
  const html = render("[Projeto](https://example.test/path?q=1&x=2)");
  assert.match(html, /href="https:\/\/example.test\/path\?q=1&amp;x=2"/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test("programming examples remain readable text and ordinary descriptions still render", () => {
  const html = render('```html\n<script>alert("example")</script>\n```');
  assert.match(html, /<pre\b[^>]*tabindex="0"[^>]*><code/); assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script\b/);
  const plain = render("Um projeto de aprendizagem.\n\nUma segunda parte da descrição.");
  assert.equal((plain.match(/<p>/g) || []).length, 2);
  assert.match(render("Descrição com uma palavra muito longa: " + "a".repeat(1000)), /a{1000}/);
});
