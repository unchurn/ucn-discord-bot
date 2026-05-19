import { env } from "#env";
import { setupCreators } from "@constatic/base";

export const { createCommand, createEvent, createResponder } = setupCreators({
  commands: {
    guilds: env.GUILD_ID ? [env.GUILD_ID] : undefined,
  },
});