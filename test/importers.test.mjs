import assert from "node:assert/strict";
import test from "node:test";
import { parseCsv, planCsvImport } from "../csv.mjs";
import { detectCsvSource, isBitwardenExport, planBitwardenExport } from "../importers.mjs";

const empty = { version: 1, entries: [] };
const plan = (csv, existing = empty) => { const parsed = parseCsv(csv); return planCsvImport(parsed, parsed.mapping, existing); };

// Fictitious fixtures. Headers follow the Bitwarden SDK exporter; KeePassXC and 1Password headers are pending verification against real exports.
const bitwardenCsv = [
  "folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp",
  'Trabajo,1,login,Correo,nota uno,"api: valor",0,"https://example.invalid,https://alt.example.invalid",ana@example.invalid,clave-ficticia-1,otpauth://totp/x?secret=ABC',
  ",,login,Sin carpeta,,,0,,ana,clave-ficticia-2,",
  "Notas,,note,Nota segura,texto,,0,,,,",
].join("\n");

test("detecta el origen por las cabeceras, no por el nombre", () => {
  assert.equal(detectCsvSource(parseCsv(bitwardenCsv).headers), "bitwarden");
  assert.equal(detectCsvSource(["Group", "Title", "Username", "Password", "URL", "Notes", "TOTP"]), "keepassxc");
  assert.equal(detectCsvSource(["Title", "Url", "Username", "Password", "OTPAuth", "Favorite", "Archived", "Tags", "Notes"]), "1password");
  assert.equal(detectCsvSource(["name", "url", "username", "password", "note"]), "generico");
});

test("Bitwarden CSV: carpeta, favorito, varias URL, TOTP avisado y nota segura omitida", () => {
  const result = plan(bitwardenCsv);
  assert.equal(result.entries.length, 2);
  assert.equal(result.skipped, 1);
  assert.equal(result.totp, 1);
  assert.equal(result.fields, 1);
  const [first, second] = result.entries;
  assert.equal(first.category, "Trabajo");
  assert.equal(first.favorite, true);
  assert.equal(first.notes, "nota uno\nURL: https://example.invalid\nURL: https://alt.example.invalid");
  assert.doesNotMatch(JSON.stringify(result.entries), /secret=ABC|otpauth/);
  assert.equal(second.category, "Personal");
  assert.equal(second.favorite, false);
  assert.equal(second.site, "Sin carpeta");
});

test("KeePassXC CSV: grupo como categoría (último segmento) y TOTP no importado", () => {
  const csv = '"Group","Title","Username","Password","URL","Notes","TOTP","Icon","Last Modified","Created"\n"Root/Finanzas","Banco","ana","clave-ficticia-3","https://banco.invalid","","JBSWY3DP","0","2026-01-01T00:00:00Z","2026-01-01T00:00:00Z"\n"Root/Otro grupo","Foro","ana","clave-ficticia-4","","","","0","",""';
  const result = plan(csv);
  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[0].category, "Finanzas");
  assert.equal(result.entries[1].category, "Personal");
  assert.equal(result.totp, 1);
  assert.doesNotMatch(JSON.stringify(result.entries), /JBSWY3DP/);
});

test("1Password CSV: URL, usuario y notas; favorito y OTPAuth", () => {
  const csv = "Title,Url,Username,Password,OTPAuth,Favorite,Archived,Tags,Notes\nCorreo,https://example.invalid,ana,clave-ficticia-5,otpauth://totp/y?secret=ZZZ,true,false,uno,mi nota\n";
  const result = plan(csv);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].favorite, true);
  assert.equal(result.entries[0].notes, "mi nota\nURL: https://example.invalid");
  assert.equal(result.totp, 1);
});

test("tipos que no son inicio de sesión se omiten y se cuentan en cualquier CSV con columna Type", () => {
  const csv = "Title,Username,URL,Password,Notes,Type\nUno,ana,https://example.invalid,clave-6,,Login\nDos,ana,,clave-7,,Credit Card\n";
  const result = plan(csv);
  assert.equal(result.entries.length, 1);
  assert.equal(result.skipped, 1);
});

const bitwardenJson = (items, extra = {}) => ({ encrypted: false, folders: [{ id: "f1", name: "Finanzas" }, { id: "f2", name: "Taller" }], items, ...extra });
const login = (over = {}) => ({ id: "1", folderId: "f1", type: 1, name: "Banco", notes: "una nota", favorite: true, login: { username: "ana", password: "clave-json-1", totp: "", uris: [{ uri: "https://banco.invalid", match: null }] }, ...over });

test("Bitwarden JSON: convierte inicios de sesión y omite tarjetas, identidades y notas", () => {
  const result = planBitwardenExport(JSON.stringify(bitwardenJson([
    login(),
    login({ id: "2", type: 2, name: "Nota", login: undefined }),
    login({ id: "3", type: 3, name: "Tarjeta" }),
    login({ id: "4", type: 4, name: "Identidad" }),
    login({ id: "5", type: 5, name: "SSH" }),
  ])), empty);
  assert.equal(result.entries.length, 1);
  assert.equal(result.skipped, 4);
  assert.equal(result.total, 5);
  const [entry] = result.entries;
  assert.deepEqual([entry.site, entry.username, entry.password, entry.category, entry.favorite], ["Banco", "ana", "clave-json-1", "Finanzas", true]);
  assert.equal(entry.notes, "una nota\nURL: https://banco.invalid");
});

