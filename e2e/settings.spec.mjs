import { test, expect } from "@playwright/test";
const password = "solo-pruebas-ajustes-ficticios";
async function create(page) {
  await page.clock.install();
  await page.goto("/");
  await page.locator("#authUsername").fill("Perfil de prueba");
  await page.locator("#masterPassword").fill(password);
  await page.locator("#confirmPassword").fill(password);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();
}
async function configure(page, idle, grace) {
  await page.locator("#settingsButton").click();
  await expect(page.locator("#idleMinutes")).toBeFocused();
  await page.locator("#idleMinutes").selectOption(idle);
  await page.locator("#hiddenSeconds").selectOption(grace);
  await page.locator("#saveSettings").click();
  await expect(page.locator("#settingsDialog")).not.toBeVisible();
}
const hide = (page, hidden) => page.evaluate((hidden) => {
  Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}, hidden);

test("ajustes se guardan cifrados y reapertura conserva gracia; bloqueo manual inmediato", async ({ page }) => {
  await create(page);
  await page.locator("#settingsButton").click();
  await expect(page.locator("#idleMinutes")).toHaveValue("5");
  await expect(page.locator("#hiddenSeconds")).toHaveValue("0");
  await page.keyboard.press("Escape");
  await expect(page.locator("#settingsButton")).toBeFocused();
  await configure(page, "15", "15");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain("hiddenSeconds");
  const settings = await page.evaluate(async (password) => {
    const { openVault } = await import("/vault.mjs");
    return (await openVault(password, JSON.parse(localStorage.getItem("clavelocal.vault.v1")))).vault.settings;
  }, password);
  expect(settings).toEqual({ idleMinutes: 15, hiddenSeconds: 15 });
  await page.reload();
  await page.locator("#masterPassword").fill(password);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();
  await hide(page, true);
  await page.clock.runFor(14000);
  await expect(page.locator("#vaultView")).toBeVisible();
  await page.clock.runFor(1001);
  await expect(page.locator("#vaultView")).not.toBeVisible();
  await hide(page, false);
  await page.locator("#masterPassword").fill(password);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();
  await page.locator("#settingsButton").click();
  await page.locator("#lockButton").evaluate((button) => button.click());
  await expect(page.locator("#settingsDialog")).not.toBeVisible();
  await expect(page.locator("#vaultView")).not.toBeVisible();
});
test("sin ajustes: bloqueo inmediato; 60s de gracia se cancelan al volver; cerrar siempre bloquea", async ({ page }) => {
  await create(page);
  await hide(page, true);
  await expect(page.locator("#vaultView")).not.toBeVisible();
  await hide(page, false);
  await page.locator("#masterPassword").fill(password);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();
  await configure(page, "30", "60");
  await hide(page, true); await page.clock.runFor(59000);
  await expect(page.locator("#vaultView")).toBeVisible();
  await hide(page, false); await page.clock.runFor(2000);
  await expect(page.locator("#vaultView")).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect(page.locator("#vaultView")).not.toBeVisible();
});
test("inactividad configurable no se prolonga por gracia", async ({ page }) => {
  await create(page);
  await configure(page, "1", "60");
  await page.clock.runFor(59000);
  await expect(page.locator("#vaultView")).toBeVisible();
  await hide(page, true); await page.clock.runFor(1001);
  await expect(page.locator("#vaultView")).not.toBeVisible();
});

test("un guardado tardío de ajustes en ventana oculta no reinicia la gracia", async ({ page }) => {
  await create(page);
  await configure(page, "5", "60");
  await page.evaluate(() => {
    const original = navigator.locks.request.bind(navigator.locks);
    navigator.locks.request = async (...args) => {
      const result = await original(...args);
      await new Promise((resolve) => { window.finishSettingsSave = resolve; });
      return result;
    };
  });
  await page.locator("#settingsButton").click();
  await page.locator("#hiddenSeconds").selectOption("15");
  await page.locator("#saveSettings").click();
  await page.waitForFunction(() => typeof window.finishSettingsSave === "function");
  await hide(page, true);
  await page.clock.runFor(10000);
  await page.evaluate(() => window.finishSettingsSave());
  await expect(page.locator("#vaultView")).not.toBeVisible();
  await expect(page.locator("#settingsDialog")).not.toBeVisible();
});
