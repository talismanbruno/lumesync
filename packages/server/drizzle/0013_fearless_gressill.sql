CREATE TABLE `bug_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`diagnostics` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `voice_diagnostics` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`event` text NOT NULL,
	`reason` text,
	`channel_kind` text,
	`participant_count` integer,
	`connection_quality` text,
	`recovery_ms` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `users` ADD `registration_locale` text;--> statement-breakpoint
ALTER TABLE `users` ADD `registration_timezone` text;--> statement-breakpoint
ALTER TABLE `users` ADD `registration_country_code` text;--> statement-breakpoint
CREATE INDEX `idx_bug_reports_status` ON `bug_reports` (`status`);--> statement-breakpoint
CREATE INDEX `idx_bug_reports_created_at` ON `bug_reports` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_voice_diagnostics_created_at` ON `voice_diagnostics` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_voice_diagnostics_user_id` ON `voice_diagnostics` (`user_id`);