import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, planCsvImport } from "../csv.mjs";
const empty = { version: 1, entries: [] };
test("Chrome/Brave: BOM, comas, comillas, CRLF, notas multilínea y espacios en contraseña", () => {
  const parsed = parseCsv('\uFEFFname,url,username,password,note\r\n"Correo, personal",https://example.invalid,ana@example.invalid,"  prueba,""123""  ","línea 1\n línea 2"\r\n');
  const plan = planCsvImport(parsed, parsed.mapping, empty);
  assert.equal(plan.entries.length, 1);
  assert.equal(plan.entries[0].site, "Correo, personal");
  assert.equal(plan.entries[0].password, '  prueba,"123"  ');
  assert.match(plan.entries[0].notes, /línea 1\n línea 2\nURL: https:\/\/example.invalid/);
});
test("detecta punto y coma y tabuladores sin alterar los valores", () => {
  for (const separator of [";", "\t"]) {
    const parsed = parseCsv(["name", "username", "password"].join(separator) + "\n" + ["Sitio", "ana", "contraseña-ficticia"].join(separator));
    assert.equal(parsed.delimiter, separator);
    assert.equal(planCsvImport(parsed, parsed.mapping, empty).entries.length, 1);
  }
});
test("deduplica solo registros exactos; conserva contraseñas distintas y rechaza filas incompletas", () => {
  const parsed = parseCsv("name,username,password\nSitio,ana,uno\nSitio,ana,uno\nSitio,ana,dos\nSitio,ana,\nExtra,ana,tres,columna");
  const first = planCsvImport(parsed, parsed.mapping, empty);
  assert.equal(first.entries.length, 2);
  assert.equal(first.duplicates, 1);
  assert.equal(first.issues.length, 2);
  const again = planCsvImport(parsed, parsed.mapping, { version: 1, entries: first.entries });
  assert.equal(again.entries.length, 0);
  assert.equal(again.duplicates, 3);
  assert.equal(empty.entries.length, 0);
});
test("errores no revelan valores; rechaza comillas incorrectas y mapeo ambiguo", () => {
  for (const text of ['name,password\nSitio,"sin-cerrar', 'name,password\nSitio,pa"ss', 'name,password\nSitio,"clave"resto']) assert.throws(() => parseCsv(text));
  const parsed = parseCsv("name,password\nSitio,ficticia");
  assert.throws(() => planCsvImport(parsed, { site: 0, url: -1, username: -1, password: 0, notes: -1 }, empty));
  assert.throws(() => planCsvImport(parsed, { ...parsed.mapping, password: -1 }, empty));
});
test("campos hostiles son texto y los demasiado largos se omiten sin truncar", () => {
  const parsed = parseCsv(`name,password\n<img src=x onerror=alert(1)>,=cmd|ficticio\n${"A".repeat(81)},ficticia`);
  const plan = planCsvImport(parsed, parsed.mapping, empty);
  assert.equal(plan.entries[0].site, "<img src=x onerror=alert(1)>");
  assert.equal(plan.entries[0].password, "=cmd|ficticio");
  assert.equal(plan.issues.length, 1);
});
