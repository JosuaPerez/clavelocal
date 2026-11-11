import { test, expect } from "@playwright/test";
test("el navegador no ofrece instalar actualizaciones nativas", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#checkUpdatesButton")).toBeHidden();
});
test("buscar y estar al día muestran solo el estado y Cerrar", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 580 });
  await page.addInitScript(() => {
    window.__TAURI__ = { core: { invoke: () => new Promise((resolve) => { window.finishCheck = resolve; }) } };
  });
  await page.goto("/");
  await page.locator("#checkUpdatesButton").click();
  await expect(page.locator("#updateStatus")).toHaveText("Buscando actualizaciones…");
  await expect(page.locator("#updateBackupAck")).toBeHidden();
  await page.evaluate(() => window.finishCheck(null));
  await expect(page.getByRole("dialog", { name: "Actualizaciones" })).toBeVisible();
  await expect(page.locator("#updateStatus")).toHaveText("ClaveLocal está al día.");
  await expect(page.locator("#updateDialog button:visible")).toHaveCount(1);
  await expect(page.locator("#updateBackupAck")).toBeHidden();
  await page.screenshot({ path: "work/update-current-compact.png" });
});
test("UI del actualizador muestra notas como texto y exige copia antes de instalar", async ({ page }) => {
  await page.addInitScript(() => {
    window.__TAURI__ = { core: { invoke: async (command) => {
      if (command === "check_update") return { version: "9.9.9", notes: "<img src=x onerror=alert(1)>" };
      if (command === "install_update") throw "Error ficticio de firma: prueba de interfaz";
      throw "Comando no permitido";
    } } };
  });
  await page.goto("/");
  await page.locator("#authUsername").fill("Perfil ficticio");
  await page.locator("#masterPassword").fill("caballo-nube-mesa-tiza");
  await page.locator("#confirmPassword").fill("caballo-nube-mesa-tiza");
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();
  await page.locator("#checkUpdatesButton").click();
  await expect(page.locator("#updateStatus")).toContainText("9.9.9");
  await page.locator("#updateChanges summary").click();
  await expect(page.locator("#updateNotes")).toHaveText("<img src=x onerror=alert(1)>");
  await expect(page.locator("#updateNotes img")).toHaveCount(0);
  await expect(page.locator("#installUpdateButton")).toBeDisabled();
  const download = page.waitForEvent("download");
  await page.locator("#updateExportButton").click();
  expect((await download).suggestedFilename()).toMatch(/^clavelocal-copia-/);
  await expect(page.locator("#updateBackupAck")).not.toBeChecked();
  await page.locator("#updateBackupAck").check();
  await page.locator("#installUpdateButton").click();
  await expect(page.locator("#updateStatus")).toContainText("Error ficticio de firma");
  await expect(page.locator("#vaultView")).toBeHidden();
  await expect(page.locator("#updateBackupAck")).toBeHidden();
  await expect(page.locator("#installUpdateButton")).toBeHidden();
  await page.locator("#retryUpdateButton").click();
  await expect(page.locator("#updateStatus")).toContainText("9.9.9");
  await expect(page.locator("#updateExportButton")).toBeHidden();
  await expect(page.locator("#updateBackupAck")).not.toBeChecked();
  await expect(page.locator("#installUpdateButton")).toBeDisabled();
});
