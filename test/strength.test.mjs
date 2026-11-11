import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assessMasterPassword, describeEntryPassword } from "../strength.mjs";

test("rechaza claves comunes y sus variantes, secuencias y repeticiones", () => {
  const rejected = [
    "123456789012", "passwordpassword", "qwertyuiop12", "aaaaaaaaaaaa",
    "abcdefghijkl", "abcabcabcabc", "Password123!", "Contraseña2026!",
    "contraseña1234", "iloveyou1234", "bienvenido2026", "$P4$$W0RD12!",
    "c14v3password", "w3lc0m3password", "qwertyuiopñlkj", "1qaz2wsx3edc",
  ];
  for (const [index, password] of rejected.entries()) {
    const result = assessMasterPassword(password);
    assert.equal(result.blocked, true, `Caso rechazado ${index}`);
    assert.ok(result.reasons.length);
  }
  assert.match(assessMasterPassword("josua-mi-clave-secreta", { username: "Josúa" }).reasons.join(" "), /nombre de usuario/);
  assert.match(assessMasterPassword("corta").reasons.join(" "), /12 caracteres/);
});

test("acepta frases de prueba y claves variadas sin estimar entropía", () => {
  const accepted = [
    "ficticia-solo-pruebas-123!", "golden-ficticia-no-usar-en-la-vida-real",
    "solo-pruebas-ajustes-ficticios", "clave-maestra-ficticia-de-prueba",
    "solo-pruebas-no-es-secreto", "caballo-nube-mesa-tiza", "v7#Qm2$Lx9!pZ4",
    "solo-pruebas-paginacion-ficticia", "admin-puerto-azul-ventana",
  ];
  for (const [index, password] of accepted.entries()) {
    assert.equal(assessMasterPassword(password, { username: "Perfil de prueba" }).blocked, false, `Caso aceptado ${index}`);
  }
  assert.equal(assessMasterPassword("caballo-nube-mesa-tiza").level, "larga");
  assert.match(describeEntryPassword("Password123!"), /predecible/);
  assert.doesNotMatch(describeEntryPassword("caballo-nube-mesa-tiza"), /bits|fuerte/i);
});

test("el mínimo cuenta caracteres visibles, incluso con emojis compuestos", () => {
  for (const password of ["😀🚀🌟💡🎵🌊🏔🍎🧩🎇🎁", "😀🚀🌟💡🎵🌊🏔🍎🧩🎇👩‍💻"]) {
    assert.match(assessMasterPassword(password).reasons.join(" "), /12 caracteres/);
    assert.equal(assessMasterPassword(`${password}🦉`).blocked, false);
  }
});

test("la lista propia conserva su SHA-256 con finales de línea LF", async () => {
  const source = await readFile(new URL("../common-passwords.mjs", import.meta.url), "utf8");
  assert.equal(createHash("sha256").update(source.replace(/\r\n/g, "\n")).digest("hex"),
    "43451a00985d81d26ac644e528fd5b61472d384e06b88c44f49d01d18b1a2dbc");
});
