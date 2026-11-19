import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { passphraseWords } from "../wordlist-es.mjs";
import { SEPARATORS, generatePassphrase, passphraseEntropyBits, randomIndex } from "../passphrase.mjs";
import { assessMasterPassword } from "../strength.mjs";

test("la lista propia tiene 2.048 palabras únicas, ASCII, en minúsculas y ordenadas", () => {
  assert.equal(passphraseWords.length, 2048);
  assert.equal(new Set(passphraseWords).size, 2048);
  for (const word of passphraseWords) assert.match(word, /^[a-z]{3,9}$/);
  assert.deepEqual([...passphraseWords], [...passphraseWords].sort());
  assert.ok(Object.isFrozen(passphraseWords));
});

test("la lista conserva su SHA-256 con finales de línea LF", async () => {
  const source = await readFile(new URL("../wordlist-es.mjs", import.meta.url), "utf8");
  assert.equal(createHash("sha256").update(source.replace(/\r\n/g, "\n")).digest("hex"),
    "e1a3a67458654c9280c9046a024b5c6acccf49a8bf0e32535464480dad5203de");
});

test("randomIndex rechaza la cola sesgada y alcanza todos los valores", () => {
  const draws = [4294967295, 7];
  const fill = (buffer) => { buffer[0] = draws.shift(); };
  assert.equal(randomIndex(3, fill), 1);
  assert.equal(draws.length, 0);
  const seen = new Set();
  for (let value = 0; value < 10; value += 1) seen.add(randomIndex(10, (buffer) => { buffer[0] = value; }));
  assert.equal(seen.size, 10);
  assert.equal(randomIndex(2048, (buffer) => { buffer[0] = 4294967295; }), 2047);
  assert.throws(() => randomIndex(0), RangeError);
  assert.throws(() => randomIndex(1.5), RangeError);
});

test("randomIndex con el generador real no produce valores fuera de rango", () => {
  for (let i = 0; i < 5000; i += 1) {
    const value = randomIndex(2048);
    assert.ok(Number.isInteger(value) && value >= 0 && value < 2048);
  }
});

test("genera frases con opciones y entradas inyectadas", () => {
  const list = ["uno", "dos", "tres", "cuatro"];
  let step = 0;
  const random = () => step++ % list.length;
  assert.equal(generatePassphrase({ words: 4 }, random, list), "uno-dos-tres-cuatro");
  step = 0;
  assert.equal(generatePassphrase({ words: 4, separator: " ", capitalize: true }, random, list), "Uno Dos Tres Cuatro");
  step = 0;
  assert.equal(generatePassphrase({ words: 4, separator: ".", addNumber: true }, random, list), "uno.dos.tres.cuatro0");
  for (const separator of SEPARATORS) assert.match(generatePassphrase({ separator }), /[a-z]/);
});

test("rechaza recuentos y separadores no válidos", () => {
  for (const words of [3, 11, 4.5, "6", NaN]) assert.throws(() => generatePassphrase({ words }), RangeError);
  for (const separator of ["", "--", "/", 1]) assert.throws(() => generatePassphrase({ separator }), RangeError);
});

test("la entropía se calcula solo para palabras uniformes de una lista pública", () => {
  assert.equal(passphraseEntropyBits({ words: 6 }), 66);
  assert.equal(passphraseEntropyBits({ words: 4 }), 44);
  assert.ok(Math.abs(passphraseEntropyBits({ words: 6, addNumber: true }) - (66 + Math.log2(10))) < 1e-9);
});

test("la política de clave maestra acepta frases generadas de cinco o más palabras", () => {
  for (let i = 0; i < 300; i += 1) {
    const separator = SEPARATORS[i % SEPARATORS.length];
    const phrase = generatePassphrase({ words: 5 + (i % 6), separator, capitalize: i % 2 === 0, addNumber: i % 3 === 0 });
    assert.equal(assessMasterPassword(phrase, { username: "Perfil de prueba" }).blocked, false, phrase);
  }
});
