CREATE TABLE `user_blocks` (
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `target_key` text NOT NULL,
  `target_user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `created_at` integer NOT NULL,
  PRIMARY KEY (`user_id`, `target_key`)
);
