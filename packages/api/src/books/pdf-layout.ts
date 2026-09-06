import type { StructuredTextItem } from "unpdf";

import type { DetectedChapter } from "./types";

export interface PdfTextRun {
  text: string;
  bold: boolean;
}

export interface PdfLine {
  text: string;
  pageIndex: number;
  lineIndex: number;
  fontSize: number;
  x: number;
  y: number;
  width: number;
  charCount: number;
  runs: PdfTextRun[];
}

interface HeadingMarker {
  title: string;
  pageIndex: number;
  lineIndex: number;
  score: number;
}

const CHAPTER_PATTERN = /^(chapter|part|book|section)\s+(\d{1,3}|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
const NAMED_SECTION_PATTERN = /^(prologue|epilogue|introduction|foreword|preface|afterword|conclusion|appendix)(\b|\s+[a-z0-9])/i;
const TOC_PATTERN = /^(table of )?contents?$/i;
const NON_CONTENT_PATTERN = /^(cover|title page|copyright|contents?|table of contents)$/i;
const MAX_TITLE_LENGTH = 120;

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeRepeatedText(text: string): string {
  return cleanText(text)
    .toLocaleLowerCase()
    .replace(/\b\d+\b/g, "#")
    .replace(/[^\p{L}\p{N}#]+/gu, " ")
    .trim();
}

export function weightedBodyFontSize(lines: PdfLine[]): number {
  const buckets = new Map<number, number>();
  for (const line of lines) {
    if (line.charCount < 3) continue;
    const bucket = Math.round(line.fontSize * 2) / 2;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + line.charCount);
  }

  let bestSize = 12;
  let bestWeight = 0;
  for (const [size, weight] of buckets) {
    if (weight > bestWeight) {
      bestSize = size;
      bestWeight = weight;
    }
  }
  return bestSize;
}

/** Merge positioned text items into reading-order lines. */
export function mergePdfLines(pages: StructuredTextItem[][]): PdfLine[][] {
  return pages.map((items, pageIndex) => {
    const lines: PdfLine[] = [];
    let current: StructuredTextItem[] = [];

    const flush = () => {
      if (current.length === 0) return;
      const text = cleanText(current.map((item) => item.str).join(" "));
      if (text) {
        const charCount = Math.max(1, text.length);
        const weightedFont = current.reduce(
          (sum, item) => sum + item.fontSize * Math.max(1, item.str.length),
          0,
        );
        const x = Math.min(...current.map((item) => item.x));
        const right = Math.max(...current.map((item) => item.x + item.width));
        const runs: PdfTextRun[] = [];
        for (const item of current) {
          const runText = cleanText(item.str);
          if (!runText) continue;
          const bold = /bold|black|heavy|semibold|demi/i.test(item.fontFamily);
          const previousRun = runs.at(-1);
          if (previousRun?.bold === bold) {
            previousRun.text = `${previousRun.text} ${runText}`;
          } else {
            runs.push({ text: runText, bold });
          }
        }
        lines.push({
          text,
          pageIndex,
          lineIndex: lines.length,
          fontSize: weightedFont / current.reduce(
            (sum, item) => sum + Math.max(1, item.str.length),
            0,
          ),
          x,
          y: Math.max(...current.map((item) => item.y)),
          width: right - x,
          charCount,
          runs,
        });
      }
      current = [];
    };

    for (const item of items) {
      if (!item.str.trim()) {
        if (item.hasEOL) flush();
        continue;
      }

      const previous = current.at(-1);
      const sameVisualLine = previous
        ? Math.abs(previous.y - item.y) <= Math.max(1.5, item.fontSize * 0.22)
        : true;
      if (previous && !sameVisualLine) flush();
      current.push(item);
      if (item.hasEOL) flush();
    }
    flush();
    return lines;
  });
}

function findRepeatedMargins(pages: PdfLine[][]): Set<string> {
  const occurrences = new Map<string, Set<number>>();

  for (const [pageIndex, lines] of pages.entries()) {
    if (lines.length === 0) continue;
    const marginLines = [...lines.slice(0, 3), ...lines.slice(-3)];
    for (const line of marginLines) {
      if (line.text.length > 90) continue;
      const normalized = normalizeRepeatedText(line.text);
      if (normalized.length < 3) continue;
      const pageSet = occurrences.get(normalized) ?? new Set<number>();
      pageSet.add(pageIndex);
      occurrences.set(normalized, pageSet);
    }
  }

  const minimumPages = Math.max(3, Math.ceil(pages.length * 0.12));
  return new Set(
    [...occurrences.entries()]
      .filter(([, pageSet]) => pageSet.size >= minimumPages)
      .map(([text]) => text),
  );
}

function looksUppercase(text: string): boolean {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length < 4) return false;
  const uppercase = text.match(/\p{Lu}/gu) ?? [];
  return uppercase.length / letters.length >= 0.82;
}

function isTocPage(lines: PdfLine[]): boolean {
  const first = lines.slice(0, 10).some((line) => TOC_PATTERN.test(line.text));
  const tocRows = lines.filter(
    (line) => /\.{2,}\s*\d+\s*$/.test(line.text) || /\s\d+\s*$/.test(line.text),
  ).length;
  return first && tocRows >= 3;
}

function scoreHeading(
  line: PdfLine,
  pageLines: PdfLine[],
  bodyFontSize: number,
  repeatedMargins: Set<string>,
): number {
  const text = line.text;
  if (!text || text.length > MAX_TITLE_LENGTH) return -100;
  if (NON_CONTENT_PATTERN.test(text)) return -100;
  if (repeatedMargins.has(normalizeRepeatedText(text))) return -100;
  if (/\.{2,}\s*\d+\s*$/.test(text)) return -100;

  const explicit = CHAPTER_PATTERN.test(text) || NAMED_SECTION_PATTERN.test(text);
  const fontRatio = line.fontSize / Math.max(1, bodyFontSize);
  let score = explicit ? 7 : 0;

  if (fontRatio >= 1.65) score += 5;
  else if (fontRatio >= 1.35) score += 4;
  else if (fontRatio >= 1.16) score += 2;
  else if (!explicit) score -= 4;

  if (line.lineIndex <= 2) score += 2;
  else if (line.lineIndex <= Math.max(5, Math.floor(pageLines.length * 0.25))) score += 1;

  if (looksUppercase(text)) score += 1;
  if (text.length <= 55) score += 1;
  if (/[.!?;:]$/.test(text) && !explicit) score -= 2;
  if (text.split(/\s+/).length > 14) score -= 3;

  const previous = pageLines[line.lineIndex - 1];
  if (previous && previous.y - line.y > bodyFontSize * 1.8) score += 1;
  return score;
}

function joinHeadingTitle(line: PdfLine, pageLines: PdfLine[], bodySize: number): string {
  if (!CHAPTER_PATTERN.test(line.text)) return line.text;

  const following = pageLines[line.lineIndex + 1];
  if (!following || following.text.length > 90) return line.text;
  const close = Math.abs(line.y - following.y) <= Math.max(line.fontSize, following.fontSize) * 2.8;
  const titleLike = following.fontSize >= bodySize * 1.12 || looksUppercase(following.text);
  if (!close || !titleLike || /[.!?;]$/.test(following.text)) return line.text;
  return following.text;
}

function removeImplausibleMarkers(markers: HeadingMarker[]): HeadingMarker[] {
  if (markers.length <= 1) return markers;
  const ordered = markers.sort(
    (a, b) => a.pageIndex - b.pageIndex || a.lineIndex - b.lineIndex,
  );
  const unique: HeadingMarker[] = [];
  for (const marker of ordered) {
    const previous = unique.at(-1);
    if (previous?.pageIndex === marker.pageIndex) {
      if (marker.score > previous.score) unique[unique.length - 1] = marker;
      continue;
    }
    unique.push(marker);
  }
  return unique;
}

export function detectChaptersFromLayout(
  pageItems: StructuredTextItem[][],
  pageTexts: string[],
): DetectedChapter[] {
  const pages = mergePdfLines(pageItems);
  const allLines = pages.flat();
  const bodySize = weightedBodyFontSize(allLines);
  const repeatedMargins = findRepeatedMargins(pages);
  const markers: HeadingMarker[] = [];

  for (const lines of pages) {
    if (isTocPage(lines)) continue;
    for (const line of lines) {
      const score = scoreHeading(line, lines, bodySize, repeatedMargins);
      if (score < 6) continue;
      markers.push({
        title: joinHeadingTitle(line, lines, bodySize),
        pageIndex: line.pageIndex,
        lineIndex: line.lineIndex,
        score,
      });
    }
  }

  const selected = removeImplausibleMarkers(markers);
  if (selected.length === 0) {
    return [{
      title: "Full text",
      startPage: 1,
      endPage: Math.max(1, pageTexts.length),
      content: pageTexts.join("\n\n").trim(),
    }];
  }

  return selected.map((marker, index) => {
    const next = selected[index + 1];
    const endPageIndex = next
      ? Math.max(marker.pageIndex, next.pageIndex - 1)
      : pageTexts.length - 1;
    return {
      title: marker.title,
      startPage: marker.pageIndex + 1,
      endPage: endPageIndex + 1,
      content: pageTexts.slice(marker.pageIndex, endPageIndex + 1).join("\n\n").trim(),
    };
  });
}
