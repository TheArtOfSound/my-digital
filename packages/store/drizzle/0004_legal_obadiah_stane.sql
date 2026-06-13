ALTER TABLE `checkout_sessions` ADD `connected_account_id` text;--> statement-breakpoint
ALTER TABLE `creators` ADD `stripe_account_id` text;--> statement-breakpoint
ALTER TABLE `creators` ADD `payouts_enabled` integer;