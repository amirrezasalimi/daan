import { db } from "@daan/db";
import {
  book,
  bookChapter,
  bookChapterContent,
} from "@daan/db/schema/book";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { parseBookSource } from "../books";
import { cleanChapterTitle } from "../books/chapter-title";
import {
  invalidateBookSearchIndex,
  searchBookChapters,
} from "../books/search-index";
import { readConfig } from "../config";
import { publicProcedure } from "../index";

const sourceTypeSchema = z.enum(["pdf", "ebook"]);

export const bookRouter = {
  /** All books, most recently updated first. */
  list: publicProcedure.handler(async () => {
    return db.select().from(book).orderBy(asc(book.title));
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ input }) => {
      const rows = await db.select().from(book).where(eq(book.id, input.id));
      return rows[0] ?? null;
    }),

  getChapters: publicProcedure
    .input(z.object({ bookId: z.string().min(1) }))
    .handler(async ({ input }) => {
      const chapters = await db
        .select()
        .from(bookChapter)
        .where(eq(bookChapter.bookId, input.bookId))
        .orderBy(asc(bookChapter.index));
      return chapters.map((chapter) => ({
        ...chapter,
        title: cleanChapterTitle(chapter.title),
      }));
    }),

  getChapterContent: publicProcedure
    .input(z.object({ chapterId: z.string().min(1) }))
    .handler(async ({ input }) => {
      return db
        .select()
        .from(bookChapterContent)
        .where(eq(bookChapterContent.chapterId, input.chapterId))
        .orderBy(asc(bookChapterContent.index));
    }),

  searchChapters: publicProcedure
    .input(
      z.object({
        bookId: z.string().min(1),
        query: z.string().trim().min(1).max(120),
      }),
    )
    .handler(({ input }) => searchBookChapters(input.bookId, input.query)),

  delete: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ input }) => {
      await db.delete(book).where(eq(book.id, input.id));
      invalidateBookSearchIndex(input.id);
      return { id: input.id };
    }),

  /**
   * Import a book from an uploaded file (base64-encoded). Parses the source,
   * detects chapters (auto/AI per config) and persists book + chapters +
   * per-chapter content.
   */
  import: publicProcedure
    .input(
      z.object({
        fileName: z.string().min(1),
        type: sourceTypeSchema,
        data: z.string().min(1),
        title: z.string().optional(),
        author: z.string().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const bytes = Buffer.from(input.data, "base64");
      const config = readConfig();
      const parsed = await parseBookSource(
        new Uint8Array(bytes),
        input.type,
        config,
      );

      const fallbackTitle = input.fileName.replace(/\.[^.]+$/, "");
      const title =
        input.title?.trim() || parsed.title?.trim() || fallbackTitle;
      const author = input.author?.trim() || parsed.author || null;

      const bookId = crypto.randomUUID();
      const now = new Date();

      await db.insert(book).values({
        id: bookId,
        title,
        type: input.type,
        author,
        description: null,
        settings: null,
        createdAt: now,
        updatedAt: now,
      });

      for (let i = 0; i < parsed.chapters.length; i += 1) {
        const chapter = parsed.chapters[i]!;
        const chapterId = crypto.randomUUID();

        await db.insert(bookChapter).values({
          id: chapterId,
          bookId,
          title: cleanChapterTitle(chapter.title),
          index: i,
          startPage: chapter.startPage,
          endPage: chapter.endPage,
          createdAt: now,
          updatedAt: now,
        });

        await db.insert(bookChapterContent).values({
          id: crypto.randomUUID(),
          bookId,
          chapterId,
          index: 0,
          content: chapter.content,
          createdAt: now,
          updatedAt: now,
        });
      }

      return {
        id: bookId,
        title,
        type: input.type,
        author,
        chapterCount: parsed.chapters.length,
      };
    }),

  saveChapterContent: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        content: z.string(),
      }),
    )
    .handler(async ({ input }) => {
      const rows = await db
        .select({ bookId: bookChapterContent.bookId })
        .from(bookChapterContent)
        .where(eq(bookChapterContent.id, input.id));

      await db
        .update(bookChapterContent)
        .set({ content: input.content, updatedAt: new Date() })
        .where(eq(bookChapterContent.id, input.id));

      const bookId = rows[0]?.bookId;
      if (bookId) invalidateBookSearchIndex(bookId);
      return { id: input.id };
    }),
};
