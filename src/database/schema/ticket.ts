import type { Snowflake } from "discord-api-types/v10";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const ticketStatus = [
  "open",
  "accepted",
  "closed",
  "cancelled",
] as const;
export type TicketStatus = (typeof ticketStatus)[number];

export const ticketType = [
  "question",
  "bug_report",
  "security_report",
  "billing",
  "payment_issue",
  "refund",
  "enterprise",
  "partnership",
  "other",
] as const;
export type TicketType = (typeof ticketType)[number];

export const ticketAuditAction = [
  "created",
  "accepted",
  "closed",
  "cancelled",
  "participant_added",
  "participant_removed",
  "transferred",
] as const;
export type TicketAuditAction = (typeof ticketAuditAction)[number];

export const ticket = sqliteTable(
  "ticket",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    guildId: text("guild_id").notNull().$type<Snowflake>(),
    threadId: text("thread_id").notNull().$type<Snowflake>(),

    ownerId: text("owner_id").notNull().$type<Snowflake>(),
    createdById: text("created_by_id").notNull().$type<Snowflake>(),
    acceptedById: text("accepted_by_id").$type<Snowflake>(),
    assignedToId: text("assigned_to_id").$type<Snowflake>(),
    closedById: text("closed_by_id").$type<Snowflake>(),

    status: text("status").notNull().$type<TicketStatus>().default("open"),
    ticketType: text("ticket_type").notNull().$type<TicketType>(),

    summary: text("summary").notNull(),
    closeReason: text("close_reason"),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    acceptedAt: integer("accepted_at", { mode: "timestamp" }),
    closedAt: integer("closed_at", { mode: "timestamp" }),

    firstResponseSeconds: integer("first_response_seconds"),
    resolutionSeconds: integer("resolution_seconds"),
  },
  (table) => [
    uniqueIndex("ticket_thread_id_unique").on(table.threadId),
    index("ticket_guild_id_status_index").on(table.guildId, table.status),
    index("ticket_guild_id_owner_id_index").on(table.guildId, table.ownerId),
    index("ticket_guild_id_assigned_to_id_index").on(
      table.guildId,
      table.assignedToId,
    ),
  ],
);

export const ticketParticipant = sqliteTable(
  "ticket_participant",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    ticketId: integer("ticket_id")
      .notNull()
      .references(() => ticket.id, { onDelete: "cascade" }),

    userId: text("user_id").notNull().$type<Snowflake>(),
    addedById: text("added_by_id").notNull().$type<Snowflake>(),
    removedById: text("removed_by_id").$type<Snowflake>(),

    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),

    addedAt: integer("added_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    removedAt: integer("removed_at", { mode: "timestamp" }),
  },
  (table) => [
    uniqueIndex("ticket_participant_ticket_id_user_id_unique").on(
      table.ticketId,
      table.userId,
    ),
    index("ticket_participant_ticket_id_index").on(table.ticketId),
    index("ticket_participant_user_id_index").on(table.userId),
  ],
);

export const ticketAuditLog = sqliteTable(
  "ticket_audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    ticketId: integer("ticket_id")
      .notNull()
      .references(() => ticket.id, { onDelete: "cascade" }),

    action: text("action").notNull().$type<TicketAuditAction>(),
    actorId: text("actor_id").notNull().$type<Snowflake>(),
    targetUserId: text("target_user_id").$type<Snowflake>(),

    reason: text("reason"),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("ticket_audit_log_ticket_id_index").on(table.ticketId),
    index("ticket_audit_log_created_at_index").on(table.createdAt),
  ],
);
