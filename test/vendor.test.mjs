import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";

const root = new URL("../src-tauri/vendor/glib-0.18.5/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("../security/glib-vendor.json", import.meta.url), "utf8"));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const changed = "src/variant_iter.rs";
const originalPointer = "            let p: *mut libc::c_char = std::ptr::null_mut();";
const fixedPointer = originalPointer.replace("let p:", "let mut p:");
const originalArg = "                &p,";
const fixedArg = "                &mut p,";
function verifyBackport(source) {
  for (const line of [fixedPointer, fixedArg]) assert.equal(source.split(line).length - 1, 1, "Exactly one upstream fix is required");
  const original = source.replace(fixedPointer, originalPointer).replace(fixedArg, originalArg);
  assert.equal(hash(original), manifest.originalFileHashes[changed], "Only the two upstream changes are allowed");
  return original;
}
async function files(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert.equal(entry.isSymbolicLink(), false, "Vendored sources must not contain symlinks");
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory()) result.push(...await files(new URL(`${entry.name}/`, directory), `${path}/`));
    else result.push(path);
  }
  return result.sort();
}
test("GLib vendorizado conserva todos los bytes oficiales salvo las dos líneas del arreglo original", async () => {
  const actual = await files(root);
  assert.deepEqual(actual, Object.keys(manifest.originalFileHashes).sort());
  for (const path of actual) {
    const bytes = await readFile(new URL(path, root));
    if (path === changed) verifyBackport(bytes.toString("utf8"));
    else assert.equal(hash(bytes), manifest.originalFileHashes[path], `Upstream bytes changed: ${path}`);
  }
  const cargo = await readFile(new URL("../src-tauri/Cargo.toml", import.meta.url), "utf8");
  assert.match(cargo, /\[patch\.crates-io\][\s\S]*glib = \{ path = "vendor\/glib-0\.18\.5" \}/);
  const regression = await readFile(new URL("../src-tauri/security/glib-regression/Cargo.toml", import.meta.url), "utf8");
  assert.match(regression, /glib = \{ path = "\.\.\/\.\.\/vendor\/glib-0\.18\.5" \}/);
});
test("la verificación detecta retirar el arreglo y modificaciones ajenas al backport", async () => {
  const source = await readFile(new URL(changed, root), "utf8");
  const original = verifyBackport(source);
  assert.throws(() => verifyBackport(original), /Exactly one upstream fix/);
  assert.throws(() => verifyBackport(`${source}\n`), /Only the two upstream changes/);
});
