CREATE TABLE `ticket_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticket_id` integer NOT NULL,
	`action` text NOT NULL,
	`actor_id` text NOT NULL,
	`target_user_id` text,
	`reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `ticket`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ticket_audit_log_ticket_id_index` ON `ticket_audit_log` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `ticket_audit_log_created_at_index` ON `ticket_audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `ticket_participant` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticket_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`added_by_id` text NOT NULL,
	`removed_by_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`added_at` integer NOT NULL,
	`removed_at` integer,
	FOREIGN KEY (`ticket_id`) REFERENCES `ticket`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ticket_participant_ticket_id_user_id_unique` ON `ticket_participant` (`ticket_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `ticket_participant_ticket_id_index` ON `ticket_participant` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `ticket_participant_user_id_index` ON `ticket_participant` (`user_id`);--> statement-breakpoint
DROP INDEX `ticket_guild_id_ticket_type_index`;--> statement-breakpoint
DROP INDEX `ticket_guild_id_created_at_index`;--> statement-breakpoint
DROP INDEX `ticket_guild_id_accepted_by_id_index`;--> statement-breakpoint
ALTER TABLE `ticket` ADD `assigned_to_id` text;--> statement-breakpoint
CREATE INDEX `ticket_guild_id_assigned_to_id_index` ON `ticket` (`guild_id`,`assigned_to_id`);