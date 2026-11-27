import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { APP_VERSION } from "../version.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("la versión visible tiene formato x.y.z", () => {
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/);
});

test("la versión visible coincide con todos los archivos de versión", async () => {
  assert.equal(JSON.parse(await read("package.json")).version, APP_VERSION);
  assert.equal(JSON.parse(await read("package-lock.json")).version, APP_VERSION);
  assert.equal(JSON.parse(await read("src-tauri/tauri.conf.json")).version, APP_VERSION);
  assert.match(await read("src-tauri/Cargo.toml"), new RegExp(`^version = "${APP_VERSION.replaceAll(".", "\\.")}"$`, "m"));
  assert.match(await read("src-tauri/Cargo.lock"), new RegExp(`name = "clavelocal"\\nversion = "${APP_VERSION.replaceAll(".", "\\.")}"`));
});