test("Bitwarden JSON: carpeta desconocida es Personal; TOTP y campos se cuentan sin guardarse", () => {
  const result = planBitwardenExport(bitwardenJson([
    login({ folderId: "f2", login: { username: "u", password: "clave-json-2", totp: "otpauth://totp/z?secret=QQQ", uris: [] }, fields: [{ name: "pin", value: "1234", type: 1 }] }),
  ]), empty);
  assert.equal(result.entries[0].category, "Personal");
  assert.equal(result.totp, 1);
  assert.equal(result.fields, 1);
  assert.doesNotMatch(JSON.stringify(result.entries), /secret=QQQ|1234/);
});

test("Bitwarden JSON: sitio vacío usa el host de la primera URL", () => {
  const result = planBitwardenExport(bitwardenJson([login({ name: "" })]), empty);
  assert.equal(result.entries[0].site, "banco.invalid");
});

test("Bitwarden JSON cifrado se rechaza con un mensaje claro", () => {
  for (const encrypted of [{ encrypted: true, encKeyValidation_DO_NOT_EDIT: "2.x|y|z", data: "2.a|b|c" }, { encrypted: true, items: [] }]) {
    assert.equal(isBitwardenExport(encrypted), true);
    assert.throws(() => planBitwardenExport(encrypted, empty), /cifrada/);
  }
});

test("no confunde otros JSON con exportaciones de Bitwarden", () => {
  for (const value of [null, [], {}, { items: [] }, { encrypted: "false", items: [] }, { format: "clavelocal-v1" }]) assert.equal(isBitwardenExport(value), false);
  assert.throws(() => planBitwardenExport("{}", empty), /no parece/);
  assert.throws(() => planBitwardenExport("no es json", empty), /no es válido/);
});

test("claves hostiles en el JSON no contaminan prototipos ni rompen la importación", () => {
  const hostile = '{"encrypted":false,"folders":[{"id":"__proto__","name":"Finanzas"}],"items":[{"type":1,"name":"Sitio","folderId":"__proto__","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"login":{"username":"u","password":"clave-json-3","__proto__":{"polluted":true},"uris":[]}}]}';
  const result = planBitwardenExport(hostile, empty);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].category, "Finanzas");
  assert.equal({}.polluted, undefined);
  assert.equal(Object.prototype.polluted, undefined);
});

test("tipos inesperados no producen excepciones y se informan por elemento", () => {
  const result = planBitwardenExport(bitwardenJson([null, 5, [], "x", login({ name: 7 }), login({ id: "9", name: "Bien" })]), empty);
  assert.deepEqual(result.entries.map((entry) => entry.site), ["banco.invalid", "Bien"]);
  assert.equal(result.issues.length, 4);
});

test("límites: más de 5.000 elementos, 4 MiB y anidación extrema", () => {
  assert.throws(() => planBitwardenExport(bitwardenJson(Array.from({ length: 5001 }, () => login())), empty), /5\.000/);
  assert.throws(() => planBitwardenExport(`{"encrypted":false,"items":[],"x":"${"a".repeat(4 * 1024 * 1024)}"}`, empty), /4 MiB/);
  // Extreme nesting must end in a controlled result (a parse error or one invalid element), never an unhandled crash.
  let nested;
  try { nested = planBitwardenExport(`{"encrypted":false,"items":${"[".repeat(300000)}${"]".repeat(300000)}}`, empty); } catch (error) { assert.match(error.message, /no es válido/); }
  if (nested) assert.deepEqual([nested.entries.length, nested.issues.length], [0, 1]);
});

test("campos demasiado largos invalidan la entrada sin truncarla", () => {
  const result = planBitwardenExport(bitwardenJson([login({ notes: "n".repeat(600) }), login({ id: "2", name: "Bien" })]), empty);
  assert.equal(result.entries.length, 1);
  assert.equal(result.issues.length, 1);
});

test("duplicados exactos contra la bóveda y entre sí, y tope de 5.000 en la bóveda", () => {
  const first = planBitwardenExport(bitwardenJson([login(), login({ id: "2" })]), empty);
  assert.equal(first.entries.length, 1);
  assert.equal(first.duplicates, 1);
  const again = planBitwardenExport(bitwardenJson([login()]), { version: 1, entries: first.entries });
  assert.equal(again.entries.length, 0);
  assert.equal(again.duplicates, 1);
  const full = { version: 1, entries: Array.from({ length: 5000 }, (_, i) => ({ id: String(i), site: `s${i}`, username: "", password: "p", notes: "", category: "Personal", favorite: false, updatedAt: "" })) };
  assert.throws(() => planBitwardenExport(bitwardenJson([login()]), full), /5\.000/);
});
