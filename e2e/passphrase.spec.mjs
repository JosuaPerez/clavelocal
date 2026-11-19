import { expect, test } from "@playwright/test";

const master = "ficticia-solo-pruebas-123!";

test("el generador ofrece frases y las usa en una entrada nueva", async ({ page }) => {
  await page.goto("/");
  await page.locator("#authUsername").fill("Perfil de prueba");
  await page.locator("#masterPassword").fill(master);
  await page.locator("#confirmPassword").fill(master);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();

  await page.locator("#openGeneratorButton").click();
  await expect(page.locator("#passphraseOptions")).toBeHidden();
  await page.locator("label:has(#modePassphrase)").click();
  await expect(page.locator("#passwordOptions")).toBeHidden();
  await expect(page.locator("#passphraseOptions")).toBeVisible();
  await expect(page.locator("#generatedPassword")).toHaveText(/^[a-z]+(-[a-z]+){5}$/);
  await expect(page.locator("#generatorStrengthLabel")).toContainText("Unos 66 bits: 6 palabras elegidas al azar de una lista pública de 2048");

  await page.locator("#passphraseWords").fill("8");
  await expect(page.locator("#wordsValue")).toHaveText("8");
  await page.locator("#passphraseSeparator").selectOption(" ");
  await page.locator("label:has(#passphraseCapitalize)").click();
  await page.locator("label:has(#passphraseNumber)").click();
  await expect(page.locator("#generatedPassword")).toHaveText(/^[A-Z][a-z]+( [A-Z][a-z]+){7}\d$/);
  await expect(page.locator("#generatorStrengthLabel")).toContainText("Unos 91 bits: 8 palabras");

  const phrase = await page.locator("#generatedPassword").textContent();
  await page.locator("#useGeneratedButton").click();
  await expect(page.locator("#entryPassword")).toHaveValue(phrase);
  await page.locator("#entryDialog .dialog-close").click();

  await page.locator("#openGeneratorButton").click();
  await expect(page.locator("#generatedPassword")).not.toHaveText("");
  await page.keyboard.press("Escape");
  await expect(page.locator("#generatedPassword")).toBeEmpty();
});
