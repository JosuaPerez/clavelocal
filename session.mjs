import { ITERATIONS, StorageWriteError, decode, deriveKey, encryptVault, openVault, randomBytes } from "./vault.mjs";

// The caller holds the Web Lock for the entire operation, including migration.
export async function openSession(store, password, createVault, isCurrent = () => true) {
  const stored = store.read();
  const assertCurrent = () => { if (!isCurrent()) throw new Error("Operación cancelada"); };
  if (!stored) {
    const vault = createVault();
    const salt = randomBytes(16);
    const key = await deriveKey(password, salt);
    const envelope = await encryptVault(key, vault, salt);
    assertCurrent();
    store.commit(envelope);
    return { key, salt, iterations: ITERATIONS, vault, warning: "" };
  }
  const opened = await openVault(password, stored);
  const current = { ...opened, salt: decode(stored.kdf.salt), iterations: stored.kdf.iterations, warning: "" };
  assertCurrent();
  if (current.iterations === ITERATIONS) return current;
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  const migrated = await encryptVault(key, opened.vault, salt);
  assertCurrent();
  try { store.commit(migrated); }
  catch (error) {
    // Conflicts and cancellation are not storage failures and must not open a stale session.
    if (!(error instanceof StorageWriteError)) throw error;
    current.warning = "No pudimos actualizar el formato de tu bóveda; sigues con la versión anterior. Libera espacio y reinténtalo.";
    if (error.backupRecoveryFailed) current.warning += " La bóveda principal sigue intacta, pero la copia anterior pudo cambiar. Exporta una copia cifrada.";
    return current;
  }
  return { ...opened, key, salt, iterations: ITERATIONS, warning: "" };
}

export class RekeyVerificationError extends Error {
  constructor() {
    super("No se pudo confirmar la clave guardada. Bóveda bloqueada. Intenta abrirla con la clave nueva o la anterior.");
    this.name = "RekeyVerificationError";
  }
}

// The caller holds the Web Lock and activates the result synchronously in onCommit.
export async function rekeySession(store, { current, next, vault, isCurrent = () => true, onCommit = () => {} }) {
  const encoder = new TextEncoder();
  const before = encoder.encode(current);
  const after = encoder.encode(next);
  const same = before.length === after.length && before.every((byte, i) => byte === after[i]);
  before.fill(0);
  after.fill(0);
  if (same) throw new Error("La clave nueva debe ser distinta de la actual.");
  const envelope = store.currentEnvelope();
  try { await openVault(current, envelope); }
  catch { throw new Error("No se pudo verificar la clave actual."); }
  if (!isCurrent()) throw new Error("Operación cancelada");
  const salt = randomBytes(16);
  const key = await deriveKey(next, salt, ITERATIONS);
  const encrypted = await encryptVault(key, vault, salt, ITERATIONS);
  if (!isCurrent()) throw new Error("Operación cancelada");
  const previous = store.commit(encrypted);
  try {
    if (!store.matchesCurrent()) throw new Error("Readback mismatch");
  } catch { throw new RekeyVerificationError(); }
  onCommit({ key, salt, iterations: ITERATIONS, previous });
}
