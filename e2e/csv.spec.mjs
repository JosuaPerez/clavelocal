import { test, expect } from "@playwright/test";
const password = "solo-pruebas-clave-ficticia-123!";
async function create(page) {
  await page.goto("/");
  await page.locator("#authUsername").fill("Perfil de prueba");
  await page.locator("#masterPassword").fill(password);
  await page.locator("#confirmPassword").fill(password);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();
}
const csv = 'name,url,username,password,note\n"Correo, ejemplo",https://example.invalid,ana@example.invalid,"prueba,""123""",nota\nSin clave,https://example.invalid,ana,,\n';
async function load(page) {
  await page.locator("#importFile").setInputFiles({ name: "Chrome Passwords.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.locator("#csvDialog")).toBeVisible();
}
test("CSV solo local, vista previa sin contraseñas, cancelación, cifrado y duplicados", async ({ page }) => {
  await create(page);
  const before = await page.evaluate(() => localStorage.getItem("clavelocal.vault.v1"));
  await load(page);
  await expect(page.locator("#csvSummary")).toContainText("1 nuevos");
  await expect(page.locator("#csvIssues")).toContainText("Registro 3");
  await expect(page.locator("#csvDialog")).not.toContainText('prueba,"123"');
  await page.locator("#cancelCsv").click();
  expect(await page.evaluate(() => localStorage.getItem("clavelocal.vault.v1"))).toBe(before);
  await load(page);
  await page.locator("#csvAcknowledge").check();
  await page.locator("#confirmCsv").click();
  await expect(page.locator("#csvDialog")).not.toBeVisible();
  await expect(page.locator("#entryList")).toContainText("Correo, ejemplo");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain("ana@example.invalid");
  await load(page);
  await expect(page.locator("#csvSummary")).toContainText("1 duplicados exactos");
  await expect(page.locator("#confirmCsv")).toBeDisabled();
  await page.locator("#cancelCsv").click();
  await page.locator("#lockButton").click();
  await expect(page.locator("#csvMapping")).toBeEmpty();
  await page.locator("#masterPassword").fill(password);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultGreeting")).toHaveText("Hola, Perfil de prueba");
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await expect(page.locator("#entryPassword")).toHaveValue('prueba,"123"');
});
test("bloquear cancela CSV sin guardar ni conservar su vista previa", async ({ page }) => {
  await create(page);
  await load(page);
  await page.locator("#lockButton").evaluate((button) => button.click());
  await expect(page.locator("#csvDialog")).not.toBeVisible();
  await expect(page.locator("#csvMapping")).toBeEmpty();
  await expect(page.locator("#csvSummary")).toBeEmpty();
});

test("un evento de cierre tardío no vacía una importación CSV reabierta", async ({ page }) => {
  await create(page);
  await load(page);
  await page.locator("#cancelCsv").click();
  await load(page);
  // close is queued by the browser; a previous close can arrive after reopening.
  await page.evaluate(() => document.querySelector("#csvDialog").dispatchEvent(new Event("close")));
  await expect(page.locator("#csvSummary")).toContainText("1 nuevos");
  await page.locator("#csvAcknowledge").check();
  await page.locator("#confirmCsv").click();
  await expect(page.locator("#csvDialog")).not.toBeVisible();
  await expect(page.locator("#entryList")).toContainText("Correo, ejemplo");
});
