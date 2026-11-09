import test from "node:test";
import assert from "node:assert/strict";
import { VaultStore, STORAGE_KEY, deriveKey, encryptVault, openVault, randomBytes, validateEnvelope } from "../vault.mjs";

const password = "solo-pruebas-no-es-una-clave-real";
const vault = { version: 1, entries: [{ id: "test-1", site: "<img src=x onerror=alert(1)>", username: "test@example.invalid", password: "ficticia", notes: "", category: "Personal", favorite: false, updatedAt: "2026-11-09T00:00:00Z" }] };
const storage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
async function encrypted(iterations = 600000) {
  const salt = randomBytes(16);
  return encryptVault(await deriveKey(password, salt, iterations), vault, salt, iterations);
}

test("roundtrip, IV nuevo, clave no exportable y ausencia de secretos en el archivo", async () => {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  assert.equal(key.extractable, false);
  const first = await encryptVault(key, vault, salt);
  const second = await encryptVault(key, vault, salt);
  assert.notEqual(first.cipher.iv, second.cipher.iv);
  assert.deepEqual((await openVault(password, first)).vault, vault);
  assert.equal(JSON.stringify(first).includes("ficticia"), false);
});
test("rechaza clave errónea, ciphertext alterado y parámetros no admitidos", async () => {
  const envelope = await encrypted();
  await assert.rejects(openVault("equivocada", envelope));
  const altered = structuredClone(envelope);
  altered.cipher.data = (altered.cipher.data[0] === "A" ? "B" : "A") + altered.cipher.data.slice(1);
  await assert.rejects(openVault(password, altered));
  for (const iterations of [0, 1, 600001, 9999999999]) {
    assert.throws(() => validateEnvelope({ ...envelope, kdf: { ...envelope.kdf, iterations } }));
  }
});
test("abre formato 0.1 y permite migrar manteniendo las entradas", async () => {
  const old = await encrypted(310000);
  const opened = await openVault(password, old);
  const salt = randomBytes(16);
  const upgraded = await encryptVault(await deriveKey(password, salt), opened.vault, salt);
  assert.equal(upgraded.kdf.iterations, 600000);
  assert.deepEqual((await openVault(password, upgraded)).vault, vault);
});
test("datos corruptos nunca se consideran una bóveda vacía", () => {
  const memory = storage();
  memory.setItem(STORAGE_KEY, "{dañado");
  assert.throws(() => new VaultStore(memory).read());
  assert.equal(memory.getItem(STORAGE_KEY), "{dañado");
});
test("una ventana obsoleta no pisa los datos y se conserva la copia anterior", async () => {
  const memory = storage();
  const first = new VaultStore(memory);
  const stale = new VaultStore(memory);
  first.read(); stale.read();
  const envelope = await encrypted();
  first.commit(envelope);
  assert.throws(() => stale.commit(envelope), /otra ventana/);
  const previous = memory.getItem(STORAGE_KEY);
  first.commit(await encrypted());
  assert.equal(memory.getItem(`${STORAGE_KEY}.previous`), previous);
});
test("fallos de cuota no reemplazan el archivo existente", async () => {
  const memory = storage();
  const store = new VaultStore(memory);
  store.read();
  const envelope = await encrypted();
  store.commit(envelope);
  const original = memory.getItem(STORAGE_KEY);
  memory.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.throws(() => store.commit(envelope), /Quota/);
  assert.equal(memory.getItem(STORAGE_KEY), original);
});
