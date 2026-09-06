import { db } from "@daan/db";
import { bookChapter, bookChapterContent } from "@daan/db/schema/book";
import { asc, eq } from "drizzle-orm";
import MiniSearch from "minisearch";

import { cleanChapterTitle } from "./chapter-title";
import { contentToPlainText } from "./content-text";

interface ChapterSearchDocument {
  id: string;
  title: string;
  content: string;
  chapterIndex: number;
}

interface CachedBookIndex {
  index: MiniSearch<ChapterSearchDocument>;
  documents: Map<string, ChapterSearchDocument>;
}

export interface ChapterSearchResult {
  chapterId: string;
  title: string;
  index: number;
  excerpt: string;
  matchedTerms: string[];
  score: number;
}

const indexCache = new Map<string, CachedBookIndex>();

function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function createExcerpt(content: string, query: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return "No extracted text";

  const normalizedQuery = normalizeSearchText(query);
  const lower = normalizeSearchText(normalized);
  const phrasePosition = lower.indexOf(normalizedQuery);
  const terms = normalizedQuery.split(" ").filter((term) => term.length > 1);
  const termPositions = terms
    .map((term) => lower.indexOf(term))
    .filter((position) => position >= 0);
  const matchAt =
    phrasePosition >= 0
      ? phrasePosition
      : termPositions.length > 0
        ? Math.min(...termPositions)
        : 0;
  const start = Math.max(0, matchAt - 54);
  const end = Math.min(normalized.length, start + 150);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < normalized.length ? "…" : "";

  return `${prefix}${normalized.slice(start, end).trim()}${suffix}`;
}

async function buildBookIndex(bookId: string): Promise<CachedBookIndex> {
  const rows = await db
    .select({
      id: bookChapter.id,
      title: bookChapter.title,
      chapterIndex: bookChapter.index,
      content: bookChapterContent.content,
    })
    .from(bookChapter)
    .leftJoin(bookChapterContent, eq(bookChapterContent.chapterId, bookChapter.id))
    .where(eq(bookChapter.bookId, bookId))
    .orderBy(asc(bookChapter.index), asc(bookChapterContent.index));

  const documents = new Map<string, ChapterSearchDocument>();
  for (const row of rows) {
    const existing = documents.get(row.id);
    if (existing) {
      existing.content = `${existing.content}\n${contentToPlainText(row.content ?? "")}`.trim();
      continue;
    }
    documents.set(row.id, {
      id: row.id,
      title: cleanChapterTitle(row.title),
      chapterIndex: row.chapterIndex,
      content: contentToPlainText(row.content ?? ""),
    });
  }

  const index = new MiniSearch<ChapterSearchDocument>({
    fields: ["title", "content"],
    storeFields: ["title", "chapterIndex"],
    searchOptions: {
      boost: { title: 4 },
      prefix: true,
    },
  });
  index.addAll([...documents.values()]);

  return { index, documents };
}

async function getBookIndex(bookId: string): Promise<CachedBookIndex> {
  const cached = indexCache.get(bookId);
  if (cached) return cached;

  const built = await buildBookIndex(bookId);
  indexCache.set(bookId, built);
  return built;
}

export function invalidateBookSearchIndex(bookId: string): void {
  indexCache.delete(bookId);
}

export async function searchBookChapters(
  bookId: string,
  query: string,
): Promise<ChapterSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cached = await getBookIndex(bookId);
  const normalizedQuery = normalizeSearchText(trimmed);
  const isPhrase = normalizedQuery.includes(" ");
  const candidates = cached.index.search(trimmed, {
    boost: { title: 4 },
    combineWith: isPhrase ? "AND" : "OR",
    prefix: !isPhrase,
    fuzzy: isPhrase ? false : (term) => (term.length >= 5 ? 0.2 : false),
  });

  return candidates
    .filter((result) => {
      if (!isPhrase) return true;
      const document = cached.documents.get(String(result.id));
      return (
        normalizeSearchText(document?.title ?? "").includes(normalizedQuery) ||
        normalizeSearchText(document?.content ?? "").includes(normalizedQuery)
      );
    })
    .slice(0, 30)
    .map((result) => {
      const document = cached.documents.get(String(result.id));
      return {
        chapterId: String(result.id),
        title: String(result.title ?? document?.title ?? "Untitled chapter"),
        index: Number(result.chapterIndex ?? document?.chapterIndex ?? 0),
        excerpt: createExcerpt(document?.content ?? "", trimmed),
        matchedTerms: isPhrase ? [trimmed] : result.terms,
        score: result.score,
      };
    });
}
