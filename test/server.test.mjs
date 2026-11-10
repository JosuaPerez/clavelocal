import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { once } from "node:events";
import { request } from "node:http";
import { createServer } from "node:net";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);

async function listen(server, t) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return server.address().port;
}

test("el puerto ocupado avisa, falla y no anuncia una dirección abierta", async (t) => {
  const port = await listen(createServer(), t);
  await assert.rejects(run(process.execPath, [fileURLToPath(new URL("../server.mjs", import.meta.url))], {
    env: { ...process.env, CLAVELOCAL_PORT: String(port), CLAVELOCAL_NO_OPEN: "1", CLAVELOCAL_NO_AUTOSTART: "0" },
    timeout: 5000,
  }), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, new RegExp(`El puerto ${port} ya está en uso`));
    assert.match(error.stderr, /no abras esa dirección/i);
    assert.equal(error.stdout, "");
    return true;
  });
});

test("el servidor conserva la lista blanca y aísla respuestas 200 y 404", async (t) => {
  process.env.CLAVELOCAL_NO_AUTOSTART = "1";
  process.env.CLAVELOCAL_PORT = "4173";
  const { server } = await import("../server.mjs");
  const port = await listen(server, t);
  function get(path, host = "127.0.0.1:4173", method = "GET") {
    return new Promise((resolve, reject) => {
      const req = request({ host: "127.0.0.1", port, path, method, headers: { Host: host } }, (response) => {
        response.resume();
        response.on("end", () => resolve(response));
        response.on("error", reject);
      });
      req.on("error", reject);
      req.end();
    });
  }
  for (const [path, status] of [["/", 200], ["/package.json", 404]]) {
    const result = await get(path);
    assert.equal(result.statusCode, status);
    assert.equal(result.headers["cross-origin-opener-policy"], "same-origin");
    assert.equal(result.headers["cross-origin-resource-policy"], "same-origin");
    assert.match(result.headers["content-security-policy"], /connect-src 'none'/);
  }
  assert.equal((await get("/", "example.test")).statusCode, 403);
  assert.equal((await get("/", undefined, "POST")).statusCode, 403);
  assert.equal((await get("/", undefined, "HEAD")).statusCode, 200);
});
