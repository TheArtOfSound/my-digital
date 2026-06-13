-- from 0000_same_speed.sql
CREATE TABLE `asset_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`version_label` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`content_hash` text NOT NULL,
	`manifest_hash` text NOT NULL,
	`manifest_json` text NOT NULL,
	`created_at` text NOT NULL,
	`changelog` text,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`created_at` text NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `buyers` (
	`id` text PRIMARY KEY NOT NULL,
	`email_hash` text NOT NULL,
	`display_name` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `creators` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`handle` text NOT NULL,
	`email_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`verification_status` text NOT NULL,
	`public_signing_key` text
);
--> statement-breakpoint
CREATE TABLE `fingerprints` (
	`id` text PRIMARY KEY NOT NULL,
	`license_id` text NOT NULL,
	`asset_version_id` text NOT NULL,
	`fingerprint_type` text NOT NULL,
	`fingerprint_hash` text NOT NULL,
	`embedding_strategy` text NOT NULL,
	`confidence_model` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`license_id`) REFERENCES `licenses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_version_id`) REFERENCES `asset_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `issuers` (
	`name` text PRIMARY KEY NOT NULL,
	`public_key_b64` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `licenses` (
	`id` text PRIMARY KEY NOT NULL,
	`purchase_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`asset_version_id` text NOT NULL,
	`locked_asset_id` text NOT NULL,
	`terms` text NOT NULL,
	`allowed_uses` text NOT NULL,
	`expires_at` text,
	`unlock_limit` integer,
	`issuer` text NOT NULL,
	`issuer_signature` text NOT NULL,
	`issued_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_id`) REFERENCES `buyers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_version_id`) REFERENCES `asset_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`locked_asset_id`) REFERENCES `locked_assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`active_asset_version_id` text NOT NULL,
	`creator_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`price_amount` integer NOT NULL,
	`price_currency` text NOT NULL,
	`license_terms` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`active_asset_version_id`) REFERENCES `asset_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `locked_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_version_id` text NOT NULL,
	`envelope_format` text NOT NULL,
	`envelope_version` text NOT NULL,
	`locked_payload_hash` text NOT NULL,
	`metadata_hash` text NOT NULL,
	`qev_engine_version` text NOT NULL,
	`storage_uri` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`asset_version_id`) REFERENCES `asset_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `locked_payloads` (
	`locked_asset_id` text PRIMARY KEY NOT NULL,
	`payload` blob NOT NULL,
	FOREIGN KEY (`locked_asset_id`) REFERENCES `locked_assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `proof_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`purchase_id` text NOT NULL,
	`license_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`asset_version_id` text NOT NULL,
	`buyer_id_hash` text NOT NULL,
	`creator_id` text NOT NULL,
	`receipt_hash` text NOT NULL,
	`issuer_signature` text NOT NULL,
	`created_at` text NOT NULL,
	`verification_url` text,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`license_id`) REFERENCES `licenses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_version_id`) REFERENCES `asset_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creator_id`) REFERENCES `creators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`listing_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`asset_version_id` text NOT NULL,
	`payment_provider` text NOT NULL,
	`payment_provider_reference` text NOT NULL,
	`amount_paid` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`paid_at` text,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_id`) REFERENCES `buyers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_version_id`) REFERENCES `asset_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `revocations` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`issuer_signature` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `unlock_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`license_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`redeemed_at` text,
	`redemption_count` integer NOT NULL,
	`max_redemptions` integer,
	`status` text NOT NULL,
	FOREIGN KEY (`license_id`) REFERENCES `licenses`(`id`) ON UPDATE no action ON DELETE no action
);

-- from 0001_crazy_peter_quill.sql
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

-- from 0002_ordinary_black_panther.sql
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

