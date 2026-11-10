import { test, expect } from "@playwright/test";

const secret = "ficticia-solo-pruebas-123!";
async function create(page) {
  await page.goto("/");
  await page.locator("#authUsername").fill("Perfil de prueba");
  await page.locator("#masterPassword").fill(secret);
  await page.locator("#confirmPassword").fill(secret);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();
}
test("crear, guardar texto hostil, bloquear limpia DOM, reabrir y cancelar edición", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await create(page);
  await page.locator("#newEntryButton").click();
  await page.locator("#entrySite").fill("<img src=x onerror=alert(1)>");
  await page.locator("#entryUsername").fill("demo@example.invalid");
  await page.locator("#entryPassword").fill("Password-Ficticia-123!");
  await page.locator("#saveEntryButton").click();
  await expect(page.locator("#entryList")).toContainText("<img src=x");
  await expect(page.locator("#entryList img")).toHaveCount(0);
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(page.locator("#entryPassword")).toHaveValue("Password-Ficticia-123!");
  await page.locator("#lockButton").evaluate((element) => element.click());
  await expect(page.locator("#entryPassword")).toHaveValue("");
  await expect(page.locator("#entryList")).toBeEmpty();
  await page.locator("#masterPassword").fill(secret);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#entryList")).toContainText("<img src=x");
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.locator("#entryDialog")).not.toBeVisible();
  expect(errors).toEqual([]);
});
test("importación con clave incorrecta no reemplaza; restauración válida funciona desde pantalla bloqueada", async ({ page }) => {
  await create(page);
  const stored = await page.evaluate(() => localStorage.getItem("clavelocal.vault.v1"));
  await page.locator("#lockButton").click();
  await page.locator("#importFile").setInputFiles({ name: "copia.json", mimeType: "application/json", buffer: Buffer.from(stored) });
  await page.locator("#importPassword").fill("incorrecta");
  await page.locator("#importForm button[type=submit]").click();
  await expect(page.locator("#importError")).toContainText("No se pudo");
  expect(await page.evaluate(() => localStorage.getItem("clavelocal.vault.v1"))).toBe(stored);
  await page.locator("#importPassword").fill(secret);
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#importForm button[type=submit]").click();
  await expect(page.locator("#importDialog")).not.toBeVisible();
  await page.locator("#masterPassword").fill(secret);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();
});
test("demo no persiste datos", async ({ page }) => {
  await page.goto("/");
  await page.locator("#demoButton").click();
  await expect(page.locator("#entryList")).toContainText("Correo de ejemplo");
  expect(await page.evaluate(() => localStorage.getItem("clavelocal.vault.v1"))).toBeNull();
  await page.locator("#lockButton").click();
  await expect(page.locator("#entryList")).toBeEmpty();
});
