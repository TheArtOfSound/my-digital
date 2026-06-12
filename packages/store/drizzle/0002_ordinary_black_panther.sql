CREATE TABLE `checkout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`purchase_id` text NOT NULL,
	`listing_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`provider` text NOT NULL,
	`provider_reference` text NOT NULL,
	`checkout_url` text,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_id`) REFERENCES `buyers`(`id`) ON UPDATE no action ON DELETE no action
);
