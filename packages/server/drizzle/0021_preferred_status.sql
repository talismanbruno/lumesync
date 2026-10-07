ALTER TABLE `users` ADD `preferred_status` text NOT NULL DEFAULT 'online';
--> statement-breakpoint
UPDATE `users` SET `preferred_status` = `status`
WHERE `status` IN ('idle', 'dnd') OR (`status` = 'working' AND `is_admin` = 1);
