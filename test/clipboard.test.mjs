import test from "node:test";
import assert from "node:assert/strict";
import { createClipboardCleaner } from "../clipboard.mjs";

function setup() {
  let time = 0, value = "", blocked = 0;
  const jobs = new Map();
  let nextId = 0;
  const clipboard = { readText: async () => value, writeText: async (text) => { value = text; } };
  const cleaner = createClipboardCleaner({ clipboard, now: () => time,
    schedule: (callback) => { jobs.set(++nextId, callback); return nextId; }, cancel: (id) => jobs.delete(id), onBlocked: () => blocked++ });
  return { cleaner, clipboard, jobs, get value() { return value; }, get blocked() { return blocked; }, advance: (ms) => { time += ms; } };
}
test("limpia al vencer, conserva otros textos y reemplaza el plazo de una segunda copia", async () => {
  const t = setup();
  await t.cleaner.copySecret("ficticia");
  t.advance(29999);
  assert.equal(await t.cleaner.wipeIfUnchanged(), "waiting");
  assert.equal(t.value, "ficticia");
  t.advance(1);
  await t.cleaner.wipeIfUnchanged();
  assert.equal(t.value, "");
  await t.cleaner.copySecret("ficticia");
  await t.clipboard.writeText("otra cosa");
  t.advance(30000);
  await t.cleaner.wipeIfUnchanged();
  assert.equal(t.value, "otra cosa");
  await t.cleaner.copySecret("primera");
  t.advance(10000);
  await t.cleaner.copySecret("segunda");
  assert.equal(t.jobs.size, 1);
  t.advance(20000);
  assert.equal(await t.cleaner.wipeIfUnchanged(), "waiting");
  assert.equal(t.value, "segunda");
});
test("no borra a ciegas y reintenta después de recuperar el permiso", async () => {
  const t = setup();
  await t.cleaner.copySecret("ficticia");
  t.advance(30000);
  const read = t.clipboard.readText;
  t.clipboard.readText = async () => { throw new Error("permission"); };
  assert.equal(await t.cleaner.wipeIfUnchanged(), "blocked");
  assert.equal(t.value, "ficticia");
  assert.equal(t.blocked, 1);
  t.clipboard.readText = read;
  await t.cleaner.wipeIfUnchanged();
  assert.equal(t.value, "");
});
test("copias concurrentes y limpieza se serializan sin borrar la segunda", async () => {
  const t = setup();
  await Promise.all([t.cleaner.copySecret("primera"), t.cleaner.copySecret("segunda")]);
  assert.equal(t.value, "segunda");
  t.advance(30000);
  await Promise.all([t.cleaner.wipeIfUnchanged(), t.cleaner.copySecret("tercera")]);
  assert.equal(t.value, "tercera");
});
