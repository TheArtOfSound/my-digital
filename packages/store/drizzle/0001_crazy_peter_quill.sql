CREATE TABLE `buyer_locked_payloads` (
	`license_id` text PRIMARY KEY NOT NULL,
	`payload` blob NOT NULL,
	`payload_hash` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`license_id`) REFERENCES `licenses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `custody_secrets` (
	`locked_asset_id` text PRIMARY KEY NOT NULL,
	`nonce_b64` text NOT NULL,
	`sealed_b64` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`locked_asset_id`) REFERENCES `locked_assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `issuer_secrets` (
	`issuer_name` text PRIMARY KEY NOT NULL,
	`nonce_b64` text NOT NULL,
	`sealed_b64` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`issuer_name`) REFERENCES `issuers`(`name`) ON UPDATE no action ON DELETE no action
);
