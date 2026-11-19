import assert from "node:assert/strict";
import test from "node:test";
import { analyzeVault } from "../health.mjs";

const now = Date.parse("2026-11-17T12:00:00Z");
const day = 24 * 60 * 60 * 1000;
const entry = (id, password, updatedAt = new Date(now).toISOString()) => ({ id, site: `Sitio ${id}`, username: `u${id}`, password, notes: "", category: "Personal", favorite: false, updatedAt });

test("detecta claves débiles sin marcar frases largas", () => {
  const vault = { entries: [entry("a", "password12345678"), entry("b", "caballo-nube-mesa-tiza"), entry("c", "corta1!")] };
  assert.deepEqual(analyzeVault(vault, { now }).weak, ["a", "c"]);
});

test("agrupa claves repetidas en tres entradas y no mezcla distintas", () => {
  const same = "caballo-nube-mesa-tiza";
  const vault = { entries: [entry("a", same), entry("b", "otra-frase-larga-distinta"), entry("c", same), entry("d", same), entry("e", "OTRA-frase-larga-distinta")] };
  assert.deepEqual(analyzeVault(vault, { now }).reused, [["a", "c", "d"]]);
});

test("marca entradas sin editar según el plazo e ignora fechas inválidas", () => {
  const vault = { entries: [
    entry("a", "caballo-nube-mesa-tiza", new Date(now - 366 * day).toISOString()),
    entry("b", "otra-frase-larga-distinta", new Date(now - 364 * day).toISOString()),
    entry("c", "tercera-frase-larga-nueva", "no es una fecha"),
    entry("d", "cuarta-frase-larga-nueva", ""),
  ] };
  const result = analyzeVault(vault, { now });
  assert.deepEqual(result.stale, ["a"]);
  assert.deepEqual(analyzeVault(vault, { now, staleDays: 30 }).stale, ["a", "b"]);
});

test("una bóveda vacía o mal formada no produce resultados ni errores", () => {
  for (const vault of [{ entries: [] }, {}, null, undefined]) {
    assert.deepEqual(analyzeVault(vault, { now }), { weak: [], reused: [], stale: [], total: 0, staleDays: 365 });
  }
});

test("el resultado solo contiene ids, nunca contraseñas", () => {
  const secret = "ejemplo-unico-no-es-secreto-ficticio";
  const result = analyzeVault({ entries: [entry("a", secret), entry("b", secret)] }, { now });
  assert.doesNotMatch(JSON.stringify(result), new RegExp(secret));
});

test("analiza 5.000 entradas en tiempo acotado", () => {
  const entries = Array.from({ length: 5000 }, (_, i) => entry(String(i), `clave-ficticia-numero-${i}-xk${i % 97}`));
  const started = performance.now();
  const result = analyzeVault({ entries }, { now });
  assert.equal(result.total, 5000);
  assert.ok(performance.now() - started < 5000, "El análisis tardó demasiado");
});
