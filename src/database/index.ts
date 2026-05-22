import { env } from "#env";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema/index.js";

const db = drizzle({
  connection: {
    source: env.DATABASE_FILE_NAME,
  },
  schema,
});

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDir, "../../drizzle");
migrate(db, { migrationsFolder });

export { db };
