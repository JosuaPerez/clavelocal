import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("los archivos JavaScript evitan patrones de ejecución dinámica", async () => {
  const source = (await Promise.all(["app.js", "server.mjs", "vault.mjs", "profile.mjs", "csv.mjs", "session.mjs", "clipboard.mjs", "settings.mjs"].map(read))).join("\n");
  for (const pattern of [/\beval\s*\(/, /new\s+Function\b/, /\.innerHTML\s*=/, /document\.write\s*\(/]) {
    assert.equal(pattern.test(source), false, `Patrón inseguro encontrado: ${pattern}`);
  }
});

test("la aplicación declara una CSP estricta para alojamiento estático", async () => {
  const html = await read("index.html");
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /script-src 'self'/);
  assert.doesNotMatch(html, /unsafe-inline|unsafe-eval/);
});

test("el servidor limita red, rutas y tipos de contenido", async () => {
  const source = await read("server.mjs");
  assert.match(source, /connect-src 'none'/);
  assert.match(source, /X-Content-Type-Options/);
  assert.match(source, /Referrer-Policy/);
  assert.match(source, /Permissions-Policy/);
  assert.match(source, /const allowed = new Set/);
  assert.match(source, /if \(!allowed\.has\(pathname\)\)/);
});
