import { expect, test } from "@playwright/test";

const password = "caballo-nube-mesa-tiza";
const exportKey = "clavelocal.last-export.v1";
const vaultKey = "clavelocal.vault.v1";

test("el recordatorio vence tras 30 días y una descarga actual registra solo la fecha", async ({ page }) => {
  const start = new Date("2026-06-01T12:00:00Z");
  await page.clock.install({ time: start });
  await page.goto("/");
  await expect(page.locator("#backupReminder")).toBeHidden();
  await page.locator("#authUsername").fill("Perfil ficticio");
  await page.locator("#masterPassword").fill(password);
  await page.locator("#confirmPassword").fill(password);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#backupReminder")).toBeVisible();
  await expect(page.locator("#backupReminder")).toContainText("Descarga una copia cifrada");

  const readVault = () => page.evaluate((key) => localStorage.getItem(key), vaultKey);
  const before = await readVault();
  expect(before).not.toBeNull();
  const download = page.waitForEvent("download");
  await page.locator("#backupReminderExport").click();
  expect((await download).suggestedFilename()).toMatch(/^clavelocal-copia-/);
  await expect(page.locator("#backupReminder")).toBeHidden();
  const saved = await page.evaluate((key) => localStorage.getItem(key), exportKey);
  expect(new Date(saved).toISOString()).toBe(saved);
  expect(await readVault()).toBe(before);

  await page.locator("#lockButton").click();
  await page.locator("#masterPassword").fill(password);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();
  await expect(page.locator("#backupReminder")).toBeHidden();
  await page.locator("#lockButton").click();
  await page.clock.setSystemTime(new Date("2026-07-02T12:00:00Z"));
  await page.locator("#masterPassword").fill(password);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#backupReminder")).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), exportKey)).toBe(saved);
});

test("la demo no muestra el recordatorio ni escribe una fecha", async ({ page }) => {
  await page.goto("/");
  await page.locator("#demoButton").click();
  await expect(page.locator("#vaultView")).toBeVisible();
  await expect(page.locator("#backupReminder")).toBeHidden();
  expect(await page.evaluate((key) => localStorage.getItem(key), exportKey)).toBeNull();
});
