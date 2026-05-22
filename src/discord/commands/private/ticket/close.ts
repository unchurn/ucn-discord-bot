import type { Snowflake } from "discord-api-types/v10";
import { ApplicationCommandOptionType } from "discord.js";
import { closeTicket, findTicketByThreadId } from "#queries";
import { ticketCommand } from "./command.js";
import { ticketStatusLabel } from "#functions";
import { ensureTicketSystemEnabled } from "./guards.js";

ticketCommand.subcommand({
  name: "close",
  description: "Close the current ticket thread.",
  options: [
    {
      name: "reason",
      description: "Reason for closing this ticket.",
      type: ApplicationCommandOptionType.String,
      required: false,
      maxLength: 500,
    },
  ],
  async run(interaction) {
    if (!(await ensureTicketSystemEnabled(interaction))) return;

    const currentChannel = interaction.channel;
    const reason = interaction.options.getString("reason");

    if (!currentChannel?.isThread()) {
      await interaction.editReply(
        "This command must be used inside a ticket thread.",
      );
      return;
    }

    const existingTicket = await findTicketByThreadId(
      currentChannel.id as Snowflake,
    );

    if (!existingTicket) {
      await interaction.editReply(
        "No ticket record was found for this thread.",
      );
      return;
    }

    if (
      existingTicket.status === "closed" ||
      existingTicket.status === "cancelled"
    ) {
      await interaction.editReply(
        `This ticket is already ${ticketStatusLabel(existingTicket.status).toLowerCase()}.`,
      );
      return;
    }

    const updatedTicket = await closeTicket({
      threadId: currentChannel.id as Snowflake,
      closedById: interaction.user.id as Snowflake,
      closeReason: reason ?? null,
    });

    if (!updatedTicket) {
      await interaction.editReply("Ticket close failed. Try again.");
      return;
    }

    try {
      await currentChannel.setArchived(
        true,
        `Ticket closed by ${interaction.user.tag}`,
      );
    } catch {
      // Archiving can fail due to missing permissions; DB close should still succeed.
    }

    await interaction.editReply(
      [
        `Ticket \`#${updatedTicket.id}\` closed successfully.`,
        `Status: ${ticketStatusLabel(updatedTicket.status)}`,
        `Closed by: <@${interaction.user.id}>`,
        `Reason: ${reason ?? "n/a"}`,
      ].join("\n"),
    );
  },
});
