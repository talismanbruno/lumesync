ALTER TABLE `instance_settings` ADD `max_user_storage_bytes` integer DEFAULT 1073741824 NOT NULL;--> statement-breakpoint
ALTER TABLE `instance_settings` ADD `max_daily_upload_bytes` integer DEFAULT 524288000 NOT NULL;--> statement-breakpoint
ALTER TABLE `instance_settings` ADD `min_free_disk_bytes` integer DEFAULT 5368709120 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_attachments_uploader_created_at` ON `attachments` (`uploader_id`,`created_at`);