import { test, expect } from "@playwright/test";
const password = "solo-pruebas-scroll-ficticia";

test("en escritorio solo se desplaza la lista: ni la ventana ni el menú muestran barra", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await page.evaluate(async (password) => {
    const { randomBytes, deriveKey, encryptVault } = await import("/vault.mjs");
    const salt = randomBytes(16);
    const entries = Array.from({ length: 60 }, (_, index) => ({
      id: `example-${index}`, site: `Sitio ${String(index).padStart(3, "0")}`, username: `user${index}@example.invalid`, password: "contraseña-ficticia", notes: "", category: "Personal", favorite: false, updatedAt: "2026-11-09T00:00:00Z",
    }));
    localStorage.setItem("clavelocal.vault.v1", JSON.stringify(await encryptVault(await deriveKey(password, salt), { version: 1, profile: { version: 1, username: "Perfil de prueba" }, entries }, salt)));
  }, password);
  await page.reload();
  await page.locator("#masterPassword").fill(password);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const content = document.querySelector(".vault-content");
    const side = document.querySelector(".sidebar");
    return {
      windowScrolls: document.documentElement.scrollHeight > window.innerHeight + 1,
      contentScrolls: content.scrollHeight > content.clientHeight + 1,
      sidebarBar: side.offsetWidth - side.clientWidth > 4,
    };
  });
  expect(metrics.windowScrolls).toBe(false);
  expect(metrics.contentScrolls).toBe(true);
  expect(metrics.sidebarBar).toBe(false);
  await expect(page.locator("#lockButton")).toBeVisible();
});
