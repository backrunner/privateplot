CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`slug` text NOT NULL,
	`summary` text NOT NULL,
	`rendered` text,
	`meta` text,
	`created_date` integer NOT NULL,
	`updated_date` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_slug_unique` ON `articles` (`slug`);--> statement-breakpoint
CREATE TABLE `friend_links` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`description` text,
	`avatar` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_date` integer NOT NULL,
	`updated_date` integer NOT NULL
);
