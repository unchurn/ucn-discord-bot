import { validateEnv } from "@constatic/base";
import { z } from "zod";
import "./constants.js";

export const env = await validateEnv(
  z.looseObject({
    APP_ENV: z.enum(["development", "production"]),
    BOT_TOKEN: z
      .string("Discord Bot Token is required")
      .min(1, "Discord Bot Token cannot be empty"),
    WEBHOOK_LOGS_URL: z.url().optional(),
    GUILD_ID: z.string().optional(),
    DATABASE_FILE_NAME: z
      .string("SQLite database file name is required")
      .min(1, "SQLite database file name cannot be empty"),
  }),
);
