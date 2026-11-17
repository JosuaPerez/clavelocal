import { assessMasterPassword } from "./strength.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;

// Pure, offline analysis. Results contain entry ids only, never passwords, and nothing is retained after the call.
export function analyzeVault(vault, { now = Date.now(), staleDays = 365 } = {}) {
  const entries = Array.isArray(vault?.entries) ? vault.entries : [];
  const weak = [];
  const stale = [];
  const groups = new Map();
  for (const entry of entries) {
    if (typeof entry?.password === "string" && entry.password) {
      if (assessMasterPassword(entry.password).blocked) weak.push(entry.id);
      const group = groups.get(entry.password);
      if (group) group.push(entry.id);
      else groups.set(entry.password, [entry.id]);
    }
    const updated = Date.parse(entry?.updatedAt);
    if (Number.isFinite(updated) && now - updated > staleDays * DAY_MS) stale.push(entry.id);
  }
  const reused = [...groups.values()].filter((ids) => ids.length > 1);
  groups.clear();
  return { weak, reused, stale, total: entries.length, staleDays };
}
