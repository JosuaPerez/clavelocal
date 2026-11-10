import test from "node:test";
import assert from "node:assert/strict";
import { normalizeUsername, validateProfile, cacheProfile, readCachedProfile, PROFILE_KEY } from "../profile.mjs";
import { deriveKey, randomBytes, encryptVault, openVault } from "../vault.mjs";
test("normaliza un usuario local y rechaza HTML, controles y nombres largos", () => {
  assert.equal(normalizeUsername("  Josua Pérez  "), "Josua Pérez");
  for (const value of ["", "a", "<img src=x>", "ab\ncd", "a".repeat(41), "👾test"]) assert.throws(() => normalizeUsername(value));
  assert.throws(() => validateProfile({ version: 1, username: "Josua", password: "no permitido" }));
});
test("el cache solo conserva nombre y versión; errores y datos corruptos son recuperables", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const profile = { version: 1, username: "Josua" };
  assert.equal(cacheProfile(storage, profile), true);
  assert.deepEqual(readCachedProfile(storage), profile);
  assert.deepEqual(JSON.parse(values.get(PROFILE_KEY)), profile);
  values.set(PROFILE_KEY, "{dañado");
  assert.equal(readCachedProfile(storage), null);
  storage.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.equal(cacheProfile(storage, profile), false);
  assert.equal(readCachedProfile(storage), null);
});
test("el perfil canónico está cifrado y no sustituye la clave maestra", async () => {
  const password = "solo-pruebas-no-es-secreto";
  const salt = randomBytes(16);
  const vault = { version: 1, profile: { version: 1, username: "Josua" }, entries: [] };
  const envelope = await encryptVault(await deriveKey(password, salt), vault, salt);
  assert.equal(JSON.stringify(envelope).includes("Josua"), false);
  assert.deepEqual((await openVault(password, envelope)).vault, vault);
  await assert.rejects(openVault("Josua", envelope));
});
