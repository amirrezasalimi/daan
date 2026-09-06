import { extractTextItems, getDocumentProxy, getMeta, type StructuredTextItem } from "unpdf";

import { cleanChapterTitle } from "./chapter-title";
import { formatPdfPages } from "./pdf-format";
import { detectChaptersFromLayout } from "./pdf-layout";
import type { DetectedChapter, ParsedBook } from "./types";

interface OutlineNode {
  title: string;
  dest: string | unknown[] | null;
  items: OutlineNode[];
}

interface OutlineMarker {
  title: string;
  startPage: number;
  depth: number;
  hasChildren: boolean;
}

async function resolveDestPage(
  pdf: Awaited<ReturnType<typeof getDocumentProxy>>,
  dest: string | unknown[] | null,
): Promise<number | null> {
  try {
    let explicit = dest;
    if (typeof dest === "string") explicit = await pdf.getDestination(dest);
    if (!Array.isArray(explicit) || explicit.length === 0) return null;

    const ref = explicit[0];
    if (typeof ref === "number") return ref;
    if (ref && typeof ref === "object") {
      return await pdf.getPageIndex(ref as { num: number; gen: number });
    }
    return null;
  } catch {
    return null;
  }
}

async function flattenOutline(
  pdf: Awaited<ReturnType<typeof getDocumentProxy>>,
  nodes: OutlineNode[],
  depth = 0,
): Promise<OutlineMarker[]> {
  const markers: OutlineMarker[] = [];
  for (const node of nodes) {
    const title = node.title?.replace(/\s+/g, " ").trim();
    if (title) {
      const pageIndex = await resolveDestPage(pdf, node.dest);
      if (pageIndex != null) {
        markers.push({
          title,
          startPage: pageIndex + 1,
          depth,
          hasChildren: Boolean(node.items?.length),
        });
      }
    }
    if (node.items?.length) {
      markers.push(...(await flattenOutline(pdf, node.items, depth + 1)));
    }
  }
  return markers;
}

function normalizedTokens(text: string): Set<string> {
  const tokens = text
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1 && !/^\d+$/.test(token));
  return new Set(tokens);
}

function tokenOverlap(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let common = 0;
  for (const token of left) {
    if (right.has(token)) common += 1;
  }
  return common / Math.min(left.size, right.size);
}

function looksLikeOutlineIndexPage(
  text: string,
  pageNumber: number,
  markers: OutlineMarker[],
): boolean {
  const lines = text
    .split("\n")
    .map((line) => normalizedTokens(line))
    .filter((tokens) => tokens.size >= 2);
  if (lines.length < 5) return false;

  const referencedTitles = markers
    .filter((marker) => marker.startPage !== pageNumber)
    .map((marker) => normalizedTokens(marker.title))
    .filter((tokens) => tokens.size >= 2);
  let matches = 0;
  for (const line of lines) {
    if (referencedTitles.some((title) => tokenOverlap(line, title) >= 0.65)) {
      matches += 1;
    }
  }
  return matches >= 4 && matches / lines.length >= 0.2;
}

/** Select structural bookmark leaves without interpreting their language. */
function selectOutlineMarkers(markers: OutlineMarker[], pageTexts: string[]): OutlineMarker[] {
  const leaves = markers.filter((marker) => !marker.hasChildren);
  const candidates = leaves.length >= 2 ? leaves : markers;
  const openingPageLimit = Math.max(2, Math.floor(pageTexts.length * 0.01));

  return candidates.filter((marker) => {
    const pageText = pageTexts[marker.startPage - 1] ?? "";
    if (looksLikeOutlineIndexPage(pageText, marker.startPage, markers)) return false;
    const isSparseOpeningPage =
      marker.startPage <= openingPageLimit && pageText.replace(/\s/g, "").length < 240;
    return !isSparseOpeningPage;
  });
}

function buildChaptersFromMarkers(
  markers: OutlineMarker[],
  pageTexts: string[],
): DetectedChapter[] | null {
  const ordered = markers
    .sort((a, b) => a.startPage - b.startPage)
    .filter((marker, index, all) => index === 0 || marker.startPage !== all[index - 1]?.startPage);
  if (ordered.length < 2) return null;

  return ordered.map((marker, index) => {
    const next = ordered[index + 1];
    const endPage = next ? Math.max(marker.startPage, next.startPage - 1) : pageTexts.length;
    return {
      title: cleanChapterTitle(marker.title),
      startPage: marker.startPage,
      endPage,
      content: pageTexts
        .slice(marker.startPage - 1, endPage)
        .join("\n\n")
        .trim(),
    };
  });
}

async function chaptersFromOutline(
  pdf: Awaited<ReturnType<typeof getDocumentProxy>>,
  pageTexts: string[],
): Promise<DetectedChapter[] | null> {
  const outline = (await pdf.getOutline()) as OutlineNode[] | null;
  if (!outline?.length) return null;
  const flattened = await flattenOutline(pdf, outline);
  return buildChaptersFromMarkers(selectOutlineMarkers(flattened, pageTexts), pageTexts);
}

function textFromItems(items: StructuredTextItem[]): string {
  return items
    .map((item) => `${item.str}${item.hasEOL ? "\n" : ""}`)
    .join("")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Auto-only PDF parsing: embedded outline first, then whole-book layout
 * analysis using unpdf's positioned text items. No LLM is involved.
 */
export async function parsePdf(data: Uint8Array): Promise<ParsedBook> {
  const pdf = await getDocumentProxy(data, { maxImageSize: 16_777_216 });
  const { items } = await extractTextItems(pdf);
  const pages = items.map(textFromItems);

  let title = "";
  let author: string | undefined;
  try {
    const meta = await getMeta(pdf);
    const info = (meta.info ?? {}) as Record<string, unknown>;
    title = typeof info.Title === "string" ? info.Title.trim() : "";
    author = typeof info.Author === "string" ? info.Author.trim() : undefined;
  } catch {
    // Metadata is optional.
  }

  const detectedChapters =
    (await chaptersFromOutline(pdf, pages)) ?? detectChaptersFromLayout(items, pages);
  const formattedPages = formatPdfPages(items);
  const chapters = detectedChapters.map((chapter) => ({
    ...chapter,
    content: formattedPages
      .slice(chapter.startPage - 1, chapter.endPage)
      .filter(Boolean)
      .join("\n"),
  }));

  return { title, author, pages, chapters };
}
