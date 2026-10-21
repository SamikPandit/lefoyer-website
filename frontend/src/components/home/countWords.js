/**
 * countWords.js — small-number words for the two places the art direction
 * prints a catalogue count as a word rather than a digit:
 *   §5.1③  `Six formulations.` · `Three on the shelf today.`
 *   §6.8   `Three formulations, one delivery.`
 *
 * §10.21 bans typing a product name, price, size or stock state into a
 * component, and the same reasoning applies to the catalogue's shape: a
 * hardcoded "Six" is a sentence that silently becomes a lie the first time a
 * seventh product is published, or the first time one is unpublished. Every
 * count on this page is derived from the payload and spelled here.
 *
 * Numbers above twelve fall back to the digit, which is also normal English
 * typographic practice.
 */

const WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six',
  'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
];

/**
 * @param {number} n
 * @returns {string} e.g. 3 → "three", 40 → "40"
 */
export function countWord(n) {
  const value = Number(n);
  if (!Number.isFinite(value) || value < 0) return String(n);
  const whole = Math.trunc(value);
  return WORDS[whole] ?? String(whole);
}

/**
 * The same word, sentence-initial.
 * @param {number} n
 * @returns {string} e.g. 3 → "Three"
 */
export function countWordCap(n) {
  const word = countWord(n);
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export default countWord;
