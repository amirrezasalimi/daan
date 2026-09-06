import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Supported book source types.
 */
export const BOOK_TYPES = ["pdf", "ebook"] as const;
export type BookType = (typeof BOOK_TYPES)[number];

/**
 * Free-form, per-book configuration persisted as JSON.
 * Kept intentionally loose so the editor/theme can evolve without migrations.
 */
export type BookSettings = {
  theme?: string;
  fontFamily?: string;
  fontSize?: number;
  [key: string]: unknown;
};

/**
 * A book is the top-level container in the library.
 */
export const book = sqliteTable(
  "book",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    type: text("type", { enum: BOOK_TYPES }).notNull().default("ebook"),
    author: text("author"),
    description: text("description"),
    settings: text("settings", { mode: "json" }).$type<BookSettings>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [index("book_type_idx").on(table.type)],
);

/**
 * A chapter belongs to a book and is ordered by `index`.
 */
export const bookChapter = sqliteTable(
  "book_chapter",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    bookId: text("book_id")
      .notNull()
      .references(() => book.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    index: integer("index").notNull().default(0),
    startPage: integer("start_page"),
    endPage: integer("end_page"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [index("book_chapter_book_id_idx").on(table.bookId, table.index)],
);

/**
 * A content block belongs to a chapter (and, denormalised, its book) and is
 * ordered within the chapter by `index`.
 */
export const bookChapterContent = sqliteTable(
  "book_chapter_content",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    bookId: text("book_id")
      .notNull()
      .references(() => book.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => bookChapter.id, { onDelete: "cascade" }),
    index: integer("index").notNull().default(0),
    content: text("content"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("book_chapter_content_chapter_id_idx").on(
      table.chapterId,
      table.index,
    ),
    index("book_chapter_content_book_id_idx").on(table.bookId),
  ],
);

export type Book = typeof book.$inferSelect;
export type NewBook = typeof book.$inferInsert;
export type BookChapter = typeof bookChapter.$inferSelect;
export type NewBookChapter = typeof bookChapter.$inferInsert;
export type BookChapterContent = typeof bookChapterContent.$inferSelect;
export type NewBookChapterContent = typeof bookChapterContent.$inferInsert;
