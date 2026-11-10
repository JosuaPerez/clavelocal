// Vault format v1 remains readable; new vaults use a stronger work factor.
import { validateProfile } from "./profile.mjs";
import { validateSettings } from "./settings.mjs";
export const ITERATIONS = 600000;
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const STORAGE_KEY = "clavelocal.vault.v1";
const BACKUP_KEY = `${STORAGE_KEY}.previous`;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
export const randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));
const encode = (bytes) => btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
export const decode = (value) => {
  if (typeof value !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error("Base64 no válido");
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
};

export function validateEnvelope(value) {
  if (!value || value.format !== "clavelocal-v1" || value.kdf?.name !== "PBKDF2-SHA256" || value.cipher?.name !== "AES-256-GCM" || ![310000, ITERATIONS].includes(value.kdf.iterations)) throw new Error("Formato o parámetros no compatibles");
  if (JSON.stringify(value).length > MAX_FILE_BYTES || decode(value.kdf.salt).length !== 16 || decode(value.cipher.iv).length !== 12 || decode(value.cipher.data).length < 16) throw new Error("Copia dañada o demasiado grande");
  return value;
}

export function validateVault(value) {
  if (value?.version !== 1 || !Array.isArray(value.entries) || value.entries.length > 5000) throw new Error("Bóveda no válida");
  if (value.profile !== undefined) validateProfile(value.profile);
  if (value.settings !== undefined) validateSettings(value.settings);
  const ids = new Set();
  for (const entry of value.entries) {
    if (!entry || typeof entry.id !== "string" || !entry.id || ids.has(entry.id) || typeof entry.favorite !== "boolean") throw new Error("Entrada no válida");
    for (const [field, max] of Object.entries({ id: 100, site: 80, username: 120, category: 40, password: 4096, notes: 500, updatedAt: 40 })) {
      if (typeof entry[field] !== "string" || entry[field].length > max) throw new Error("Campo no válido");
    }
    if (!entry.site || !entry.password || !["Personal", "Trabajo", "Finanzas", "Redes", "Otros"].includes(entry.category)) throw new Error("Entrada incompleta");
    ids.add(entry.id);
  }
  return value;
}

export async function deriveKey(password, salt, iterations = ITERATIONS) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encryptVault(key, vault, salt, iterations = ITERATIONS) {
  validateVault(vault);
  const iv = randomBytes(12);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode("clavelocal:v1") }, key, encoder.encode(JSON.stringify(vault)));
  const result = { format: "clavelocal-v1", kdf: { name: "PBKDF2-SHA256", iterations, salt: encode(salt) }, cipher: { name: "AES-256-GCM", iv: encode(iv), data: encode(new Uint8Array(data)) } };
  return validateEnvelope(result);
}

export async function openVault(password, envelope) {
  validateEnvelope(envelope);
  const key = await deriveKey(password, decode(envelope.kdf.salt), envelope.kdf.iterations);
  const data = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(envelope.cipher.iv), additionalData: encoder.encode("clavelocal:v1") }, key, decode(envelope.cipher.data));
  return { key, vault: validateVault(JSON.parse(decoder.decode(data))) };
}

export class StorageWriteError extends Error {
  constructor(backupRecoveryFailed = false) {
    super(backupRecoveryFailed
      ? "No se pudo guardar. La bóveda principal sigue intacta, pero no se pudo restaurar la copia anterior. Exporta una copia cifrada."
      : "No se pudo guardar. La bóveda y su copia anterior se conservan. Revisa el espacio disponible.");
    this.name = "StorageWriteError";
    this.backupRecoveryFailed = backupRecoveryFailed;
  }
}

// Compare and replace under a cross-tab Web Lock. A stale tab cannot overwrite changes.
export class VaultStore {
  constructor(storage) { this.storage = storage; this.expected = undefined; }
  read() {
    const raw = this.storage.getItem(STORAGE_KEY);
    this.expected = raw;
    return raw === null ? null : validateEnvelope(JSON.parse(raw));
  }
  currentEnvelope() {
    if (this.expected == null) throw new Error("No hay una bóveda abierta para cambiar la clave.");
    return validateEnvelope(JSON.parse(this.expected));
  }
  matchesCurrent() {
    return this.expected !== undefined && this.storage.getItem(STORAGE_KEY) === this.expected;
  }
  removePreviousBackup(expectedBackup) {
    if (typeof expectedBackup !== "string" || !this.matchesCurrent() || this.storage.getItem(BACKUP_KEY) !== expectedBackup) {
      throw new Error("La copia anterior cambió. Se conservó la copia que está guardada ahora.");
    }
    this.storage.removeItem(BACKUP_KEY);
  }
  commit(envelope) {
    validateEnvelope(envelope);
    if (!this.matchesCurrent()) throw new Error("La bóveda cambió en otra ventana. Bloquea y vuelve a abrir antes de guardar.");
    const raw = JSON.stringify(envelope);
    const previousBackup = this.storage.getItem(BACKUP_KEY);
    const prior = this.expected;
    let rotated = false;
    // localStorage writes are individually atomic, but the pair is not a transaction.
    if (this.expected !== null) {
      let validPrevious = false;
      try { validateEnvelope(JSON.parse(this.expected)); validPrevious = true; } catch { /* Preserve an older valid backup when the primary file is malformed. */ }
      if (validPrevious) {
        try { this.storage.setItem(BACKUP_KEY, this.expected); rotated = true; }
        catch { throw new StorageWriteError(); }
      }
    }
    try { this.storage.setItem(STORAGE_KEY, raw); }
    catch {
      if (rotated) {
        try {
          if (previousBackup === null) this.storage.removeItem(BACKUP_KEY);
          else this.storage.setItem(BACKUP_KEY, previousBackup);
        } catch { throw new StorageWriteError(true); }
      }
      throw new StorageWriteError();
    }
    this.expected = raw;
    return rotated ? prior : null;
  }
}
