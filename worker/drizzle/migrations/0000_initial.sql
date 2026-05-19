CREATE TABLE IF NOT EXISTS `user` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `email` text NOT NULL UNIQUE,
  `email_verified` integer DEFAULT 0 NOT NULL,
  `image` text,
  `password_hash` text,
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `updated_at` text NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS `session` (
  `id` text PRIMARY KEY NOT NULL,
  `expires_at` text NOT NULL,
  `token` text NOT NULL UNIQUE,
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `updated_at` text NOT NULL DEFAULT (datetime('now')),
  `ip_address` text,
  `user_agent` text,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `account` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `provider_id` text NOT NULL,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `access_token` text,
  `refresh_token` text,
  `id_token` text,
  `access_token_expires_at` integer,
  `refresh_token_expires_at` integer,
  `scope` text,
  `password` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `settings` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL UNIQUE REFERENCES `user`(`id`) ON DELETE CASCADE,
  `theme` text DEFAULT 'system',
  `theme_color` text DEFAULT 'default',
  `language` text DEFAULT 'system',
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `updated_at` text NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS `chats` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `user_id` text NOT NULL,
  `provider` text NOT NULL,
  `model` text NOT NULL,
  `deleted` integer DEFAULT 0,
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `updated_at` text NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS `files` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `storage` text NOT NULL DEFAULT 'r2',
  `url` text NOT NULL,
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `updated_at` text NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS `message_generations` (
  `id` text PRIMARY KEY NOT NULL,
  `type` text DEFAULT 'image' NOT NULL,
  `user_id` text NOT NULL,
  `prompt` text NOT NULL,
  `parameters` text,
  `provider` text NOT NULL,
  `model` text NOT NULL,
  `status` text DEFAULT 'pending',
  `file_ids` text,
  `error_reason` text,
  `generation_time` integer,
  `cost` real,
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `updated_at` text NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS `messages` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `chat_id` text NOT NULL REFERENCES `chats`(`id`) ON DELETE CASCADE,
  `content` text NOT NULL,
  `role` text NOT NULL,
  `type` text DEFAULT 'text' NOT NULL,
  `generation_id` text REFERENCES `message_generations`(`id`) ON DELETE SET NULL,
  `metadata` text,
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `updated_at` text NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS `message_attachments` (
  `id` text PRIMARY KEY NOT NULL,
  `message_id` text NOT NULL REFERENCES `messages`(`id`) ON DELETE CASCADE,
  `file_id` text NOT NULL REFERENCES `files`(`id`) ON DELETE CASCADE,
  `type` text DEFAULT 'image' NOT NULL,
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `updated_at` text NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS `ai_providers` (
  `id` text PRIMARY KEY NOT NULL,
  `provider_id` text NOT NULL,
  `user_id` text NOT NULL,
  `enabled` integer DEFAULT 1 NOT NULL,
  `settings` text,
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `updated_at` text NOT NULL DEFAULT (datetime('now')),
  UNIQUE(`user_id`, `provider_id`)
);

CREATE TABLE IF NOT EXISTS `ai_models` (
  `id` text PRIMARY KEY NOT NULL,
  `provider_id` text NOT NULL,
  `model_id` text NOT NULL,
  `enabled` integer DEFAULT 1 NOT NULL,
  `user_id` text NOT NULL,
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `updated_at` text NOT NULL DEFAULT (datetime('now')),
  UNIQUE(`user_id`, `provider_id`, `model_id`)
);
