import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
    sourcePath: text("source_path"),
    sourceSize: integer("source_size"),
    sourceMimeType: text("source_mime_type"),
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
export const NARRATION_STATUSES = ["pending", "processing", "ready", "failed"] as const;
export type NarrationStatus = (typeof NARRATION_STATUSES)[number];

export const NARRATION_PREPARATION_QUALITIES = ["fast", "balanced", "high"] as const;
export type NarrationPreparationQuality = (typeof NARRATION_PREPARATION_QUALITIES)[number];

export type NarrationSourceHashes = string[];

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
    index("book_chapter_content_chapter_id_idx").on(table.chapterId, table.index),
    index("book_chapter_content_book_id_idx").on(table.bookId),
  ],
);

export const narrationPreparationRun = sqliteTable(
  "narration_preparation_run",
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
    targetStartIndex: integer("target_start_index").notNull(),
    targetEndIndex: integer("target_end_index").notNull(),
    targetSourceHashes: text("target_source_hashes", { mode: "json" })
      .$type<NarrationSourceHashes>()
      .notNull(),
    coveredSourceHashes: text("covered_source_hashes", { mode: "json" })
      .$type<NarrationSourceHashes>()
      .notNull(),
    omittedSourceHashes: text("omitted_source_hashes", { mode: "json" })
      .$type<NarrationSourceHashes>()
      .notNull(),
    providerId: text("provider_id").notNull(),
    model: text("model").notNull(),
    style: text("style").notNull(),
    targetLanguage: text("target_language").notNull().default(""),
    quality: text("quality", { enum: NARRATION_PREPARATION_QUALITIES }).notNull(),
    targetChunkCount: integer("target_chunk_count").notNull(),
    previousContextCount: integer("previous_context_count").notNull(),
    futureContextCount: integer("future_context_count").notNull(),
    minimumCoveragePercent: integer("minimum_coverage_percent").notNull(),
    maxNextItems: integer("max_next_items").notNull(),
    promptVersion: text("prompt_version").notNull(),
    jobId: text("job_id"),
    status: text("status", { enum: NARRATION_STATUSES }).notNull().default("pending"),
    error: text("error"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("narration_preparation_run_book_status_idx").on(table.bookId, table.status),
    index("narration_preparation_run_chapter_target_idx").on(
      table.chapterId,
      table.targetStartIndex,
      table.targetEndIndex,
    ),
    uniqueIndex("narration_preparation_run_job_id_idx").on(table.jobId),
  ],
);

export const preparedNarrationChunk = sqliteTable(
  "prepared_narration_chunk",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    runId: text("run_id")
      .notNull()
      .references(() => narrationPreparationRun.id, { onDelete: "cascade" }),
    bookId: text("book_id")
      .notNull()
      .references(() => book.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => bookChapter.id, { onDelete: "cascade" }),
    outputIndex: integer("output_index").notNull(),
    sourceStartIndex: integer("source_start_index").notNull(),
    sourceEndIndex: integer("source_end_index").notNull(),
    sourceHashes: text("source_hashes", { mode: "json" }).$type<NarrationSourceHashes>().notNull(),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    providerId: text("provider_id").notNull(),
    model: text("model").notNull(),
    style: text("style").notNull(),
    targetLanguage: text("target_language").notNull().default(""),
    quality: text("quality", { enum: NARRATION_PREPARATION_QUALITIES }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("prepared_narration_chunk_run_output_idx").on(table.runId, table.outputIndex),
    index("prepared_narration_chunk_chapter_source_idx").on(
      table.chapterId,
      table.sourceStartIndex,
      table.sourceEndIndex,
    ),
    index("prepared_narration_chunk_book_idx").on(table.bookId),
  ],
);

export const bookChapterContentNarration = sqliteTable(
  "book_chapter_content_narration",
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
    chapterContentId: text("chapter_content_id")
      .notNull()
      .references(() => bookChapterContent.id, { onDelete: "cascade" }),
    paragraphIndex: integer("paragraph_index").notNull(),
    positionStart: integer("position_start").notNull(),
    positionEnd: integer("position_end").notNull(),
    ttsServiceId: text("tts_service_id").notNull(),
    model: text("model").notNull(),
    voice: text("voice").notNull(),
    content: text("content").notNull(),
    originalContent: text("original_content").notNull(),
    contentHash: text("content_hash").notNull(),
    audioPath: text("audio_path"),
    jobId: text("job_id"),
    status: text("status", { enum: NARRATION_STATUSES }).notNull().default("pending"),
    error: text("error"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("narration_chapter_idx").on(table.chapterId, table.paragraphIndex),
    uniqueIndex("narration_content_identity_idx").on(
      table.chapterContentId,
      table.positionStart,
      table.contentHash,
      table.ttsServiceId,
      table.model,
      table.voice,
    ),
  ],
);

export type Book = typeof book.$inferSelect;
export type NewBook = typeof book.$inferInsert;
export type BookChapter = typeof bookChapter.$inferSelect;
export type NewBookChapter = typeof bookChapter.$inferInsert;
export type BookChapterContent = typeof bookChapterContent.$inferSelect;
export type NewBookChapterContent = typeof bookChapterContent.$inferInsert;
export type NarrationPreparationRun = typeof narrationPreparationRun.$inferSelect;
export type NewNarrationPreparationRun = typeof narrationPreparationRun.$inferInsert;
export type PreparedNarrationChunk = typeof preparedNarrationChunk.$inferSelect;
export type NewPreparedNarrationChunk = typeof preparedNarrationChunk.$inferInsert;
export type BookChapterContentNarration = typeof bookChapterContentNarration.$inferSelect;
export type NewBookChapterContentNarration = typeof bookChapterContentNarration.$inferInsert;
