CREATE TABLE `book` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'ebook' NOT NULL,
	`author` text,
	`description` text,
	`settings` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `book_type_idx` ON `book` (`type`);--> statement-breakpoint
CREATE TABLE `book_chapter` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`title` text NOT NULL,
	`index` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `book`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `book_chapter_book_id_idx` ON `book_chapter` (`book_id`,`index`);--> statement-breakpoint
CREATE TABLE `book_chapter_content` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`index` integer DEFAULT 0 NOT NULL,
	`content` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `book`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `book_chapter`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `book_chapter_content_chapter_id_idx` ON `book_chapter_content` (`chapter_id`,`index`);--> statement-breakpoint
CREATE INDEX `book_chapter_content_book_id_idx` ON `book_chapter_content` (`book_id`);