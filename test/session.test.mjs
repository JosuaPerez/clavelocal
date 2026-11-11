import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { VaultStore, STORAGE_KEY, encryptVault, openVault, StorageWriteError } from "../vault.mjs";
import { openSession, rekeySession, RekeyVerificationError } from "../session.mjs";

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
const newPassword = "nube-camino-faro-ficticio";

for (const factor of [310, 600]) {
  test(`rotar desde ${factor}k conserva contenido y deja la copia con la clave anterior`, async () => {
    const original = await vector(factor);
    const storage = memory(original);
    const store = new VaultStore(storage);
    if (factor === 310) storage.fail = (call) => call === 1;
    const opened = await openSession(store, password, noCreate);
    assert.equal(opened.iterations, factor * 1000);
    storage.fail = () => false;
    const vault = {
      ...opened.vault,
      profile: { version: 1, username: "Perfil ficticio" },
      settings: { idleMinutes: 15, hiddenSeconds: 60 },
    };
    let active;
    await rekeySession(store, { current: password, next: newPassword, vault, onCommit: (result) => { active = result; } });
    const saved = JSON.parse(storage.getItem(STORAGE_KEY));
    assert.notEqual(saved.kdf.salt, original.kdf.salt);
    assert.equal(saved.kdf.iterations, 600000);
    assert.equal(active.iterations, 600000);
    assert.deepEqual((await openVault(newPassword, saved)).vault, vault);
    await assert.rejects(openVault(password, saved));
    const backup = storage.getItem(`${STORAGE_KEY}.previous`);
    assert.equal(backup, JSON.stringify(original));
    assert.equal(active.previous, backup);
    assert.deepEqual((await openVault(password, JSON.parse(backup))).vault, opened.vault);
  });
}

test("rotar no escribe con clave actual errónea, clave repetida, cancelación o conflicto", async () => {
  const original = await vector(600);
  const storage = memory(original);
  const store = new VaultStore(storage);
  const { vault } = await openSession(store, password, noCreate);
  const onCommit = () => assert.fail("A rejected rotation must not activate a new key");
  const options = { current: password, next: newPassword, vault, onCommit };
  await assert.rejects(rekeySession(store, { ...options, current: "incorrecta" }), /verificar la clave actual/);
  await assert.rejects(rekeySession(store, { ...options, next: password }), /distinta/);
  let checks = 0;
  await assert.rejects(rekeySession(store, { ...options, isCurrent: () => ++checks === 1 }), /cancelada/);
  assert.equal(checks, 2);
  const otherWindow = JSON.stringify(await vector(310));
  storage.values.set(STORAGE_KEY, otherWindow);
  await assert.rejects(rekeySession(store, options), /cambió en otra ventana/);
  assert.equal(storage.writes, 0);
  assert.equal(storage.getItem(STORAGE_KEY), otherWindow);
  assert.equal(storage.getItem(`${STORAGE_KEY}.previous`), "older-backup");
});

for (const failAt of [1, 2]) {
  test(`rotar restaura las copias si falla la escritura ${failAt}`, async () => {
    const original = await vector(600);
    const storage = memory(original);
    const store = new VaultStore(storage);
    const { vault } = await openSession(store, password, noCreate);
    storage.fail = (call) => call === failAt;
    await assert.rejects(rekeySession(store, { current: password, next: newPassword, vault }), StorageWriteError);
    assert.equal(storage.getItem(STORAGE_KEY), JSON.stringify(original));
    assert.equal(storage.getItem(`${STORAGE_KEY}.previous`), "older-backup");
  });
}

test("rotar comprueba la lectura posterior y no activa una clave sin confirmación", async () => {
  const original = await vector(600);
  const storage = memory(original);
  const store = new VaultStore(storage);
  const { vault } = await openSession(store, password, noCreate);
  const write = storage.setItem;
  storage.setItem = function (key, value) {
    if (key !== STORAGE_KEY) write.call(this, key, value);
  };
  await assert.rejects(rekeySession(store, {
    current: password, next: newPassword, vault, onCommit: () => assert.fail("Unverified commit"),
  }), RekeyVerificationError);
  assert.equal(storage.getItem(STORAGE_KEY), JSON.stringify(original));
});

test("eliminar una copia concreta rechaza una selección obsoleta", async () => {
  const original = await vector(600);
  const storage = memory(original);
  const store = new VaultStore(storage);
  store.read();
  const backupKey = `${STORAGE_KEY}.previous`;
  storage.values.set(backupKey, JSON.stringify(original));
  assert.throws(() => store.removePreviousBackup("older-backup"), /cambió/);
  assert.equal(storage.writes, 0);
  assert.equal(storage.getItem(backupKey), JSON.stringify(original));
  store.removePreviousBackup(JSON.stringify(original));
  assert.equal(storage.getItem(backupKey), null);
});

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
