import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { validateProfile, normalizeUsername } from "../profile.mjs";
import { deriveKey, encryptVault, openVault, randomBytes } from "../vault.mjs";

const source = await readFile(new URL("compat/v0.3.2-functions.js", import.meta.url), "utf8");
const entry = { id: "test-1", site: "Ejemplo", username: "demo@example.invalid", password: "ficticia", notes: "", category: "Personal", favorite: false, updatedAt: "2026-11-09T00:00:00Z" };

test("validador publicado y todos sus guardados conservan ajustes desconocidos", async () => {
  for (const action of ["create", "edit", "favorite", "delete", "csv", "profile"]) {
    const settings = { idleMinutes: 15, hiddenSeconds: 60 };
    const state = { vault: { version: 1, entries: [structuredClone(entry)], settings, profile: { version: 1, username: "Prueba" } }, key: true, demo: false };
    const controls = {
      "#csvAcknowledge": { checked: true }, "#confirmCsv": {}, "#csvDialog": { close() {} },
      "#profileUsername": { value: "Nuevo nombre" }, "#profileDialog": { close() {} }, "#profileForm": { reset() {} },
    };
    const elements = Object.fromEntries(Object.entries({ entryId: action === "create" ? "" : entry.id,
      entrySite: "Editado", entryPassword: "otra-ficticia", entryUsername: "demo@example.invalid", entryCategory: "Personal", entryNotes: "nota" })
      .map(([key,value]) => [key, { value }]));
    Object.assign(elements, { entryError: {}, entryForm: { reset() {} }, entryDialog: { close() {} } });
    let saved;
    const context = {
      state, elements, validateProfile, normalizeUsername, crypto, structuredClone, busy: false,
      csvPlan: { entries: [{ ...entry, id: "csv-2" }] }, $: (selector) => controls[selector],
      confirm: () => true, renderEntries() {}, renderProfile() {}, clearCsv() {}, showToast() {},
      persistVault: async (next) => { saved = next; },
    };
    const legacy = vm.runInNewContext(`${source}\n({ validateVault, saveEntry, toggleFavorite, deleteEntry, confirmCsv, saveProfile })`, context);
    // A current encrypted vault opens with the unchanged v1 cipher; the frozen validator accepts its new field.
    const salt = randomBytes(16), password = "compatibilidad-ficticia";
    const envelope = await encryptVault(await deriveKey(password, salt), state.vault, salt);
    const opened = (await openVault(password, envelope)).vault;
    assert.deepEqual(legacy.validateVault(opened).settings, settings);
    const event = { preventDefault() {}, submitter: { value: "default" } };
    if (["create", "edit"].includes(action)) await legacy.saveEntry(event);
    if (action === "favorite") await legacy.toggleFavorite(entry.id);
    if (action === "delete") await legacy.deleteEntry(entry);
    if (action === "csv") await legacy.confirmCsv(event);
    if (action === "profile") await legacy.saveProfile(event);
    assert.ok(saved, `El flujo ${action} debe guardar`);
    assert.deepEqual(saved.settings, settings, `El flujo ${action} conserva settings`);
    legacy.validateVault(saved);
    if (action === "create" || action === "csv") assert.equal(saved.entries.length, 2);
    if (action === "edit") assert.equal(saved.entries[0].site, "Editado");
    if (action === "favorite") assert.equal(saved.entries[0].favorite, true);
    if (action === "delete") assert.equal(saved.entries.length, 0);
    if (action === "profile") assert.equal(saved.profile.username, "Nuevo nombre");
  }
});
