import assert from "node:assert/strict";
import test from "node:test";
import { firstSteps } from "../firststeps.mjs";

test("sin nada hecho, los tres pasos están pendientes", () => {
  const result = firstSteps();
  assert.equal(result.total, 3);
  assert.equal(result.done, 0);
  assert.equal(result.complete, false);
  assert.deepEqual(result.steps.map((step) => step.id), ["entry", "lock", "health"]);
});

test("cada paso se completa por separado", () => {
  assert.deepEqual(firstSteps({ entryCount: 1 }).steps.map((step) => step.done), [true, false, false]);
  assert.deepEqual(firstSteps({ lockReviewed: true }).steps.map((step) => step.done), [false, true, false]);
  assert.deepEqual(firstSteps({ healthReviewed: true }).steps.map((step) => step.done), [false, false, true]);
});

test("con todo hecho la lista está completa", () => {
  const result = firstSteps({ entryCount: 3, lockReviewed: true, healthReviewed: true });
  assert.equal(result.done, 3);
  assert.equal(result.complete, true);
});

test("valores raros no cuentan como hechos", () => {
  const result = firstSteps({ entryCount: 0, lockReviewed: "", healthReviewed: 0 });
  assert.equal(result.done, 0);
});

test("el módulo no recibe ni devuelve contenido de entradas", () => {
  const result = firstSteps({ entryCount: 2 });
  assert.ok(!JSON.stringify(result).includes("password"));
});
