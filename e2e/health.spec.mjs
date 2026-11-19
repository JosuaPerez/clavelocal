import { expect, test } from "@playwright/test";

const master = "ficticia-solo-pruebas-123!";
const reused = "caballo-nube-mesa-tiza";
const weak = "password12345678";
const unique = "otra-frase-ficticia-unica-2026";

async function addEntry(page, site, password) {
  await page.locator("#newEntryButton").click();
  await page.locator("#entrySite").fill(site);
  await page.locator("#entryUsername").fill(`${site.toLowerCase().replace(/\s/g, "")}@example.invalid`);
  await page.locator("#entryPassword").fill(password);
  await page.locator("#saveEntryButton").click();
  await expect(page.locator("#entryList")).toContainText(site);
}

test("salud de la bóveda lista débiles y repetidas sin mostrar contraseñas", async ({ page }) => {
  await page.goto("/");
  await page.locator("#authUsername").fill("Perfil de prueba");
  await page.locator("#masterPassword").fill(master);
  await page.locator("#confirmPassword").fill(master);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();

  await page.locator("#healthButton").click();
  await expect(page.locator("#healthDialog")).toBeVisible();
  await expect(page.locator("#healthSummary")).toContainText("0 entradas revisadas");
  await expect(page.locator("#healthDialog")).toContainText("No hay claves repetidas");
  await page.locator("#doneHealth").click();
  await expect(page.locator("#healthDialog")).toBeHidden();

  await addEntry(page, "Sitio Uno", reused);
  await addEntry(page, "Sitio Dos", reused);
  await addEntry(page, "Sitio Debil", weak);
  await addEntry(page, "Sitio Unico", unique);

  await page.locator("#healthButton").click();
  await expect(page.locator("#healthSummary")).toContainText("4 entradas revisadas: 1 cortas o predecibles, 1 grupos repetidos, 0 sin editar");
  await expect(page.locator("#healthWeak")).toContainText("Sitio Debil");
  await expect(page.locator("#healthWeak")).not.toContainText("Sitio Unico");
  await expect(page.locator("#healthReused")).toContainText("La misma contraseña en 2 entradas");
  await expect(page.locator("#healthReused")).toContainText("Sitio Uno");
  await expect(page.locator("#healthReused")).toContainText("Sitio Dos");
  const text = await page.locator("#healthDialog").evaluate((dialog) => dialog.innerHTML + dialog.textContent);
  for (const password of [reused, weak, unique, master]) expect(text).not.toContain(password);

  await page.locator("#healthWeak button").click();
  await expect(page.locator("#healthDialog")).toBeHidden();
  await expect(page.locator("#entryDialog")).toBeVisible();
  await expect(page.locator("#entrySite")).toHaveValue("Sitio Debil");
  await page.locator("#entryDialog .dialog-close").click();
});

test("bloquear con salud abierta cierra el diálogo y borra la lista", async ({ page }) => {
  await page.goto("/");
  await page.locator("#authUsername").fill("Perfil de prueba");
  await page.locator("#masterPassword").fill(master);
  await page.locator("#confirmPassword").fill(master);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();
  await addEntry(page, "Sitio Debil", weak);
  await page.locator("#healthButton").click();
  await expect(page.locator("#healthWeak")).toContainText("Sitio Debil");
  await page.locator("#lockButton").evaluate((button) => button.click());
  await expect(page.locator("#healthDialog")).toBeHidden();
  await expect(page.locator("#healthWeak")).toBeEmpty();
  await expect(page.locator("#healthReused")).toBeEmpty();
  await expect(page.locator("#healthSummary")).toBeEmpty();
});

test("la demo no ofrece salud de la bóveda", async ({ page }) => {
  await page.goto("http://127.0.0.1:4174/");
  await page.getByRole("link", { name: "Probar demo" }).click();
  await page.locator("#demoButton").click();
  await expect(page.locator("#entryList")).toContainText("Correo de ejemplo");
  await expect(page.locator("#healthButton")).toBeDisabled();
});
