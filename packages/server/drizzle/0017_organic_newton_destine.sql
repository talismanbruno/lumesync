ALTER TABLE `instance_settings` ADD `max_voice_participants_per_room` integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `instance_settings` ADD `max_concurrent_voice_participants` integer DEFAULT 20 NOT NULL;--> statement-breakpoint
UPDATE `instance_settings` SET `max_bitrate_kbps` = 6000 WHERE `max_bitrate_kbps` > 6000;
