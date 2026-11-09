import { MAX_FILE_BYTES, validateVault } from "./vault.mjs";

const aliases = {
  site: ["name", "title", "nombre", "sitio"],
  url: ["url", "website", "login_uri"],
  username: ["username", "user", "login_username", "usuario", "email"],
  password: ["password", "login_password", "contraseña", "contrasena"],
  notes: ["note", "notes", "notas", "comentarios"],
};

export function parseCsv(text) {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES) throw new Error("El archivo supera 4 MiB.");
  text = text.replace(/^\uFEFF/, "");
  // Detect the separator using only the header, ignoring separators inside quotes.
  const counts = new Map([[",", 0], [";", 0], ["\t", 0]]);
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') { if (quoted && text[i + 1] === '"') i++; else quoted = !quoted; }
    else if (!quoted && /[\r\n]/.test(char)) break;
    else if (!quoted && counts.has(char)) counts.set(char, counts.get(char) + 1);
  }
  const delimiter = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], field = "", mode = "start";
  function endField() {
    row.push(field); field = ""; mode = "start";
    if (row.length > 64) throw new Error("Demasiadas columnas en el CSV.");
  }
  function endRow() {
    endField();
    if (row.some((value) => value !== "")) rows.push(row);
    row = [];
    if (rows.length > 5001) throw new Error("El CSV supera 5.000 registros.");
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (mode === "quoted") {
      if (char === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else mode = "closed"; }
      else field += char;
    } else if (char === delimiter) endField();
    else if (char === "\r" || char === "\n") { endRow(); if (char === "\r" && text[i + 1] === "\n") i++; }
    else if (char === '"' && mode === "start") mode = "quoted";
    else {
      if (mode === "closed" || char === '"') throw new Error("Comillas incorrectas en el CSV. No se guardó ningún registro.");
      field += char; mode = "plain";
    }
    if (field.length > 8192) throw new Error("Una celda supera el tamaño admitido.");
  }
  if (mode === "quoted") throw new Error("El CSV contiene comillas sin cerrar.");
  if (field || row.length || mode === "closed") endRow();
  if (rows.length < 2) throw new Error("El CSV necesita cabeceras y al menos un registro.");
  const headers = rows.shift();
  const normalized = headers.map((value) => value.trim().toLowerCase());
  const mapping = Object.fromEntries(Object.entries(aliases).map(([fieldName, names]) => [fieldName, normalized.findIndex((value) => names.includes(value))]));
  return { headers, rows, mapping, delimiter };
}

export function planCsvImport(parsed, mapping, existing) {
  const chosen = Object.values(mapping).filter((value) => value !== -1);
  if (chosen.some((value) => !Number.isInteger(value) || value < 0 || value >= parsed.headers.length) || new Set(chosen).size !== chosen.length || mapping.password < 0 || (mapping.site < 0 && mapping.url < 0)) throw new Error("Selecciona una columna de contraseña y otra de nombre o URL. No repitas columnas.");
  const entries = [], issues = [];
  let duplicates = 0;
  const fingerprint = (entry) => JSON.stringify([entry.site, entry.username, entry.password, entry.notes]);
  const known = new Set(existing.entries.map(fingerprint));
  for (const [index, row] of parsed.rows.entries()) {
    if (row.length !== parsed.headers.length) { issues.push({ row: index + 2, reason: "Número de columnas distinto a la cabecera" }); continue; }
    const get = (field) => mapping[field] >= 0 ? row[mapping[field]] : "";
    const url = get("url").trim();
    let site = get("site").trim();
    if (!site && url) { try { site = new URL(url).hostname || url; } catch { site = url; } }
    const note = get("notes");
    const entry = { id: crypto.randomUUID(), site, username: get("username"), password: get("password"), notes: [note, url ? `URL: ${url}` : ""].filter(Boolean).join("\n"), category: "Personal", favorite: false, updatedAt: new Date().toISOString() };
    try { validateVault({ version: 1, entries: [entry] }); }
    catch { issues.push({ row: index + 2, reason: "Nombre o contraseña vacíos, o campo demasiado largo" }); continue; }
    const key = fingerprint(entry);
    if (known.has(key)) { duplicates++; continue; }
    known.add(key);
    entries.push(entry);
  }
  if (entries.length + existing.entries.length > 5000) throw new Error("La importación superaría el límite de 5.000 entradas de la bóveda.");
  return { entries, issues, duplicates, total: parsed.rows.length };
}
