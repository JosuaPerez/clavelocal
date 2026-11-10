import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { openVault, deriveKey, encryptVault, randomBytes } from "../vault.mjs";

const password = "golden-ficticia-no-usar-en-la-vida-real";
const expected = { version: 1, entries: [{ id: "golden-1", site: "<img src=x onerror=alert(1)>", username: "prueba@example.invalid", password: "ficticia-únicamente", notes: "Texto de prueba 🗝️", category: "Personal", favorite: false, updatedAt: "2026-11-09T00:00:00Z" }] };
for (const factor of [310, 600]) {
  test(`vector publicado v1-${factor}k abre exactamente y rechaza un byte alterado`, async () => {
    const envelope = JSON.parse(await readFile(new URL(`vectors/v1-${factor}k.json`, import.meta.url), "utf8"));
    assert.deepEqual((await openVault(password, envelope)).vault, expected);
    const altered = structuredClone(envelope);
    const bytes = Buffer.from(altered.cipher.data, "base64");
    bytes[0] ^= 1;
    altered.cipher.data = bytes.toString("base64");
    await assert.rejects(openVault(password, altered));
    if (factor === 310) {
      const opened = await openVault(password, envelope);
      const salt = randomBytes(16);
      const migrated = await encryptVault(await deriveKey(password, salt), opened.vault, salt);
      assert.equal(migrated.kdf.iterations, 600000);
      assert.deepEqual((await openVault(password, migrated)).vault, expected);
    }
  });
}
