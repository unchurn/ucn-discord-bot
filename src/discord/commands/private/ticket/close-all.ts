import type { Snowflake } from "discord-api-types/v10";
import { ApplicationCommandOptionType } from "discord.js";
import { closeTicket } from "#queries";
import { ticketCommand } from "./command.js";
import { isTicketActive } from "#functions";
import { ensureTicketSystemEnabled } from "./guards.js";

ticketCommand.subcommand({
  name: "close-all",
  description: "Close all active tickets in this server.",
  options: [
    {
      name: "reason",
      description: "Reason applied to all closed tickets.",
      type: ApplicationCommandOptionType.String,
      required: false,
      maxLength: 500,
    },
    {
      name: "archive_threads",
      description: "Also archive the Discord threads.",
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
  ],
  async run(interaction, context) {
    if (!(await ensureTicketSystemEnabled(interaction))) return;
    if (context.disabled) return;

    const reason = interaction.options.getString("reason");
    const archiveThreads =
      interaction.options.getBoolean("archive_threads") ?? true;

    const activeTickets = context.tickets.filter((ticket) =>
      isTicketActive(ticket.status),
    );

    if (!activeTickets.length) {
      await interaction.editReply("There are no active tickets to close.");
      return;
    }

    let closedCount = 0;
    let archivedCount = 0;

    for (const activeTicket of activeTickets) {
      const closedTicket = await closeTicket({
        threadId: activeTicket.threadId as Snowflake,
        closedById: interaction.user.id as Snowflake,
        closeReason: reason ?? "Bulk ticket close command",
      });

      if (!closedTicket) continue;
      closedCount += 1;

      if (!archiveThreads || !interaction.guild) continue;

      try {
        const channel = await interaction.guild.channels.fetch(
          activeTicket.threadId as Snowflake,
        );
        if (channel?.isThread()) {
          await channel.setArchived(
            true,
            `Bulk ticket close by ${interaction.user.tag}`,
          );
          archivedCount += 1;
        }
      } catch {
        // Some threads may no longer exist or be inaccessible.
      }
    }

    await interaction.editReply(
      [
        `Closed tickets: ${closedCount}/${activeTickets.length}`,
        `Archived threads: ${archiveThreads ? archivedCount : 0}`,
        `Reason: ${reason ?? "n/a"}`,
      ].join("\n"),
    );
  },
});
