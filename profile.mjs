export const PROFILE_KEY = "clavelocal.profile.v1";

export function normalizeUsername(value) {
  if (typeof value !== "string") throw new Error("Escribe un nombre de usuario.");
  const username = value.normalize("NFC").trim();
  if (username.length < 2 || username.length > 40 || !/^[\p{L}\p{N}][\p{L}\p{N}._ -]*$/u.test(username)) throw new Error("Usa de 2 a 40 caracteres: letras, números, espacios, punto, guion o guion bajo.");
  return username;
}

export function validateProfile(value) {
  if (!value || value.version !== 1 || Object.keys(value).some((key) => !["version", "username"].includes(key)) || normalizeUsername(value.username) !== value.username) throw new Error("Perfil local no válido");
  return value;
}

// This cache is a visible greeting, not an authentication factor or source of keys.
// The authoritative profile travels inside the authenticated encrypted vault.
export function readCachedProfile(storage) {
  try {
    const raw = storage.getItem(PROFILE_KEY);
    return raw === null ? null : validateProfile(JSON.parse(raw));
  } catch { return null; }
}

export function cacheProfile(storage, profile) {
  try {
    if (profile) storage.setItem(PROFILE_KEY, JSON.stringify(validateProfile(profile)));
    else storage.removeItem(PROFILE_KEY);
    return true;
  } catch {
    try { storage.removeItem(PROFILE_KEY); } catch { /* Cache failure never changes the encrypted vault. */ }
    return false;
  }
}
