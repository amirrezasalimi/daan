import type { DetectedChapter } from "./types";

/**
 * Patterns that strongly indicate a chapter heading. Ordered by specificity.
 */
const HEADING_PATTERNS: RegExp[] = [
  /^\s*chapter\s+(\d{1,3}|[ivxlcdm]+)\b/i,
  /^\s*(part|book|section)\s+(\d{1,3}|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i,
  /^\s*(prologue|epilogue|introduction|foreword|preface|afterword|conclusion|appendix|acknowledg(e)?ments?)\b/i,
  /^\s*\d{1,3}[.)]\s+\S/,
];

const MAX_HEADING_LEN = 90;
const HEADING_SCAN_LINES = 6;

function cleanTitle(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * Decide whether a line looks like a chapter heading, returning a normalised
 * title or null. Combines explicit keyword patterns with a short-all-caps
 * fallback used by many typeset books.
 */
function matchHeading(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > MAX_HEADING_LEN) return null;

  for (const pattern of HEADING_PATTERNS) {
    if (pattern.test(trimmed)) return cleanTitle(trimmed);
  }

  // Short, mostly-uppercase, letter-dominant line (e.g. "THE LONG WINTER").
  const letters = trimmed.replace(/[^a-z]/gi, "");
  if (letters.length >= 3 && trimmed.length <= 48) {
    const upper = trimmed.replace(/[^A-Z]/g, "");
    if (upper.length / letters.length > 0.85 && /\s/.test(trimmed)) {
      return cleanTitle(trimmed);
    }
  }

  return null;
}

/**
 * Detect chapters from an ordered array of page texts.
 *
 * Runs in O(pages × scanLines): only the first few lines of each page are
 * examined for a heading, which keeps large books fast. Each detected heading
 * opens a chapter that runs until the next heading (or the final page).
 */
export function detectChaptersFromPages(pages: string[]): DetectedChapter[] {
  const markers: { title: string; startPage: number }[] = [];

  for (let i = 0; i < pages.length; i += 1) {
    const lines = (pages[i] ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, HEADING_SCAN_LINES);

    for (const line of lines) {
      const title = matchHeading(line);
      if (title) {
        markers.push({ title, startPage: i + 1 });
        break;
      }
    }
  }

  if (markers.length === 0) {
    const content = pages.join("\n\n").trim();
    return [{ title: "Full text", startPage: 1, endPage: Math.max(1, pages.length), content }];
  }

  // Ensure content before the first heading isn't lost.
  if ((markers[0]?.startPage ?? 1) > 1) {
    markers.unshift({ title: "Front matter", startPage: 1 });
  }

  const chapters: DetectedChapter[] = [];
  for (let i = 0; i < markers.length; i += 1) {
    const marker = markers[i]!;
    const start = marker.startPage;
    const next = markers[i + 1];
    const end = next ? next.startPage - 1 : pages.length;
    const safeEnd = Math.max(start, end);
    const content = pages.slice(start - 1, safeEnd).join("\n\n").trim();
    chapters.push({ title: marker.title, startPage: start, endPage: safeEnd, content });
  }

  return chapters;
}
