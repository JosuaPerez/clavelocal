import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("Ayuda muestra la versión instalada y su estado experimental", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ayuda" }).click();
  await expect(page.locator("#appVersionLine")).toHaveText(`ClaveLocal ${version} · experimental, sin auditoría independiente.`);
  await expect(page.locator("#updateCurrentVersion")).toHaveText(`Versión instalada: ${version}`);
});
