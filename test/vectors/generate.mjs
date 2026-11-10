// Manual fixture generation only. Never run this as part of the test suite.
import { writeFile } from "node:fs/promises";
import { deriveKey, encryptVault, randomBytes } from "../../vault.mjs";

const password = "golden-ficticia-no-usar-en-la-vida-real";
const vault = { version: 1, entries: [{ id: "golden-1", site: "<img src=x onerror=alert(1)>", username: "prueba@example.invalid", password: "ficticia-únicamente", notes: "Texto de prueba 🗝️", category: "Personal", favorite: false, updatedAt: "2026-11-09T00:00:00Z" }] };
for (const iterations of [310000, 600000]) {
  const salt = randomBytes(16);
  const envelope = await encryptVault(await deriveKey(password, salt, iterations), vault, salt, iterations);
  await writeFile(new URL(`v1-${iterations / 1000}k.json`, import.meta.url), `${JSON.stringify(envelope, null, 2)}\n`);
}
