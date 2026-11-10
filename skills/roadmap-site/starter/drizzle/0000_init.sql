CREATE TABLE `roadmap_activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` text NOT NULL,
	`kind` text NOT NULL,
	`item_id` text,
	`actor_name` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `roadmap_comment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` text NOT NULL,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `roadmap_item_state` (
	`item_id` text PRIMARY KEY NOT NULL,
	`status` text,
	`base` text,
	`note` text DEFAULT '' NOT NULL,
	`link` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`editor_name` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `roadmap_snapshot` (
	`id` integer PRIMARY KEY NOT NULL,
	`commit_sha` text NOT NULL,
	`author` text NOT NULL,
	`generated_at` text NOT NULL,
	`pushed_at` text NOT NULL,
	`data` text NOT NULL
);
