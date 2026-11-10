import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { VaultStore, STORAGE_KEY, encryptVault, openVault, StorageWriteError } from "../vault.mjs";
import { openSession } from "../session.mjs";

const password = "golden-ficticia-no-usar-en-la-vida-real";
const vector = async (factor) => JSON.parse(await readFile(new URL(`vectors/v1-${factor}k.json`, import.meta.url), "utf8"));
function memory(envelope) {
  const values = new Map([[STORAGE_KEY, JSON.stringify(envelope)], [`${STORAGE_KEY}.previous`, "older-backup"]]);
  let calls = 0;
  return { values, get writes() { return calls; }, fail: () => false,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { if (this.fail(++calls)) throw new Error("quota"); values.set(key, value); },
    removeItem(key) { if (this.fail(++calls)) throw new Error("quota"); values.delete(key); },
  };
}
const noCreate = () => { throw new Error("Must not create an existing vault"); };

test("abrir tres veces no escribe y conserva la copia previa a una edición", async () => {
  const original = await vector(600);
  const storage = memory(original);
  const store = new VaultStore(storage);
  for (let i = 0; i < 3; i++) await openSession(store, password, noCreate);
  assert.equal(storage.writes, 0);
  assert.equal(storage.getItem(`${STORAGE_KEY}.previous`), "older-backup");
  const opened = await openSession(store, password, noCreate);
  const edited = { ...opened.vault, profile: { version: 1, username: "Prueba" } };
  store.commit(await encryptVault(opened.key, edited, opened.salt, opened.iterations));
  const current = storage.getItem(STORAGE_KEY);
  for (let i = 0; i < 3; i++) await openSession(store, password, noCreate);
  assert.equal(storage.writes, 2);
  assert.equal(storage.getItem(STORAGE_KEY), current);
  assert.equal(storage.getItem(`${STORAGE_KEY}.previous`), JSON.stringify(original));
});

test("migración 310k conserva entradas y archivo anterior", async () => {
  const old = await vector(310);
  const storage = memory(old);
  const opened = await openSession(new VaultStore(storage), password, noCreate);
  assert.equal(opened.iterations, 600000);
  assert.deepEqual(opened.vault, (await openVault(password, old)).vault);
  assert.equal(storage.getItem(`${STORAGE_KEY}.previous`), JSON.stringify(old));
  assert.deepEqual((await openVault(password, JSON.parse(storage.getItem(STORAGE_KEY)))).vault, opened.vault);
});

for (const failAt of [1, 2]) {
  test(`migración con fallo de escritura ${failAt} abre sin cambios; edición posterior 310k se puede reabrir`, async () => {
    const old = await vector(310);
    const storage = memory(old);
    storage.fail = (call) => call === failAt;
    const store = new VaultStore(storage);
    const opened = await openSession(store, password, noCreate);
    assert.equal(opened.iterations, 310000);
    assert.match(opened.warning, /No pudimos actualizar/);
    assert.equal(storage.getItem(STORAGE_KEY), JSON.stringify(old));
    assert.equal(storage.getItem(`${STORAGE_KEY}.previous`), "older-backup");
    storage.fail = () => false;
    const next = { ...opened.vault, profile: { version: 1, username: "Prueba" } };
    const encrypted = await encryptVault(opened.key, next, opened.salt, opened.iterations);
    store.commit(encrypted);
    assert.equal(encrypted.kdf.iterations, 310000);
    assert.deepEqual((await openVault(password, encrypted)).vault, next);
  });
}

test("fallo al restaurar copia: principal intacta, copia alterada y aviso explícito", async () => {
  const old = await vector(310);
  const storage = memory(old);
  storage.fail = (call) => call >= 2;
  const opened = await openSession(new VaultStore(storage), password, noCreate);
  assert.equal(storage.getItem(STORAGE_KEY), JSON.stringify(old));
  assert.equal(storage.getItem(`${STORAGE_KEY}.previous`), JSON.stringify(old));
  assert.match(opened.warning, /copia anterior pudo cambiar/);
  assert.equal(opened.iterations, 310000);
});

test("fallo principal restaura ausencia de copia y no actualiza expected", async () => {
  const old = await vector(600);
  const storage = memory(old);
  storage.values.delete(`${STORAGE_KEY}.previous`);
  const store = new VaultStore(storage);
  store.read();
  storage.fail = (call) => call === 2;
  assert.throws(() => store.commit(old), StorageWriteError);
  assert.equal(storage.getItem(`${STORAGE_KEY}.previous`), null);
  assert.equal(store.expected, JSON.stringify(old));
});

test("conflictos y cancelación no se confunden con fallo de migración", async () => {
  const storage = memory(await vector(310));
  const store = new VaultStore(storage);
  store.commit = () => { throw new Error("otra ventana"); };
  await assert.rejects(openSession(store, password, noCreate), /otra ventana/);
  await assert.rejects(openSession(store, password, noCreate, () => false), /cancelada/);
});
