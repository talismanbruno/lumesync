ALTER TABLE users ADD COLUMN social_links text NOT NULL DEFAULT '[]';
--> statement-breakpoint
CREATE TABLE spotify_connections (
  user_id text PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_tokens text NOT NULL,
  expires_at integer NOT NULL,
  password_epoch integer NOT NULL,
  show_listening integer NOT NULL DEFAULT 1,
  updated_at integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE spotify_oauth_states (
  state_hash text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_verifier text NOT NULL,
  expires_at integer NOT NULL,
  password_epoch integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_spotify_oauth_user ON spotify_oauth_states(user_id);
