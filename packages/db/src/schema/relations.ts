import { relations } from "drizzle-orm";

import { book, bookChapter, bookChapterContent } from "./book";

export const bookRelations = relations(book, ({ many }) => ({
  chapters: many(bookChapter),
  contents: many(bookChapterContent),
}));

export const bookChapterRelations = relations(
  bookChapter,
  ({ one, many }) => ({
    book: one(book, {
      fields: [bookChapter.bookId],
      references: [book.id],
    }),
    contents: many(bookChapterContent),
  }),
);

export const bookChapterContentRelations = relations(
  bookChapterContent,
  ({ one }) => ({
    book: one(book, {
      fields: [bookChapterContent.bookId],
      references: [book.id],
    }),
    chapter: one(bookChapter, {
      fields: [bookChapterContent.chapterId],
      references: [bookChapter.id],
    }),
  }),
);
