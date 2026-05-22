import {
  createContainer,
  createMediaGallery,
  createRow,
  Separator,
} from "@magicyan/discord";
import {
  ApplicationCommandOptionType,
  AttachmentBuilder,
  ChannelType,
  MessageFlags,
  StringSelectMenuBuilder,
} from "discord.js";
import { config } from "#config";
import { res } from "#functions";
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
      channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
      required: true,
    },
  ],
  async run(interaction) {
    if (!(await ensureTicketSystemEnabled(interaction))) return;

    const channel = interaction.options.getChannel("channel", true);
    const title = config.ticketSystem.panelTitle;
    const description = config.ticketSystem.panelDescription.replace(
      /\\n/g,
      "\n",
    );

    if (!channel.isTextBased()) {
      await interaction.editReply(
        res.danger("The selected channel does not support messages."),
      );
      return;
    }

    const scheduleLines = [
      `-# Support hours (${config.ticketSystem.supportHours.timeZoneLabel}): ${config.ticketSystem.supportHours.daysLabel}, ${config.ticketSystem.supportHours.windows.join(" and ")}.`,
      `-# ${config.ticketSystem.supportHours.note}`,
    ];

    const selectMenu = new StringSelectMenuBuilder({
      customId: "ticket/create",
      placeholder: "Select a ticket category",
      minValues: 1,
      maxValues: 1,
      options: config.ticketSystem.categories,
    });

    const panelContainer = createContainer(
      constants.colors.default,
      createMediaGallery(
        `attachment://${config.ticketSystem.panelBannerAttachmentName}`,
      ),
      Separator.Hidden,
      `## ${title}`,
      description,
      Separator.Default,
      createRow(selectMenu),
      Separator.Default,
      ...scheduleLines,
      config.ticketSystem.panelFooter,
    );

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
