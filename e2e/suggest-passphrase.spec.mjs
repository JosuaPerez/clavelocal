import { expect, test } from "@playwright/test";

test("sugerir una frase rellena ambos campos y exige confirmar que se anotó", async ({ page }) => {
  await page.goto("/");
  await page.locator("#authUsername").fill("Perfil de prueba");
  await page.locator("#masterPassword").fill("a");
  await page.locator("#suggestPassphrase").click();

  const phrase = await page.locator("#masterPassword").inputValue();
  expect(phrase.split("-")).toHaveLength(6);
  expect(await page.locator("#confirmPassword").inputValue()).toBe(phrase);
  await expect(page.locator("#masterPassword")).toHaveAttribute("type", "text");
  await expect(page.locator("#suggestionPhrase")).toHaveText(phrase);
  await expect(page.locator("#suggestionNote")).toContainText("6 palabras");
  await expect(page.locator("#suggestionNote")).toContainText("66 bits");
  await expect(page.locator("#authSubmit")).toBeDisabled();

  await page.locator("#suggestionAck").check();
  await expect(page.locator("#authSubmit")).toBeEnabled();
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();
  await expect(page.locator("#masterPassword")).toHaveAttribute("type", "password");
  await expect(page.locator("#suggestionNote")).toBeHidden();
  await expect(page.locator("#suggestionPhrase")).toBeHidden();
  await expect(page.locator("#suggestionPhrase")).toHaveText("");

  // La bóveda creada se abre con la misma frase.
  await page.locator("#lockButton").click();
  await page.locator("#masterPassword").fill(phrase);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();
});

test("editar a mano la clave retira la sugerencia y la confirmación", async ({ page }) => {
  await page.goto("/");
  await page.locator("#authUsername").fill("Perfil de prueba");
  await page.locator("#masterPassword").fill("a");
  await page.locator("#suggestPassphrase").click();
  await expect(page.locator("#suggestionAckLabel")).toBeVisible();
  await page.locator("#masterPassword").fill("otra-clave-ficticia-2026!");
  await expect(page.locator("#suggestionAckLabel")).toBeHidden();
  await expect(page.locator("#suggestionNote")).toBeHidden();
});

test("el botón de crear cabe sin desplazarse en una pantalla de 1280×800", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.locator("#masterPassword").fill("a");
  const box = await page.locator("#authSubmit").boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(800);
});
