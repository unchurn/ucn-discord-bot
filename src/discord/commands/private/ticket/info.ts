import type { Snowflake } from "discord-api-types/v10";
import { ApplicationCommandOptionType, ChannelType } from "discord.js";
import {
  findTicketById,
  findTicketByThreadId,
  listActiveTicketParticipants,
  listTicketAuditLogs,
} from "#queries";
import { ticketCommand } from "./command.js";
import {
  discordTimestamp,
  memberMention,
  secondsLabel,
  ticketStatusLabel,
} from "#functions";
import { ensureTicketSystemEnabled } from "./guards.js";

ticketCommand.subcommand({
  name: "info",
  description: "Show ticket details by ID or thread.",
  options: [
    {
      name: "ticket_id",
      description: "Internal ticket ID from the database.",
      type: ApplicationCommandOptionType.Integer,
      required: false,
      minValue: 1,
    },
    {
      name: "thread",
      description: "Ticket thread channel.",
      type: ApplicationCommandOptionType.Channel,
      required: false,
      channelTypes: [
        ChannelType.PublicThread,
        ChannelType.PrivateThread,
        ChannelType.AnnouncementThread,
      ],
    },
  ],
  async run(interaction) {
    if (!(await ensureTicketSystemEnabled(interaction))) return;

    const ticketId = interaction.options.getInteger("ticket_id");
    const thread = interaction.options.getChannel("thread");

    let targetTicket: Awaited<ReturnType<typeof findTicketById>> | null = null;

    if (ticketId) {
      targetTicket = await findTicketById(ticketId);
    } else {
      const threadId =
        thread?.id ??
        (interaction.channel?.isThread() ? interaction.channel.id : null);
      if (!threadId) {
        await interaction.editReply(
          "Provide `ticket_id`, `thread`, or use this command inside a ticket thread.",
        );
        return;
      }
      targetTicket = await findTicketByThreadId(threadId as Snowflake);
    }

    if (!targetTicket) {
      await interaction.editReply("Ticket not found.");
      return;
    }

    const [participants, auditLogs] = await Promise.all([
      listActiveTicketParticipants(targetTicket.id),
      listTicketAuditLogs(targetTicket.id),
    ]);

    const lastEvents = auditLogs.slice(0, 5);
    const eventLines =
      lastEvents.length > 0
        ? lastEvents.map(
            (event) =>
              `- ${event.action} by <@${event.actorId}> at ${discordTimestamp(event.createdAt)}`,
          )
        : ["- none"];

    const participantLines =
      participants.length > 0
        ? participants
            .map((participant) => `<@${participant.userId}>`)
            .join(", ")
        : "none";

    await interaction.editReply(
      [
        `## Ticket #${targetTicket.id}`,
        `Status: ${ticketStatusLabel(targetTicket.status)}`,
        `Type: ${targetTicket.ticketType}`,
        `Owner: ${memberMention(targetTicket.ownerId)}`,
        `Created by: ${memberMention(targetTicket.createdById)}`,
        `Assigned to: ${memberMention(targetTicket.assignedToId)}`,
        `Accepted by: ${memberMention(targetTicket.acceptedById)}`,
        `Closed by: ${memberMention(targetTicket.closedById)}`,
        `Thread: <#${targetTicket.threadId}>`,
        `Created at: ${discordTimestamp(targetTicket.createdAt)}`,
        `Accepted at: ${discordTimestamp(targetTicket.acceptedAt)}`,
        `Closed at: ${discordTimestamp(targetTicket.closedAt)}`,
        `First response: ${secondsLabel(targetTicket.firstResponseSeconds)}`,
        `Resolution: ${secondsLabel(targetTicket.resolutionSeconds)}`,
        `Summary: ${targetTicket.summary}`,
        `Close reason: ${targetTicket.closeReason ?? "n/a"}`,
        `Active participants: ${participantLines}`,
        "Recent events:",
        ...eventLines,
      ].join("\n"),
    );
  },
});
