import { test, expect } from "@playwright/test";
test("el navegador no ofrece instalar actualizaciones nativas", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#checkUpdatesButton")).toBeHidden();
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
  await page.locator("#checkUpdatesButton").click();
  await expect(page.locator("#updateStatus")).toContainText("9.9.9");
  await expect(page.locator("#updateNotes img")).toHaveCount(0);
  await page.locator("#installUpdateButton").click();
  await expect(page.locator("#updateStatus")).toContainText("Exporta una copia");
  await page.locator("#updateBackupAck").check();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#installUpdateButton").click();
  await expect(page.locator("#updateStatus")).toContainText("Error ficticio de firma");
});
