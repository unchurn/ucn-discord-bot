import { env } from "#env";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema/index.js";

const db = drizzle({
  connection: {
    source: env.DATABASE_FILE_NAME,
  },
  schema,
});

export { db };
