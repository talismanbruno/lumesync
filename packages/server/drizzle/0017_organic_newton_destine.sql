/*
 SQLite does not support "Set default to column" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
                  https://www.sqlite.org/lang_altertable.html
                  https://stackoverflow.com/questions/2083543/modify-a-columns-type-in-sqlite3

 Due to that we don't generate migration automatically and it has to be done manually
*/--> statement-breakpoint
ALTER TABLE `instance_settings` ADD `max_voice_participants_per_room` integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `instance_settings` ADD `max_concurrent_voice_participants` integer DEFAULT 20 NOT NULL;--> statement-breakpoint
UPDATE `instance_settings` SET `max_bitrate_kbps` = 6000 WHERE `max_bitrate_kbps` > 6000;
