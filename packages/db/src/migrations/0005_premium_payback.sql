CREATE TABLE `narration_preparation_run` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`target_start_index` integer NOT NULL,
	`target_end_index` integer NOT NULL,
	`target_source_hashes` text NOT NULL,
	`covered_source_hashes` text NOT NULL,
	`omitted_source_hashes` text NOT NULL,
	`provider_id` text NOT NULL,
	`model` text NOT NULL,
	`style` text NOT NULL,
	`target_language` text DEFAULT '' NOT NULL,
	`quality` text NOT NULL,
	`target_chunk_count` integer NOT NULL,
	`previous_context_count` integer NOT NULL,
	`future_context_count` integer NOT NULL,
	`minimum_coverage_percent` integer NOT NULL,
	`max_next_items` integer NOT NULL,
	`prompt_version` text NOT NULL,
	`job_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `book`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `book_chapter`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `narration_preparation_run_book_status_idx` ON `narration_preparation_run` (`book_id`,`status`);--> statement-breakpoint
CREATE INDEX `narration_preparation_run_chapter_target_idx` ON `narration_preparation_run` (`chapter_id`,`target_start_index`,`target_end_index`);--> statement-breakpoint
CREATE UNIQUE INDEX `narration_preparation_run_job_id_idx` ON `narration_preparation_run` (`job_id`);--> statement-breakpoint
CREATE TABLE `prepared_narration_chunk` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`book_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`output_index` integer NOT NULL,
	`source_start_index` integer NOT NULL,
	`source_end_index` integer NOT NULL,
	`source_hashes` text NOT NULL,
	`content` text NOT NULL,
	`content_hash` text NOT NULL,
	`provider_id` text NOT NULL,
	`model` text NOT NULL,
	`style` text NOT NULL,
	`target_language` text DEFAULT '' NOT NULL,
	`quality` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `narration_preparation_run`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `book`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `book_chapter`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prepared_narration_chunk_run_output_idx` ON `prepared_narration_chunk` (`run_id`,`output_index`);--> statement-breakpoint
CREATE INDEX `prepared_narration_chunk_chapter_source_idx` ON `prepared_narration_chunk` (`chapter_id`,`source_start_index`,`source_end_index`);--> statement-breakpoint
CREATE INDEX `prepared_narration_chunk_book_idx` ON `prepared_narration_chunk` (`book_id`);