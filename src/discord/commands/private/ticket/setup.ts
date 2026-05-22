import {
  ApplicationCommandOptionType,
  AttachmentBuilder,
  ChannelType,
  MessageFlags,
} from "discord.js";
import { config } from "#config";
import { res } from "#functions";
import { buildTicketPanelContainer } from "#functions";
import { ticketCommand } from "./command.js";
import { ensureTicketSystemEnabled } from "./guards.js";

ticketCommand.subcommand({
  name: "setup",
  description: "Send the ticket panel message to a channel.",
  options: [
    {
      name: "channel",
      description: "Channel where the ticket panel will be sent.",
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildText],
      required: true,
    },
  ],
  async run(interaction) {
    if (!(await ensureTicketSystemEnabled(interaction))) return;

    const channel = interaction.options.getChannel("channel", true);
    if (!channel.isTextBased()) {
      await interaction.editReply(
        res.danger("The selected channel does not support messages."),
      );
      return;
    }

    const panelContainer = buildTicketPanelContainer({
      bannerSource: `attachment://${config.ticketSystem.panelBannerAttachmentName}`,
    });

    const sentMessage = await channel.send({
      files: [
        new AttachmentBuilder(config.ticketSystem.panelBannerPath, {
          name: config.ticketSystem.panelBannerAttachmentName,
        }),
      ],
      components: [panelContainer],
      flags: MessageFlags.IsComponentsV2,
    });

    await interaction.editReply(
      res.success(
        `Ticket panel sent to ${channel}.`,
        `Message ID: \`${sentMessage.id}\``,
      ),
    );
  },
});
