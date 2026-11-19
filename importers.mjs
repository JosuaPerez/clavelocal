import { categoryFrom, finishPlan } from "./csv.mjs";
import { MAX_FILE_BYTES } from "./vault.mjs";

export const SOURCE_LABELS = Object.freeze({
  bitwarden: "Bitwarden (CSV)",
  keepassxc: "KeePassXC (CSV)",
  "1password": "1Password (CSV)",
  generico: "CSV genérico (Chrome, Brave u otro)",
});

// Detects the origin from the header structure, never from the file name. Formats other than Bitwarden's
// are recognised by their usual headers and handled by the same tolerant column mapping.
export function detectCsvSource(headers) {
  const names = new Set(headers.map((value) => String(value).trim().toLowerCase()));
  const has = (...wanted) => wanted.every((name) => names.has(name));
  if (has("login_password", "login_uri") && (has("folder") || has("login_username"))) return "bitwarden";
  if (has("group", "title", "password")) return "keepassxc";
  if (has("title", "password") && (names.has("otpauth") || names.has("archived") || names.has("tags"))) return "1password";
  return "generico";
}

const BITWARDEN_ENCRYPTED = "Esta exportación de Bitwarden está cifrada. Exporta de nuevo como .json sin cifrar (o como .csv) y vuelve a intentarlo.";

// A Bitwarden JSON export is recognised by `encrypted` plus either the items list or encrypted payload keys.
export function isBitwardenExport(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && typeof value.encrypted === "boolean"
    && (Array.isArray(value.items) || "data" in value || "encKeyValidation_DO_NOT_EDIT" in value);
}

const text = (value) => typeof value === "string" ? value : "";

export function planBitwardenExport(source, existing) {
  let parsed = source;
  if (typeof source === "string") {
    if (new TextEncoder().encode(source).length > MAX_FILE_BYTES) throw new Error("El archivo supera 4 MiB.");
    try { parsed = JSON.parse(source); } catch { throw new Error("El archivo JSON no es válido. No se guardó ningún registro."); }
  }
  if (!isBitwardenExport(parsed)) throw new Error("El archivo no parece una exportación de Bitwarden.");
  if (parsed.encrypted === true) throw new Error(BITWARDEN_ENCRYPTED);
  if (!Array.isArray(parsed.items)) throw new Error("La exportación de Bitwarden no contiene elementos.");
  if (parsed.items.length > 5000) throw new Error("El archivo supera 5.000 registros.");
  // Only known fields are read, with type checks; keys from the file are never used as property names.
  const folders = new Map();
  if (Array.isArray(parsed.folders)) for (const folder of parsed.folders) if (folder && typeof folder.id === "string" && typeof folder.name === "string") folders.set(folder.id, folder.name);
  const candidates = [];
  let skipped = 0, totp = 0, fields = 0;
  for (const [index, item] of parsed.items.entries()) {
    const row = index + 1;
    if (!item || typeof item !== "object" || Array.isArray(item)) { candidates.push({ row, error: "Elemento no válido" }); continue; }
    if (item.type !== 1) { skipped++; continue; }
    const login = item.login && typeof item.login === "object" ? item.login : {};
    const uris = Array.isArray(login.uris) ? login.uris.map((entry) => text(entry?.uri).trim()).filter(Boolean) : [];
    let site = text(item.name).trim();
    if (!site && uris[0]) { try { site = new URL(uris[0]).hostname || uris[0]; } catch { site = uris[0]; } }
    if (text(login.totp).trim()) totp++;
    if (Array.isArray(item.fields) && item.fields.length) fields++;
    candidates.push({ row, entry: { site, username: text(login.username), password: text(login.password), notes: [text(item.notes), ...uris.map((uri) => `URL: ${uri}`)].filter(Boolean).join("\n"), category: categoryFrom(folders.get(item.folderId)), favorite: item.favorite === true } });
  }
  return finishPlan(candidates, existing, { total: parsed.items.length, skipped, totp, fields });
}
