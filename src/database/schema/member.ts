import type { Snowflake } from "discord-api-types/v10";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const member = sqliteTable(
  "member",
  {
    id: text("id").primaryKey(),

    guildId: text("guild_id").notNull().$type<Snowflake>(),
    userId: text("user_id").notNull().$type<Snowflake>(),

    username: text("username"),
    displayName: text("display_name"),

    joinedAt: integer("joined_at", { mode: "timestamp" }),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),

    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("member_guild_id_user_id_unique").on(
      table.guildId,
      table.userId,
    ),

    index("member_user_id_index").on(table.userId),
    index("member_guild_id_index").on(table.guildId),
  ],
);
