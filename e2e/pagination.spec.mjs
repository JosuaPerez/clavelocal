import { test, expect } from "@playwright/test";
const password = "solo-pruebas-paginacion-ficticia";

async function openLargeVault(page) {
  await page.goto("/");
  await page.evaluate(async (password) => {
    const { randomBytes, deriveKey, encryptVault } = await import("/vault.mjs");
    const salt = randomBytes(16);
    const entries = Array.from({ length: 500 }, (_, index) => ({
      id: `example-${index}`, site: `Sitio ${String(index).padStart(3, "0")}`, username: `user${index}@example.invalid`, password: "contraseña-ficticia", notes: "", category: index < 400 ? "Personal" : index < 490 ? "Trabajo" : "Finanzas", favorite: index < 21, updatedAt: "2026-11-09T00:00:00Z",
    }));
    localStorage.setItem("clavelocal.vault.v1", JSON.stringify(await encryptVault(await deriveKey(password, salt), { version: 1, profile: { version: 1, username: "Perfil de prueba" }, entries }, salt)));
  }, password);
  await page.reload();
  await page.locator("#masterPassword").fill(password);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();
}

test("500 contraseñas: máximo 10 por página; búsqueda global y categorías reinician la página", async ({ page }) => {
  await openLargeVault(page);
  const top = page.locator("#entryPagination");
  await expect(page.locator(".entry-card")).toHaveCount(10);
  await expect(top).toContainText("1–10 de 500 · Página 1 de 50");
  await expect(top.locator('[data-page-step="-1"]')).toBeDisabled();
  await top.locator('[data-page-step="1"]').click();
  await expect(top).toContainText("11–20 de 500 · Página 2 de 50");
  await expect(page.locator("#entryList")).toContainText("Sitio 010");
  await expect(page.locator("#entryList")).not.toContainText("Sitio 000");
  await page.locator("#searchInput").fill("Sitio 499");
  await expect(page.locator(".entry-card")).toHaveCount(1);
  await expect(top).toContainText("1–1 de 1 · Página 1 de 1");
  await expect(top.locator('[data-page-step="1"]')).toBeDisabled();
  await page.locator("#searchInput").fill("");
  await expect(top).toContainText("Página 1 de 50");
  await page.locator("#categoryNav button").filter({ hasText: "Trabajo" }).click();
  await expect(top).toContainText("1–10 de 90 · Página 1 de 9");
  await top.locator('[data-page-step="1"]').click();
  await expect(page.locator("#entryList")).toContainText("Sitio 410");
  await page.locator("#categoryNav button").filter({ hasText: "Finanzas" }).click();
  await expect(top).toContainText("Página 1 de 1");
  await expect(page.locator(".entry-card")).toHaveCount(10);
  await page.locator("#categoryNav button").filter({ hasText: "Redes" }).click();
  await expect(top).toBeHidden();
  await expect(page.locator("#emptyStateTitle")).toHaveText("No hay coincidencias");
  await page.locator('[data-view="all"]').click();
  await page.screenshot({ path: "work/vault-paginated.png", fullPage: true });
  await page.locator("#lockButton").click();
  await expect(top).toBeHidden();
  await expect(top.locator(".page-summary")).toBeEmpty();
});

test("eliminar la única entrada de la última página retrocede a la página válida anterior", async ({ page }) => {
  await openLargeVault(page);
  await page.locator('[data-view="favorites"]').click();
  const top = page.locator("#entryPagination");
  await top.locator('[data-page-step="1"]').click();
  await page.locator('#entryPaginationBottom [data-page-step="1"]').click();
  await expect(page.locator(".entry-card")).toHaveCount(1);
  await expect(top).toContainText("21–21 de 21 · Página 3 de 3");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await expect(top).toContainText("11–20 de 20 · Página 2 de 2");
  await expect(page.locator(".entry-card")).toHaveCount(10);
  await expect(top.locator('[data-page-step="1"]')).toBeDisabled();
});

test("acceso limpio, demo centrada y restauración disponible desde Ayuda", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".auth-card #restoreButton")).toHaveCount(0);
  await expect(page.locator(".auth-card #previousBackupButton")).toHaveCount(0);
  await expect(page.locator("#demoButton")).toHaveClass("demo-link");
  await page.locator("#authUsername").fill("Perfil de prueba");
  await page.locator("#masterPassword").fill(password);
  await page.locator("#confirmPassword").fill(password);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();
  const backup = await page.evaluate(() => localStorage.getItem("clavelocal.vault.v1"));
  await page.locator("#lockButton").click();
  await page.screenshot({ path: "work/login-clean.png", fullPage: true });
  const box = await page.locator("#demoButton").boundingBox();
  const primaryBox = await page.locator("#authSubmit").boundingBox();
  expect(Math.abs(box.x + box.width / 2 - primaryBox.x - primaryBox.width / 2)).toBeLessThan(2);
  await page.locator("#helpButton").click();
  await expect(page.locator("#helpDialog")).toBeVisible();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#restoreButton").click();
  await (await chooser).setFiles({ name: "copia.json", mimeType: "application/json", buffer: Buffer.from(backup) });
  await expect(page.locator("#helpDialog")).not.toBeVisible();
  await expect(page.locator("#importDialog")).toBeVisible();
  await page.locator("#importPassword").fill(password);
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#importForm button[type=submit]").click();
  await expect(page.locator("#importDialog")).not.toBeVisible();
  await expect(page.locator("#authTitle")).toHaveText("Hola, Perfil de prueba");
});
