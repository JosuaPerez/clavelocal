import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const password = "ficticia-pruebas-desbloqueo-123";
test("desbloquear no escribe y Ayuda descarga la copia previa a editar", async ({ page }) => {
  await page.goto("/");
  await page.locator("#authUsername").fill("Perfil de prueba");
  await page.locator("#masterPassword").fill(password);
  await page.locator("#confirmPassword").fill(password);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();
  const beforeEdit = await page.evaluate(() => localStorage.getItem("clavelocal.vault.v1"));
  await page.locator("#newEntryButton").click();
  await page.locator("#entrySite").fill("Ejemplo");
  await page.locator("#entryPassword").fill("secreto-ficticio");
  await page.locator("#saveEntryButton").click();
  await expect(page.locator("#entryDialog")).not.toBeVisible();
  const afterEdit = await page.evaluate(() => localStorage.getItem("clavelocal.vault.v1"));
  await page.evaluate(() => {
    window.vaultWrites = 0;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith("clavelocal.vault.v1")) window.vaultWrites++;
      return original.call(this, key, value);
    };
  });
  for (let i = 0; i < 3; i++) {
    await page.locator("#lockButton").click();
    await page.locator("#masterPassword").fill(password);
    await page.locator("#authSubmit").click();
    await expect(page.locator("#vaultView")).toBeVisible();
  }
  expect(await page.evaluate(() => window.vaultWrites)).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem("clavelocal.vault.v1"))).toBe(afterEdit);
  await page.locator("#lockButton").click();
  await page.locator("#helpButton").click();
  const download = page.waitForEvent("download");
  await page.locator("#previousBackupButton").click();
  const stream = await (await download).createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual(JSON.parse(beforeEdit));
});

test("migración sin espacio abre y guardar perfil conserva las iteraciones originales", async ({ page }) => {
  const old = await readFile(new URL("../test/vectors/v1-310k.json", import.meta.url), "utf8");
  await page.goto("/");
  await page.evaluate((raw) => localStorage.setItem("clavelocal.vault.v1", raw), old);
  await page.reload();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    let failed = false;
    Storage.prototype.setItem = function(key, value) {
      if (!failed && key === "clavelocal.vault.v1") { failed = true; throw new DOMException("quota", "QuotaExceededError"); }
      return original.call(this, key, value);
    };
  });
  await page.locator("#masterPassword").fill("golden-ficticia-no-usar-en-la-vida-real");
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();
  await expect(page.locator("#vaultNotice")).toContainText("No pudimos actualizar");
  expect(await page.evaluate(() => localStorage.getItem("clavelocal.vault.v1"))).toBe(old);
  await page.locator("#profileUsername").fill("Prueba migración");
  await page.locator("#saveProfile").click();
  await expect(page.locator("#profileDialog")).not.toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("clavelocal.vault.v1")).kdf.iterations)).toBe(310000);
  await page.reload();
  await page.locator("#masterPassword").fill("golden-ficticia-no-usar-en-la-vida-real");
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultGreeting")).toHaveText("Hola, Prueba migración");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("clavelocal.vault.v1")).kdf.iterations)).toBe(600000);
});
