CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_lower` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_lower_unique` ON `users` (`email_lower`);--> statement-breakpoint
ALTER TABLE `buyers` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `creators` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `creators` ADD `legal_name` text;--> statement-breakpoint
ALTER TABLE `creators` ADD `location` text;--> statement-breakpoint
ALTER TABLE `creators` ADD `verification_links` text;--> statement-breakpoint
ALTER TABLE `creators` ADD `verification_submitted_at` text;