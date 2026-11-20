CREATE TABLE `message_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`message` text NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`message`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
