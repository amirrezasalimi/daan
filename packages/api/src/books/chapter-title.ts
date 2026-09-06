const NUMBER_WORDS = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
].join("|");

const STRUCTURAL_PREFIX = new RegExp(
  `^(?:chapter|part|book|section)\\s+(?:\\d{1,4}|[ivxlcdm]+|${NUMBER_WORDS})\\b\\s*(?:[:.\\-–—]\\s*)?`,
  "i",
);

/**
 * Remove structural numbering from a chapter display title.
 *
 * Examples:
 * - "CHAPTER 1: Arrival" → "Arrival"
 * - "Part II — The Journey" → "The Journey"
 * - "Chapter Seven" → "Untitled"
 */
export function cleanChapterTitle(title: string): string {
  const normalized = title.replace(/\s+/g, " ").trim();
  const withoutPrefix = normalized.replace(STRUCTURAL_PREFIX, "").trim();
  return withoutPrefix || "Untitled";
}
