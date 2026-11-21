import { expect, test } from "@playwright/test";

const master = "ficticia-solo-pruebas-123!";
test.use({ viewport: { width: 390, height: 800 } });

async function createVault(page) {
  await page.goto("/");
  await page.locator("#authUsername").fill("Perfil de prueba");
  await page.locator("#masterPassword").fill(master);
  await page.locator("#confirmPassword").fill(master);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();
}

async function addEntry(page, site, category) {
  await page.locator("#newEntryButton").click();
  await page.locator("#entrySite").fill(site);
  await page.locator("#entryUsername").fill("usuario@example.invalid");
  await page.locator("#entryCategory").selectOption(category);
  await page.locator("#entryPassword").fill("caballo-nube-mesa-tiza");
  await page.locator("#saveEntryButton").click();
  await expect(page.locator("#entryList")).toContainText(site.slice(0, 20));
}

const noHorizontalScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("en móvil las categorías siguen disponibles y filtran la lista", async ({ page }) => {
  await createVault(page);
  await addEntry(page, "Banco Uno", "Finanzas");
  await addEntry(page, "Correo Uno", "Personal");
  await page.locator("#categoryNav").getByRole("button", { name: /Finanzas/ }).click();
  await expect(page.locator("#entryList")).toContainText("Banco Uno");
  await expect(page.locator("#entryList")).not.toContainText("Correo Uno");
  await page.getByRole("button", { name: /Todas/ }).click();
  await expect(page.locator("#entryList")).toContainText("Correo Uno");
});

test("en móvil el menú de seguridad, copias y cuenta se despliega y se pliega", async ({ page }) => {
  await createVault(page);
  const toggle = page.locator("#menuToggle");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#exportButton")).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#exportButton")).toBeVisible();
  await expect(page.locator("#healthButton")).toBeVisible();
  await toggle.click();
  await expect(page.locator("#exportButton")).toBeHidden();
});

test("en móvil una fila con nombre larguísimo no desborda la pantalla", async ({ page }) => {
  await createVault(page);
  await addEntry(page, "W".repeat(80), "Otros");
  expect(await noHorizontalScroll(page)).toBe(true);
  const card = await page.locator(".entry-card").first().boundingBox();
  expect(card.x + card.width).toBeLessThanOrEqual(390);
  await page.locator("#menuToggle").click();
  expect(await noHorizontalScroll(page)).toBe(true);
});

test("en escritorio no aparece el botón de menú", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await createVault(page);
  await expect(page.locator("#menuToggle")).toBeHidden();
  await expect(page.locator("#exportButton")).toBeVisible();
});

test("en móvil el formulario de crear la bóveda se ve sin desplazarse", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const box = await page.locator("#authUsername").boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  expect(await noHorizontalScroll(page)).toBe(true);
});
