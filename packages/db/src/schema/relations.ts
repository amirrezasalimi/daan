import { relations } from "drizzle-orm";

import {
  book,
  bookChapter,
  bookChapterContent,
  bookChapterContentNarration,
  narrationPreparationRun,
  preparedNarrationChunk,
} from "./book";

export const bookRelations = relations(book, ({ many }) => ({
  chapters: many(bookChapter),
  contents: many(bookChapterContent),
  narrations: many(bookChapterContentNarration),
  narrationPreparationRuns: many(narrationPreparationRun),
  preparedNarrationChunks: many(preparedNarrationChunk),
}));

export const bookChapterRelations = relations(bookChapter, ({ one, many }) => ({
  book: one(book, {
    fields: [bookChapter.bookId],
    references: [book.id],
  }),
  contents: many(bookChapterContent),
  narrations: many(bookChapterContentNarration),
  narrationPreparationRuns: many(narrationPreparationRun),
  preparedNarrationChunks: many(preparedNarrationChunk),
}));

export const bookChapterContentRelations = relations(bookChapterContent, ({ one, many }) => ({
  book: one(book, {
    fields: [bookChapterContent.bookId],
    references: [book.id],
  }),
  chapter: one(bookChapter, {
    fields: [bookChapterContent.chapterId],
    references: [bookChapter.id],
  }),
  narrations: many(bookChapterContentNarration),
}));

export const narrationPreparationRunRelations = relations(
  narrationPreparationRun,
  ({ one, many }) => ({
    book: one(book, {
      fields: [narrationPreparationRun.bookId],
      references: [book.id],
    }),
    chapter: one(bookChapter, {
      fields: [narrationPreparationRun.chapterId],
      references: [bookChapter.id],
    }),
    preparedChunks: many(preparedNarrationChunk),
  }),
);

export const preparedNarrationChunkRelations = relations(preparedNarrationChunk, ({ one }) => ({
  run: one(narrationPreparationRun, {
    fields: [preparedNarrationChunk.runId],
    references: [narrationPreparationRun.id],
  }),
  book: one(book, {
    fields: [preparedNarrationChunk.bookId],
    references: [book.id],
  }),
  chapter: one(bookChapter, {
    fields: [preparedNarrationChunk.chapterId],
    references: [bookChapter.id],
  }),
}));

export const bookChapterContentNarrationRelations = relations(
  bookChapterContentNarration,
  ({ one }) => ({
    book: one(book, {
      fields: [bookChapterContentNarration.bookId],
      references: [book.id],
    }),
    chapter: one(bookChapter, {
      fields: [bookChapterContentNarration.chapterId],
      references: [bookChapter.id],
    }),
    chapterContent: one(bookChapterContent, {
      fields: [bookChapterContentNarration.chapterContentId],
      references: [bookChapterContent.id],
    }),
  }),
);
