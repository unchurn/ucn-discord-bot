import { createResponder } from "#base";
import { config } from "#config";
import { findTicketById } from "#queries";
import { res } from "#functions";
import type { Snowflake } from "discord-api-types/v10";
import { ResponderType } from "@constatic/base";
import { z } from "zod";
import { canManageTicket, ticketDeleteRoutes } from "./shared.js";

const deleteParamsSchema = z.object({
  ticketId: z.coerce.number().int().min(1),
});

createResponder({
  customId: ticketDeleteRoutes.execute,
  cache: "cached",
  types: [ResponderType.Button],
  parse: deleteParamsSchema.parse,
  async run(interaction, params) {
    if (!config.ticketSystem.enabled) {
      await interaction.reply(
        res.danger("The ticket system is currently disabled in configuration."),
      );
      return;
    }

    if (!canManageTicket(interaction.member)) {
      await interaction.reply(
        res.danger("You do not have permission to delete tickets."),
      );
      return;
    }

    const ticket = await findTicketById(params.ticketId);
    if (!ticket || ticket.guildId !== (interaction.guildId as Snowflake)) {
      await interaction.reply(res.danger("Ticket not found."));
      return;
    }

    if (ticket.status !== "closed" && ticket.status !== "cancelled") {
      await interaction.reply(
        res.warning("Close the ticket before deleting the thread."),
      );
      return;
    }

    if (!interaction.channel?.isThread()) {
      await interaction.reply(
        res.danger("This action must be used inside the ticket thread."),
      );
      return;
    }

    await interaction.deferUpdate();

    if (interaction.channel.archived) {
      await interaction.channel.setArchived(false).catch(() => null);
    }

    const deleteDelaySeconds = 10;
    await interaction.channel
      .send(
        [
          `Ticket #${ticket.id} was closed by <@${interaction.user.id}>.`,
          `This thread will be deleted in ${deleteDelaySeconds} seconds.`,
        ].join("\n"),
      )
      .catch(() => null);

    await interaction
      .followUp(
        res.warning(
          `Ticket thread scheduled for deletion in ${deleteDelaySeconds} seconds.`,
        ),
      )
      .catch(() => null);

    await new Promise((resolve) =>
      setTimeout(resolve, deleteDelaySeconds * 1000),
    );

    await interaction.channel
      .delete(`Ticket deleted by ${interaction.user.tag}`)
      .catch(async () => {
        await interaction
          .followUp(
            res.danger(
              "Failed to delete the ticket thread.",
              "Check bot permissions and try again.",
            ),
          )
          .catch(() => null);
      });
  },
});
