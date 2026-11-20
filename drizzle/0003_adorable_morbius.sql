CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`subscription` text NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `materials` ADD `tier` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `tier` integer DEFAULT 1 NOT NULL;