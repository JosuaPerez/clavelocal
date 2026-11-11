import { commonPasswords } from "./common-passwords.mjs";

const MIN_MASTER_CHARACTERS = 12;
const graphemes = new Intl.Segmenter("es", { granularity: "grapheme" });
const fold = (value) => value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
const substitutions = { "4": "a", "3": "e", "0": "o", "5": "s", "7": "t", "@": "a", "$": "s" };
const commonWord = commonPasswords.map((word) => word.replace(/[il]/g, (letter) => `[${letter}1]`)).join("|");
const commonPattern = new RegExp(`^(?:${commonWord}){1,3}$`);
const maxCommonLength = 3 * Math.max(...commonPasswords.map((word) => word.length));

const rows = [
  "0123456789", "abcdefghijklmnopqrstuvwxyz", "abcdefghijklmnñopqrstuvwxyz",
  "qwertyuiop", "asdfghjklñ", "zxcvbnm", "qwertyuiop`+", "asdfghjklñ´ç",
  "1qaz", "2wsx", "3edc", "4rfv", "5tgb", "6yhn", "7ujm", "8ik,", "9ol.", "0pñ-",
];
const sequences = rows.flatMap((row) => [row, [...row].reverse().join("")]);

function isCommon(value) {
  if (value.length > maxCommonLength + 6) return false;
  const normalized = value.replace(/[43057@$]/g, (character) => substitutions[character]);
  const prefix = value.match(/^[\p{N}\p{P}\p{S}]{0,6}/u)[0];
  const suffix = value.match(/[\p{N}\p{P}\p{S}]{0,6}$/u)[0];
  const offsets = (edge) => [0, ...[...edge].map((_, i, chars) => chars.slice(0, i + 1).join("").length)];
  for (const [leftCount, left] of offsets(prefix).entries()) {
    for (const right of offsets([...suffix].reverse().join("")).slice(0, 7 - leftCount)) {
      if (commonPattern.test(normalized.slice(left, normalized.length - right))) return true;
    }
  }
  return false;
}

function effectiveLength(password) {
  const characters = [...password.toLowerCase().normalize("NFC")];
  let count = 0;
  for (let start = 0; start < characters.length;) {
    let longest = 0;
    for (let period = 1; period <= 4; period += 1) {
      let length = period;
      while (start + length < characters.length && characters[start + length] === characters[start + length - period]) length += 1;
      if (length >= Math.max(4, 2 * period)) longest = Math.max(longest, length);
    }
    for (const row of sequences) {
      const offset = row.indexOf(characters[start]);
      if (offset < 0) continue;
      let length = 1;
      while (offset + length < row.length && characters[start + length] === row[offset + length]) length += 1;
      if (length >= 4) longest = Math.max(longest, length);
    }
    count += longest ? 2 : 1;
    start += longest || 1;
  }
  return count;
}

function hasMinimumLength(password) {
  let count = 0;
  for (const segment of graphemes.segment(password)) {
    if (++count === MIN_MASTER_CHARACTERS) return true;
  }
  return false;
}

export function assessMasterPassword(password, { username = "" } = {}) {
  const normalized = fold(password);
  const name = fold(username.trim());
  const length = effectiveLength(password);
  const reasons = [];
  const longEnough = hasMinimumLength(password);
  if (!longEnough) reasons.push(`Usa al menos ${MIN_MASTER_CHARACTERS} caracteres para tu clave maestra.`);
  if (isCommon(normalized)) reasons.push("Evita claves comunes y sus variantes.");
  if (length < 10 && longEnough) reasons.push("Añade caracteres distintos y evita repeticiones y secuencias fáciles de adivinar.");
  if ([...name].length >= 3 && normalized.includes(name)) reasons.push("Evita incluir tu nombre de usuario completo.");
  const level = length >= 20 ? "larga" : length >= 14 ? "aceptable" : "justa";
  return { blocked: reasons.length > 0, reasons, level };
}

export function describeEntryPassword(password) {
  if (!password) return "Sin evaluar";
  const { blocked, level } = assessMasterPassword(password);
  if (blocked) return "Corta o predecible.";
  if (level === "larga") return "Larga. Usa una clave única para este sitio.";
  return "Sin patrones obvios detectados.";
}
