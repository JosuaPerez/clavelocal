import { expect, test } from "@playwright/test";
import { openVault, STORAGE_KEY } from "../vault.mjs";

const current = "clave-ficticia-cielo-azul";
const next = "camino-luna-girasol-piedra";

async function create(page) {
  await page.goto("/");
  await page.locator("#authUsername").fill("Perfil de prueba");
  await page.locator("#masterPassword").fill(current);
  await page.locator("#confirmPassword").fill(current);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();
}

test("rotar conserva entradas, exporta con la nueva clave y permite borrar la copia anterior", async ({ page }) => {
  await create(page);
  await page.locator("#newEntryButton").click();
  await page.locator("#entrySite").fill("Sitio de prueba");
  await page.locator("#saveEntryButton").click();
  await expect(page.locator("#entryList")).toContainText("Sitio de prueba");
  await page.locator("#changeKeyButton").click({ timeout: 2000 });
  await expect(page.locator("#changeKeyDialog")).toContainText("clave anterior");
  await page.locator("#currentKey").fill(current);
  await page.locator("#nextKey").fill("passwordpassword");
  await expect(page.locator("#saveChangeKey")).toBeDisabled();
  await expect(page.locator("#changeKeyAssessment")).toContainText("claves comunes");
  await page.locator("#nextKey").fill(current);
  await page.locator("#confirmKey").fill(current);
  await page.locator("#saveChangeKey").click();
  await expect(page.locator("#changeKeyError")).toContainText("distinta");
  await page.locator("#currentKey").fill("clave-incorrecta");
  await page.locator("#nextKey").fill(next);
  await page.locator("#confirmKey").fill(next);
  await page.locator("#saveChangeKey").click();
  await expect(page.locator("#changeKeyError")).toContainText("verificar");
  await page.locator("#currentKey").fill(current);
  await page.locator("#saveChangeKey").click();
  await expect(page.locator("#changeKeyDialog")).toBeHidden();
  await expect(page.locator("#rekeyRecovery")).toContainText("siguen abriéndose con la clave anterior");

  const download = page.waitForEvent("download");
  await page.locator("#rekeyExport").click();
  const stream = await (await download).createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  assertEntry((await openVault(next, exported)).vault);
  await expect(openVault(current, exported)).rejects.toThrow();

  const backupKey = `${STORAGE_KEY}.previous`;
  const readBackup = () => page.evaluate((key) => localStorage.getItem(key), backupKey);
  const backup = await readBackup();
  assertEntry((await openVault(current, JSON.parse(backup))).vault);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.locator("#rekeyDeletePrevious").click();
  expect(await readBackup()).toBe(backup);
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#rekeyDeletePrevious").click();
  await expect.poll(readBackup).toBeNull();

  await page.locator("#lockButton").click();
  await page.locator("#masterPassword").fill(current);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#authError")).toContainText("No se pudo abrir");
  await page.locator("#masterPassword").fill(next);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#entryList")).toContainText("Sitio de prueba");
});

function assertEntry(vault) {
  expect(vault.entries[0].site).toBe("Sitio de prueba");
}

test("bloquear con el diálogo abierto elimina sus claves y conserva la bóveda", async ({ page }) => {
  await create(page);
  const before = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  await page.locator("#changeKeyButton").click({ timeout: 2000 });
  for (const [id, password] of [["currentKey", current], ["nextKey", next], ["confirmKey", next]]) {
    await page.locator(`#${id}`).fill(password);
  }
  await page.locator('[data-reveal="nextKey"]').click();
  await expect(page.locator("#nextKey")).toHaveAttribute("type", "text");
  await page.locator("#lockButton").evaluate((button) => button.click());
  await expect(page.locator("#changeKeyDialog")).toBeHidden();
  for (const id of ["currentKey", "nextKey", "confirmKey"]) {
    await expect(page.locator(`#${id}`)).toHaveValue("");
    await expect(page.locator(`#${id}`)).toHaveAttribute("type", "password");
  }
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(before);
});
