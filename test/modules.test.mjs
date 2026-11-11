import assert from "node:assert/strict";
import test from "node:test";
import { appModules, read } from "./app-modules.mjs";

test("cada módulo de la app se sirve localmente y se empaqueta", async () => {
  const [modules, server, build] = await Promise.all([
    appModules(), read("server.mjs"), read("scripts/build.mjs"),
  ]);
  const checks = [
    [server, /const allowed = new Set\((\[[^\]]*\])\)/, "allowed de server.mjs", "/"],
    [build, /const files = (\[[^\]]*\])/, "files de scripts/build.mjs (dist y site/demo)", ""],
  ];
  const missing = [];
  for (const [source, pattern, label, prefix] of checks) {
    const match = source.match(pattern);
    assert.ok(match, `No se encontró la lista ${label}`);
    const listed = new Set(JSON.parse(match[1]));
    for (const path of modules.keys()) {
      if (!listed.has(prefix + path)) missing.push(`${path} falta en ${label}`);
    }
    for (const item of listed) {
      const path = item.slice(prefix.length);
      if (/\.(?:js|mjs)$/.test(path) && !modules.has(path)) missing.push(`${item} no es alcanzable desde app.js en ${label}`);
    }
  }
  assert.deepEqual(missing, [], missing.join("\n"));
});
