import { passphraseWords } from "./wordlist-es.mjs";

export const MIN_WORDS = 4;
export const MAX_WORDS = 10;
export const SEPARATORS = Object.freeze(["-", " ", ".", "_"]);

// Uniform integer in [0, max) from 32-bit draws, rejecting the biased tail. `fill` is injectable for tests.
export function randomIndex(max, fill = (buffer) => crypto.getRandomValues(buffer)) {
  if (!Number.isInteger(max) || max < 1 || max > 2 ** 32) throw new RangeError("Rango no válido");
  const limit = Math.floor(2 ** 32 / max) * max;
  const buffer = new Uint32Array(1);
  do fill(buffer); while (buffer[0] >= limit);
  return buffer[0] % max;
}

export function generatePassphrase({ words = 6, separator = "-", capitalize = false, addNumber = false } = {}, random = randomIndex, list = passphraseWords) {
  if (!Number.isInteger(words) || words < MIN_WORDS || words > MAX_WORDS) throw new RangeError(`Usa entre ${MIN_WORDS} y ${MAX_WORDS} palabras.`);
  if (!SEPARATORS.includes(separator)) throw new RangeError("Separador no válido.");
  const chosen = Array.from({ length: words }, () => {
    const word = list[random(list.length)];
    return capitalize ? word[0].toUpperCase() + word.slice(1) : word;
  });
  const phrase = chosen.join(separator);
  return addNumber ? `${phrase}${random(10)}` : phrase;
}

// Exact only for words drawn uniformly and independently from a public list of `size` words.
export function passphraseEntropyBits({ words = 6, addNumber = false } = {}, size = passphraseWords.length) {
  return words * Math.log2(size) + (addNumber ? Math.log2(10) : 0);
}
