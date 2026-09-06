import {
  extractTextItems,
  getDocumentProxy,
  getMeta,
  type StructuredTextItem,
} from "unpdf";

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
}

const OUTLINE_EXCLUDED = /^(cover|title page|copyright|contents?|table of contents)$/i;
const OUTLINE_CHAPTER = /^(chapter|part|book|section)\s+(\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
const OUTLINE_NAMED = /^(prologue|epilogue|introduction|foreword|preface|afterword|conclusion|appendix)\b/i;

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
    if (title && !OUTLINE_EXCLUDED.test(title)) {
      const pageIndex = await resolveDestPage(pdf, node.dest);
      if (pageIndex != null) {
        markers.push({ title, startPage: pageIndex + 1, depth });
      }
    }
    if (node.items?.length) {
      markers.push(...(await flattenOutline(pdf, node.items, depth + 1)));
    }
  }
  return markers;
}

/** Select the outline level most likely to contain actual chapters. */
function selectOutlineLevel(markers: OutlineMarker[]): OutlineMarker[] {
  const byDepth = new Map<number, OutlineMarker[]>();
  for (const marker of markers) {
    const group = byDepth.get(marker.depth) ?? [];
    group.push(marker);
    byDepth.set(marker.depth, group);
  }

  let best: OutlineMarker[] = [];
  let bestScore = -Infinity;
  for (const [depth, group] of byDepth) {
    if (group.length < 2) continue;
    const explicit = group.filter((marker) => OUTLINE_CHAPTER.test(marker.title)).length;
    const named = group.filter((marker) => OUTLINE_NAMED.test(marker.title)).length;
    const semanticRatio = (explicit + named) / group.length;
    const score = explicit * 5 + named * 3 + Math.min(group.length, 20)
      + semanticRatio * 5 - depth;
    if (score > bestScore) {
      best = group;
      bestScore = score;
    }
  }
  return best;
}

function buildChaptersFromMarkers(
  markers: OutlineMarker[],
  pageTexts: string[],
): DetectedChapter[] | null {
  const ordered = markers
    .sort((a, b) => a.startPage - b.startPage)
    .filter((marker, index, all) =>
      index === 0 || marker.startPage !== all[index - 1]?.startPage,
    );
  if (ordered.length < 2) return null;

  return ordered.map((marker, index) => {
    const next = ordered[index + 1];
    const endPage = next
      ? Math.max(marker.startPage, next.startPage - 1)
      : pageTexts.length;
    return {
      title: cleanChapterTitle(marker.title),
      startPage: marker.startPage,
      endPage,
      content: pageTexts.slice(marker.startPage - 1, endPage).join("\n\n").trim(),
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
  return buildChaptersFromMarkers(selectOutlineLevel(flattened), pageTexts);
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
    (await chaptersFromOutline(pdf, pages))
    ?? detectChaptersFromLayout(items, pages);
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
