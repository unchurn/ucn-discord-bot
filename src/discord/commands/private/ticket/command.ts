import type { Snowflake } from "discord-api-types/v10";
import { createCommand } from "#base";
import { config } from "#config";
import { listTicketsByGuildId } from "#queries";

export const ticketCommand = createCommand({
  name: "ticket",
  description: "Manage the server ticket system.",
  dmPermission: false,
  defaultMemberPermissions: ["ManageThreads", "Administrator"],
  async run(interaction) {
    const guildId = interaction.guildId as Snowflake;
    await interaction.deferReply({ flags: ["Ephemeral"] });

    if (!config.ticketSystem.enabled) {
      return {
        guildId,
        disabled: true,
        tickets: [] as Awaited<ReturnType<typeof listTicketsByGuildId>>,
      };
    }

    const tickets = await listTicketsByGuildId(guildId);
    return { guildId, disabled: false, tickets };
  },
});
