import { expect, test } from "@playwright/test";
import { deriveKey, encryptVault, randomBytes, STORAGE_KEY } from "../vault.mjs";

test("crear exige una clave menos predecible y guardar una entrada débil sigue permitido", async ({ page }) => {
  await page.goto("/");
  await page.locator("#authUsername").fill("Perfil de prueba");
  await page.locator("#masterPassword").fill("123456789012");
  await page.locator("#confirmPassword").fill("123456789012");
  await expect(page.locator("#authSubmit")).toBeDisabled({ timeout: 2000 });
  await expect(page.locator("#masterPolicy")).toContainText("secuencias");
  await page.locator("#authForm").evaluate((form) => form.dispatchEvent(new Event("submit", { cancelable: true })));
  await expect(page.locator("#authError")).toContainText("secuencias");
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBeNull();
  await page.locator("#masterPassword").fill("caballo-nube-mesa-tiza");
  await page.locator("#confirmPassword").fill("caballo-nube-mesa-tiza");
  await page.locator("#authSubmit").click();
  await page.locator("#newEntryButton").click();
  await page.locator("#entrySite").fill("Ejemplo");
  await page.locator("#entryPassword").fill("Password123!");
  await expect(page.locator("#entryStrengthLabel")).toContainText("predecible");
  await page.locator("#saveEntryButton").click();
  await expect(page.locator("#entryList")).toContainText("Ejemplo");
});

test("desbloquear una bóveda existente acepta una clave corta anterior sin escrituras", async ({ page }) => {
  const password = "corta";
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  const envelope = await encryptVault(key, { version: 1, entries: [], profile: { version: 1, username: "Perfil" } }, salt);
  await page.addInitScript(({ storageKey, raw }) => {
    localStorage.setItem(storageKey, raw);
    window.vaultWrites = 0;
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith(storageKey)) window.vaultWrites += 1;
      return write.call(this, key, value);
    };
  }, { storageKey: STORAGE_KEY, raw: JSON.stringify(envelope) });
  await page.goto("/");
  await expect(page.locator("#masterPolicy")).toBeHidden();
  await page.locator("#masterPassword").fill(password);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultGreeting")).toHaveText("Hola, Perfil", { timeout: 3000 });
  expect(await page.evaluate(() => window.vaultWrites)).toBe(0);
});
