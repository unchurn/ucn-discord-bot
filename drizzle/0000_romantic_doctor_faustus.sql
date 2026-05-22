CREATE TABLE `member` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`username` text,
	`display_name` text,
	`joined_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_guild_id_user_id_unique` ON `member` (`guild_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `member_user_id_index` ON `member` (`user_id`);--> statement-breakpoint
CREATE INDEX `member_guild_id_index` ON `member` (`guild_id`);--> statement-breakpoint
CREATE TABLE `ticket` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`created_by_id` text NOT NULL,
	`accepted_by_id` text,
	`closed_by_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`ticket_type` text NOT NULL,
	`summary` text NOT NULL,
	`close_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`accepted_at` integer,
	`closed_at` integer,
	`first_response_seconds` integer,
	`resolution_seconds` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ticket_thread_id_unique` ON `ticket` (`thread_id`);--> statement-breakpoint
CREATE INDEX `ticket_guild_id_status_index` ON `ticket` (`guild_id`,`status`);--> statement-breakpoint
CREATE INDEX `ticket_guild_id_ticket_type_index` ON `ticket` (`guild_id`,`ticket_type`);--> statement-breakpoint
CREATE INDEX `ticket_guild_id_owner_id_index` ON `ticket` (`guild_id`,`owner_id`);--> statement-breakpoint
CREATE INDEX `ticket_guild_id_created_at_index` ON `ticket` (`guild_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ticket_guild_id_accepted_by_id_index` ON `ticket` (`guild_id`,`accepted_by_id`);