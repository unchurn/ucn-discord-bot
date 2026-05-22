import { ApplicationCommandOptionType } from "discord.js";
import { config } from "#config";
import type { TicketType } from "#schemas";
import { isTicketActive, memberMention, secondsLabel, ticketStatusLabel } from "#functions";
import { ticketCommand } from "./command.js";
import { ensureTicketSystemEnabled } from "./guards.js";

const ticketPriorityMap: Partial<Record<TicketType, number>> =
  config.ticketSystem.ticketTypePriority;

function getTicketTypeLabel(ticketType: TicketType) {
  const category = config.ticketSystem.categories.find(
    (item) => item.value === ticketType,
  );
  return category?.label ?? ticketType;
}

function getTicketTypePriority(ticketType: TicketType) {
  return ticketPriorityMap[ticketType] ?? 10;
}

ticketCommand.subcommand({
  name: "queue",
  description: "Show the current ticket queue by priority and waiting time.",
  options: [
    {
      name: "limit",
      description: "Maximum amount of tickets to list.",
      type: ApplicationCommandOptionType.Integer,
      required: false,
      minValue: 1,
      maxValue: 50,
    },
    {
      name: "include_closed",
      description: "Include closed and cancelled tickets in the list.",
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
  ],
  async run(interaction, context) {
    if (!(await ensureTicketSystemEnabled(interaction))) return;
    if (context.disabled) return;

    const limit =
      interaction.options.getInteger("limit") ??
      config.ticketSystem.queueDefaults.limit;
    const includeClosed =
      interaction.options.getBoolean("include_closed") ??
      config.ticketSystem.queueDefaults.includeClosed;

    const now = Date.now();
    const sourceTickets = includeClosed
      ? context.tickets
      : context.tickets.filter((item) => isTicketActive(item.status));

    const queuedTickets = [...sourceTickets].sort((a, b) => {
      const priorityDiff =
        getTicketTypePriority(b.ticketType) - getTicketTypePriority(a.ticketType);
      if (priorityDiff !== 0) return priorityDiff;

      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const result = queuedTickets.slice(0, limit);

    if (!result.length) {
      await interaction.editReply("The ticket queue is currently empty.");
      return;
    }

    const lines = result.map((ticket, index) => {
      const waitSeconds = Math.max(
        0,
        Math.floor((now - ticket.createdAt.getTime()) / 1000),
      );
      const priority = getTicketTypePriority(ticket.ticketType);

      return [
        `${index + 1}. \`#${ticket.id}\` P${priority} ${getTicketTypeLabel(ticket.ticketType)}`,
        `status: ${ticketStatusLabel(ticket.status)}`,
        `waiting: ${secondsLabel(waitSeconds)}`,
        `owner: ${memberMention(ticket.ownerId)}`,
        `assigned: ${memberMention(ticket.assignedToId)}`,
        `thread: <#${ticket.threadId}>`,
      ].join(" | ");
    });

    await interaction.editReply(
      [
        "## Ticket Queue",
        `Total listed: ${result.length}/${sourceTickets.length}`,
        `Priority rule: higher P value = higher priority.`,
        ...lines,
      ].join("\n"),
    );
  },
});
