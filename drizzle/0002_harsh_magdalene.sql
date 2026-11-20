CREATE TABLE `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`course` text NOT NULL,
	`name` text NOT NULL,
	`parent` text DEFAULT '' NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`course`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `folder_sibling` ON `folders` (`course`,`parent`,`name`);--> statement-breakpoint
ALTER TABLE `materials` ADD `folder` text DEFAULT 'other' NOT NULL;