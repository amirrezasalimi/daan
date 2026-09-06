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
  style: string;
}

const SENTENCE_END_PATTERN = /[.!?;]$/;
const MAX_TITLE_LENGTH = 140;

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
        const weightedFont = current.reduce(
          (sum, item) => sum + item.fontSize * Math.max(1, item.str.length),
          0,
        );
        const weight = current.reduce((sum, item) => sum + Math.max(1, item.str.length), 0);
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
          fontSize: weightedFont / weight,
          x,
          y: Math.max(...current.map((item) => item.y)),
          width: right - x,
          charCount: Math.max(1, text.length),
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
    for (const line of [...lines.slice(0, 3), ...lines.slice(-3)]) {
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
  if (letters.length < 3) return false;
  const uppercase = text.match(/\p{Lu}/gu) ?? [];
  return uppercase.length / letters.length >= 0.78;
}

function isIndexPage(lines: PdfLine[]): boolean {
  if (lines.length < 6) return false;
  const indexedRows = lines.filter(
    (line) => /\.{2,}\s*\d+\s*$/.test(line.text) || /^.{3,100}\s+\d+\s*$/.test(line.text),
  ).length;
  return indexedRows / lines.length >= 0.35;
}

function lineIsBold(line: PdfLine): boolean {
  return line.runs.length > 0 && line.runs.every((run) => run.bold);
}

function styleKey(line: PdfLine, bodySize: number): string {
  const ratioBucket = Math.round((line.fontSize / Math.max(1, bodySize)) * 10) / 10;
  return `${ratioBucket}:${lineIsBold(line) ? "b" : "r"}:${looksUppercase(line.text) ? "u" : "m"}`;
}

function pageBodySize(lines: PdfLine[], globalBodySize: number): number {
  const local = weightedBodyFontSize(lines);
  return local >= globalBodySize * 0.72 && local <= globalBodySize * 1.4 ? local : globalBodySize;
}

function scoreHeading(
  line: PdfLine,
  pageLines: PdfLine[],
  bodySize: number,
  repeatedMargins: Set<string>,
): number {
  const text = line.text;
  if (!text || text.length > MAX_TITLE_LENGTH) return -100;
  if (repeatedMargins.has(normalizeRepeatedText(text))) return -100;
  if (/\.{2,}\s*\d+\s*$/.test(text)) return -100;

  const fontRatio = line.fontSize / Math.max(1, bodySize);
  const bold = lineIsBold(line);
  let score = 0;

  if (fontRatio >= 1.65) score += 5;
  else if (fontRatio >= 1.35) score += 4;
  else if (fontRatio >= 1.12) score += 2.5;
  else if (fontRatio >= 1.04 && bold) score += 1.5;
  else score -= 4;

  if (bold) score += 1.5;
  if (line.lineIndex <= 3) score += 2;
  else if (line.lineIndex <= Math.max(7, Math.floor(pageLines.length * 0.3))) score += 1;
  if (looksUppercase(text)) score += 1;
  if (text.length <= 65) score += 1;
  if (SENTENCE_END_PATTERN.test(text)) score -= 2.5;
  if (text.split(/\s+/).length > 16) score -= 3;

  const previous = pageLines[line.lineIndex - 1];
  const next = pageLines[line.lineIndex + 1];
  if (!previous || previous.y - line.y > bodySize * 1.55) score += 1;
  if (!next || line.y - next.y > bodySize * 1.35) score += 0.75;
  return score;
}

function joinHeadingTitle(line: PdfLine, pageLines: PdfLine[], bodySize: number): string {
  const following = pageLines[line.lineIndex + 1];
  if (!following || following.text.length > 100 || line.text.length > 36) return line.text;
  const close = Math.abs(line.y - following.y) <= Math.max(line.fontSize, following.fontSize) * 2.8;
  const similarScale = Math.abs(line.fontSize - following.fontSize) <= bodySize * 0.18;
  const titleLike =
    following.fontSize >= bodySize * 1.08 ||
    lineIsBold(following) ||
    looksUppercase(following.text);
  if (!close || !similarScale || !titleLike || SENTENCE_END_PATTERN.test(following.text)) {
    return line.text;
  }
  return following.text;
}

function recurringHeadingStyles(markers: HeadingMarker[]): Set<string> {
  const pagesByStyle = new Map<string, Set<number>>();
  for (const marker of markers) {
    if (marker.score < 4.5) continue;
    const pages = pagesByStyle.get(marker.style) ?? new Set<number>();
    pages.add(marker.pageIndex);
    pagesByStyle.set(marker.style, pages);
  }
  return new Set(
    [...pagesByStyle.entries()]
      .filter(([, pageIndexes]) => pageIndexes.size >= 3)
      .map(([style]) => style),
  );
}

function selectMarkers(markers: HeadingMarker[]): HeadingMarker[] {
  const recurringStyles = recurringHeadingStyles(markers);
  const ordered = markers
    .filter(
      (marker) => marker.score >= 7 || (marker.score >= 5.25 && recurringStyles.has(marker.style)),
    )
    .sort((a, b) => a.pageIndex - b.pageIndex || a.lineIndex - b.lineIndex);

  const selected: HeadingMarker[] = [];
  for (const marker of ordered) {
    const previous = selected.at(-1);
    if (previous?.pageIndex === marker.pageIndex) {
      const sameHeading = Math.abs(previous.lineIndex - marker.lineIndex) <= 1;
      if (sameHeading) {
        if (marker.score > previous.score) selected[selected.length - 1] = marker;
        continue;
      }
      continue;
    }
    selected.push(marker);
  }
  return selected;
}

export function detectChaptersFromLayout(
  pageItems: StructuredTextItem[][],
  pageTexts: string[],
): DetectedChapter[] {
  const pages = mergePdfLines(pageItems);
  const globalBodySize = weightedBodyFontSize(pages.flat());
  const repeatedMargins = findRepeatedMargins(pages);
  const candidates: HeadingMarker[] = [];

  for (const lines of pages) {
    if (isIndexPage(lines)) continue;
    const bodySize = pageBodySize(lines, globalBodySize);
    for (const line of lines) {
      const score = scoreHeading(line, lines, bodySize, repeatedMargins);
      if (score < 4) continue;
      candidates.push({
        title: joinHeadingTitle(line, lines, bodySize),
        pageIndex: line.pageIndex,
        lineIndex: line.lineIndex,
        score,
        style: styleKey(line, bodySize),
      });
    }
  }

  const selected = selectMarkers(candidates);
  if (selected.length === 0) {
    return [
      {
        title: "Full text",
        startPage: 1,
        endPage: Math.max(1, pageTexts.length),
        content: pageTexts.join("\n\n").trim(),
      },
    ];
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
      content: pageTexts
        .slice(marker.pageIndex, endPageIndex + 1)
        .join("\n\n")
        .trim(),
    };
  });
}
