import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const publicFile = (name: string) =>
  readFileSync(join(process.cwd(), "public", name), "utf8");

test("the landing page presents the canonical read-only MCP endpoint", () => {
  const html = publicFile("index.html");

  assert.match(html, /<html lang="fr">/);
  assert.match(html, /https:\/\/mcp\.poligraph\.fr\/mcp/);
  assert.match(html, />19<\/strong><span>outils documentés<\/span>/);
  assert.match(html, />100 %<\/strong><span>lecture seule<\/span>/);
  assert.match(html, /Aucune donnée ne peut être modifiée/);
});

test("the landing page keeps trust and support links explicit", () => {
  const html = publicFile("index.html");

  assert.match(html, /https:\/\/poligraph\.fr\/methodologie/);
  assert.match(html, /https:\/\/poligraph\.fr\/sources/);
  assert.match(html, /https:\/\/poligraph\.fr\/mentions-legales/);
  assert.match(html, /mailto:contact@poligraph\.fr/);
  assert.match(html, /github\.com\/ironlam\/poligraph-mcp\/blob\/main\/SECURITY\.md/);
});

test("external links opened in a new tab are protected", () => {
  const html = publicFile("index.html");
  const externalLinks = [...html.matchAll(/<a\s[^>]*target="_blank"[^>]*>/g)];

  assert.ok(externalLinks.length > 0);
  for (const [link] of externalLinks) {
    assert.match(link, /rel="noopener noreferrer"/);
  }
});

test("landing page interactions remain local and do not call the MCP endpoint", () => {
  const script = publicFile("landing.js");

  assert.doesNotMatch(script, /\bfetch\s*\(/);
  assert.doesNotMatch(script, /XMLHttpRequest|WebSocket|EventSource/);
  assert.match(script, /navigator\.clipboard\.writeText/);
  assert.match(script, /setAttribute\("aria-selected"/);
});
