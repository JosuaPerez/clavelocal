import { test, expect } from "@playwright/test";
async function prepare(page, native = false) {
  await page.addInitScript((native) => {
    window.clipText = "";
    window.blockRead = false;
    Object.defineProperty(navigator, "clipboard", { value: {
      writeText: async (text) => { window.clipText = text; },
      readText: async () => { if (window.blockRead) throw new Error("permission"); return window.clipText; },
    } });
    if (native) window.__TAURI__ = { core: { invoke: async (command, args) => {
      window.nativeCopy = { command, args };
      if (window.failNative) throw new Error("native failed");
    } } };
  }, native);
  await page.clock.install();
  await page.goto("/");
  await page.locator("#demoButton").click();
  await page.getByRole("button", { name: "Copiar contraseña", exact: true }).first().click();
}
test("copiar, ocultar y bloquear no cancela la limpieza", async ({ page }) => {
  await prepare(page);
  await expect.poll(() => page.evaluate(() => window.clipText)).not.toBe("");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("#vaultView")).not.toBeVisible();
  await page.clock.runFor(30001);
  await expect.poll(() => page.evaluate(() => window.clipText)).toBe("");
});
test("lectura bloqueada conserva el texto; al volver reintenta sin borrar otros textos", async ({ page }) => {
  await prepare(page);
  await expect.poll(() => page.evaluate(() => window.clipText)).not.toBe("");
  await page.evaluate(() => { window.blockRead = true; });
  await page.clock.runFor(30001);
  await expect(page.locator("#toast")).toContainText("no permitió limpiar");
  await page.evaluate(() => {
    window.blockRead = false;
    window.clipText = "otro texto";
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => page.evaluate(() => window.clipText)).toBe("otro texto");
});
test("escritorio usa solo el comando nativo y no recurre a web si falla", async ({ page }) => {
  await prepare(page, true);
  await expect.poll(() => page.evaluate(() => window.nativeCopy?.command)).toBe("copy_secret");
  expect(await page.evaluate(() => window.clipText)).toBe("");
  await page.evaluate(() => { window.failNative = true; });
  await page.getByRole("button", { name: "Copiar contraseña", exact: true }).first().click();
  await expect(page.locator("#toast")).toContainText("No se pudo copiar");
  expect(await page.evaluate(() => window.clipText)).toBe("");
});
