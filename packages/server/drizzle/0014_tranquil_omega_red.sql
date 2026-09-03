CREATE TABLE `admin_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`target_label` text,
	`details` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `users` ADD `is_suspended` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `suspension_reason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `suspended_at` integer;--> statement-breakpoint
CREATE INDEX `idx_admin_audit_logs_created_at` ON `admin_audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_admin_audit_logs_admin_id` ON `admin_audit_logs` (`admin_id`);