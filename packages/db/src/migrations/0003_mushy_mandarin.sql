CREATE TABLE `book_chapter_content_narration` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`chapter_content_id` text NOT NULL,
	`paragraph_index` integer NOT NULL,
	`position_start` integer NOT NULL,
	`position_end` integer NOT NULL,
	`tts_service_id` text NOT NULL,
	`model` text NOT NULL,
	`voice` text NOT NULL,
	`content` text NOT NULL,
	`original_content` text NOT NULL,
	`content_hash` text NOT NULL,
	`audio_path` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `book`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `book_chapter`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_content_id`) REFERENCES `book_chapter_content`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `narration_chapter_idx` ON `book_chapter_content_narration` (`chapter_id`,`paragraph_index`);--> statement-breakpoint
CREATE INDEX `narration_content_hash_idx` ON `book_chapter_content_narration` (`chapter_content_id`,`content_hash`,`tts_service_id`,`model`,`voice`);