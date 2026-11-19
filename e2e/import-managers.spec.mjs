import { expect, test } from "@playwright/test";

const master = "solo-pruebas-clave-ficticia-123!";
const bitwarden = JSON.stringify({
  encrypted: false,
  folders: [{ id: "f1", name: "Finanzas" }],
  items: [
    { id: "1", folderId: "f1", type: 1, name: "Banco ficticio", notes: "nota", favorite: true, login: { username: "ana", password: "clave-bw-ficticia-1", totp: "otpauth://totp/x?secret=ABC", uris: [{ uri: "https://banco.invalid", match: null }] } },
    { id: "2", folderId: null, type: 1, name: "Foro ficticio", favorite: false, login: { username: "ana", password: "clave-bw-ficticia-2", totp: null, uris: [] } },
    { id: "3", folderId: null, type: 3, name: "Tarjeta ficticia", favorite: false, card: {} },
  ],
});
const keepass = '"Group","Title","Username","Password","URL","Notes","TOTP"\n"Root/Trabajo","Intranet ficticia","ana","clave-kp-ficticia-1","https://intranet.invalid","",""\n';

async function create(page) {
  await page.goto("/");
  await page.locator("#authUsername").fill("Perfil de prueba");
  await page.locator("#masterPassword").fill(master);
  await page.locator("#confirmPassword").fill(master);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#vaultView")).toBeVisible();
}

async function choose(page, button, file) {
  const chooser = page.waitForEvent("filechooser");
  await page.locator(button).click();
  await (await chooser).setFiles(file);
}

test("importa un JSON de Bitwarden sin cifrar con resumen, aviso de TOTP y sin mostrar contraseñas", async ({ page }) => {
  await create(page);
  await choose(page, "#csvImportButton", { name: "bitwarden_export.json", mimeType: "application/json", buffer: Buffer.from(bitwarden) });
  await expect(page.locator("#csvDialog")).toBeVisible();
  await expect(page.locator("#csvSource")).toContainText("Bitwarden (JSON sin cifrar)");
  await expect(page.locator("#csvSummary")).toContainText("3 registros: 2 nuevos, 0 duplicados exactos y 0 no válidos. 1 omitidos por no ser inicios de sesión.");
  await expect(page.locator("#csvNotice")).toContainText("1 con códigos TOTP");
  await expect(page.locator("#csvNotice")).toContainText("No elimines tu origen");
  await expect(page.locator("#csvDialog")).not.toContainText("clave-bw-ficticia");
  await page.locator("#csvAcknowledge").check();
  await page.locator("#confirmCsv").click();
  await expect(page.locator("#csvDialog")).not.toBeVisible();
  await expect(page.locator("#entryList")).toContainText("Banco ficticio");
  await expect(page.locator("#entryList")).toContainText("Foro ficticio");
  await expect(page.locator("#entryList")).not.toContainText("Tarjeta ficticia");
});

test("detecta KeePassXC por sus cabeceras y asigna la categoría desde el grupo", async ({ page }) => {
  await create(page);
  await choose(page, "#csvImportButton", { name: "export.csv", mimeType: "text/csv", buffer: Buffer.from(keepass) });
  await expect(page.locator("#csvSource")).toContainText("KeePassXC (CSV)");
  await expect(page.locator("#csvSummary")).toContainText("1 nuevos");
  await page.locator("#csvAcknowledge").check();
  await page.locator("#confirmCsv").click();
  await page.locator('[data-category="Trabajo"], button:has-text("Trabajo")').first().click();
  await expect(page.locator("#entryList")).toContainText("Intranet ficticia");
});

test("un JSON de Bitwarden cifrado se rechaza sin abrir el diálogo", async ({ page }) => {
  await create(page);
  await choose(page, "#csvImportButton", { name: "enc.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ encrypted: true, encKeyValidation_DO_NOT_EDIT: "2.a|b|c", data: "2.a|b|c" })) });
  await expect(page.locator("#toast")).toContainText("cifrada");
  await expect(page.locator("#csvDialog")).not.toBeVisible();
});

test("cada botón indica el flujo correcto si se elige el archivo equivocado", async ({ page }) => {
  await create(page);
  await choose(page, "#importButton", { name: "bw.json", mimeType: "application/json", buffer: Buffer.from(bitwarden) });
  await expect(page.locator("#toast")).toContainText("Usa «Importar desde otro gestor»");
  await expect(page.locator("#csvDialog")).not.toBeVisible();
  const bytes = (length) => Buffer.alloc(length, 1).toString("base64");
  const envelope = { format: "clavelocal-v1", kdf: { name: "PBKDF2-SHA256", iterations: 600000, salt: bytes(16) }, cipher: { name: "AES-256-GCM", iv: bytes(12), data: bytes(32) } };
  await choose(page, "#csvImportButton", { name: "copia.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(envelope)) });
  await expect(page.locator("#toast")).toContainText("Usa «Restaurar copia»");
  await expect(page.locator("#importDialog")).not.toBeVisible();
});

test("bloquear con la importación abierta no conserva el resumen", async ({ page }) => {
  await create(page);
  await choose(page, "#csvImportButton", { name: "bitwarden_export.json", mimeType: "application/json", buffer: Buffer.from(bitwarden) });
  await expect(page.locator("#csvDialog")).toBeVisible();
  await page.locator("#lockButton").evaluate((button) => button.click());
  await expect(page.locator("#csvDialog")).not.toBeVisible();
  await expect(page.locator("#csvSummary")).toBeEmpty();
  await expect(page.locator("#csvNotice")).toBeEmpty();
  await expect(page.locator("#csvSource")).toBeEmpty();
});
