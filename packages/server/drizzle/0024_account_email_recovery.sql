CREATE TABLE `account_emails` (
  `user_id` text PRIMARY KEY NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `email` text UNIQUE,
  `pending_email` text,
  `verified_at` integer
);
--> statement-breakpoint
CREATE TABLE `account_email_tokens` (
  `token_hash` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `purpose` text NOT NULL,
  `email` text NOT NULL,
  `password_epoch` integer NOT NULL,
  `created_at` integer NOT NULL,
  `expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_account_email_tokens_user` ON `account_email_tokens` (`user_id`);
