import { env } from "@daan/env/server";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";

import * as schema from "./schema";

export function createDb() {
  const client = createClient({
    url: env.DATABASE_URL,
  });

  return drizzle({ client, schema });
}

export const db = createDb();

/**
 * Backfill feature tables for databases created before runtime migrations were tracked.
 * The statements mirror migration 0005 and are safe to run on every server start.
 */
export async function ensureNarrationPreparationSchema(): Promise<void> {
  await db.run(
    sql.raw(`
    CREATE TABLE IF NOT EXISTS narration_preparation_run (
      id text PRIMARY KEY NOT NULL,
      book_id text NOT NULL REFERENCES book(id) ON DELETE cascade,
      chapter_id text NOT NULL REFERENCES book_chapter(id) ON DELETE cascade,
      target_start_index integer NOT NULL,
      target_end_index integer NOT NULL,
      target_source_hashes text NOT NULL,
      covered_source_hashes text NOT NULL,
      omitted_source_hashes text NOT NULL,
      provider_id text NOT NULL,
      model text NOT NULL,
      style text NOT NULL,
      target_language text DEFAULT '' NOT NULL,
      quality text NOT NULL,
      target_chunk_count integer NOT NULL,
      previous_context_count integer NOT NULL,
      future_context_count integer NOT NULL,
      minimum_coverage_percent integer NOT NULL,
      max_next_items integer NOT NULL,
      prompt_version text NOT NULL,
      job_id text,
      status text DEFAULT 'pending' NOT NULL,
      error text,
      started_at integer,
      completed_at integer,
      created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
      updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL
    )
  `),
  );
  await db.run(
    sql.raw(
      "CREATE INDEX IF NOT EXISTS narration_preparation_run_book_status_idx ON narration_preparation_run (book_id, status)",
    ),
  );
  await db.run(
    sql.raw(
      "CREATE INDEX IF NOT EXISTS narration_preparation_run_chapter_target_idx ON narration_preparation_run (chapter_id, target_start_index, target_end_index)",
    ),
  );
  await db.run(
    sql.raw(
      "CREATE UNIQUE INDEX IF NOT EXISTS narration_preparation_run_job_id_idx ON narration_preparation_run (job_id)",
    ),
  );
  await db.run(
    sql.raw(`
    CREATE TABLE IF NOT EXISTS prepared_narration_chunk (
      id text PRIMARY KEY NOT NULL,
      run_id text NOT NULL REFERENCES narration_preparation_run(id) ON DELETE cascade,
      book_id text NOT NULL REFERENCES book(id) ON DELETE cascade,
      chapter_id text NOT NULL REFERENCES book_chapter(id) ON DELETE cascade,
      output_index integer NOT NULL,
      source_start_index integer NOT NULL,
      source_end_index integer NOT NULL,
      source_hashes text NOT NULL,
      content text NOT NULL,
      content_hash text NOT NULL,
      provider_id text NOT NULL,
      model text NOT NULL,
      style text NOT NULL,
      target_language text DEFAULT '' NOT NULL,
      quality text NOT NULL,
      created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
      updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL
    )
  `),
  );
  await db.run(
    sql.raw(
      "CREATE UNIQUE INDEX IF NOT EXISTS prepared_narration_chunk_run_output_idx ON prepared_narration_chunk (run_id, output_index)",
    ),
  );
  await db.run(
    sql.raw(
      "CREATE INDEX IF NOT EXISTS prepared_narration_chunk_chapter_source_idx ON prepared_narration_chunk (chapter_id, source_start_index, source_end_index)",
    ),
  );
  await db.run(
    sql.raw(
      "CREATE INDEX IF NOT EXISTS prepared_narration_chunk_book_idx ON prepared_narration_chunk (book_id)",
    ),
  );
}
