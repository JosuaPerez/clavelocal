import { expect, test } from "@playwright/test";

const master = "ficticia-solo-pruebas-123!";

async function createVault(page) {
  await page.goto("/");
  await page.locator("#authUsername").fill("Perfil de prueba");
  await page.locator("#masterPassword").fill(master);
  await page.locator("#confirmPassword").fill(master);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();
}

test("la barra lateral agrupa las acciones y conserva sus nombres", async ({ page }) => {
  await createVault(page);
  for (const group of ["Seguridad", "Copias y datos", "Cuenta"]) {
    await expect(page.getByRole("group", { name: group })).toBeVisible();
  }
  const security = page.getByRole("group", { name: "Seguridad" });
  await expect(security.getByRole("button", { name: "Salud de la bóveda" })).toBeEnabled();
  await expect(page.getByRole("group", { name: "Copias y datos" }).getByRole("button", { name: "Exportar copia cifrada" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Cuenta" }).getByRole("button", { name: "Mi perfil" })).toBeVisible();
});

test("primeros pasos avanzan y desaparecen al completarse, también tras recargar", async ({ page }) => {
  await createVault(page);
  const panel = page.locator("#firstSteps");
  await expect(panel).toBeVisible();
  await expect(page.locator("#firstStepsProgress")).toHaveText("0 de 3");

  await panel.getByRole("button", { name: "Crear contraseña" }).click();
  await page.locator("#entrySite").fill("Sitio Uno");
  await page.locator("#entryUsername").fill("uno@example.invalid");
  await page.locator("#entryPassword").fill("caballo-nube-mesa-tiza");
  await page.locator("#saveEntryButton").click();
  await expect(page.locator("#firstStepsProgress")).toHaveText("1 de 3");

  await panel.getByRole("button", { name: "Revisar bloqueo" }).click();
  await expect(page.locator("#settingsDialog")).toBeVisible();
  await page.locator("#cancelSettings").click();
  await expect(page.locator("#firstStepsProgress")).toHaveText("2 de 3");

  await panel.getByRole("button", { name: "Abrir salud" }).click();
  await expect(page.locator("#healthDialog")).toBeVisible();
  await page.locator("#doneHealth").click();
  await expect(panel).toBeHidden();

  await page.reload();
  await page.locator("#masterPassword").fill(master);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();
  await expect(panel).toBeHidden();
});

test("ocultar los primeros pasos es permanente y el recordatorio de copia sigue visible", async ({ page }) => {
  await createVault(page);
  await expect(page.locator("#firstSteps")).toBeVisible();
  await expect(page.locator("#backupReminder")).toBeVisible();
  await page.locator("#dismissFirstSteps").click();
  await expect(page.locator("#firstSteps")).toBeHidden();
  await expect(page.locator("#backupReminder")).toBeVisible();
  await page.reload();
  await page.locator("#masterPassword").fill(master);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();
  await expect(page.locator("#firstSteps")).toBeHidden();
});

test("la demo no muestra primeros pasos", async ({ page }) => {
  await page.goto("http://127.0.0.1:4174/");
  await page.getByRole("link", { name: "Probar demo" }).click();
  await page.locator("#demoButton").click();
  await expect(page.locator("#vaultView")).toBeVisible();
  await expect(page.locator("#firstSteps")).toBeHidden();
});
