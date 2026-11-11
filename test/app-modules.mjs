import { readFile } from "node:fs/promises";
import { posix } from "node:path";

export const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

export async function appModules() {
  const modules = new Map();
  async function visit(path) {
    if (modules.has(path)) return;
    const source = await read(path);
    modules.set(path, source);
    // Match local literal imports and re-exports in the app's source convention.
    const imports = /(?:^\s*(?:import|export)\s+(?:[^"'();]*?\bfrom\s*)?|\bimport\s*\(\s*)(["'])(\.\.?\/[^"'\n]+\.mjs)\1/gm;
    for (const [, , relative] of source.matchAll(imports)) {
      await visit(posix.join(posix.dirname(path), relative));
    }
  }
  await visit("app.js");
  return modules;
}
