ALTER TABLE `users` ADD `is_pioneer` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `users` SET `is_pioneer` = 1 WHERE `home_instance` IS NULL AND `is_deleted` = 0;
