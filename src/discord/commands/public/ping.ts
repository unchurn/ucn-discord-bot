import { createCommand } from "#base";
import { createRow } from "@magicyan/discord";
import { ApplicationCommandType, ButtonBuilder, ButtonStyle } from "discord.js";

createCommand({
  name: "ping",
  description: "Replies with the bot latency.",
  type: ApplicationCommandType.ChatInput,
  async run(interaction) {
    const ws = interaction.client.ws.ping;

    const row = createRow(
      new ButtonBuilder({
        customId: `/application/ws/ping`,
        style: ButtonStyle.Secondary,
        label: `Ping WS: ${ws}ms`,
        emoji: "🏓",
        disabled: true,
      }),
    );

    await interaction.reply({
      flags: ["Ephemeral"],
      content: `## Pong!`,
      components: [row],
    });
  },
});
