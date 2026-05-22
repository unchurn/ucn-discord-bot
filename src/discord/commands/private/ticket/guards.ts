import { config } from "#config";
import { res } from "#functions";
import type { ChatInputCommandInteraction } from "discord.js";

export async function ensureTicketSystemEnabled(
  interaction: ChatInputCommandInteraction<"cached">,
) {
  if (config.ticketSystem.enabled) return true;

  await interaction.editReply(
    res.danger(
      "The ticket system is currently disabled in configuration.",
      "Enable `config.ticketSystem.enabled` to use ticket commands.",
    ),
  );
  return false;
}
