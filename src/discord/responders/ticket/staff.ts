import { createResponder } from "#base";
import { config } from "#config";
import {
  acceptTicket,
  addTicketParticipant,
  closeTicket,
  findTicketById,
  removeTicketParticipant,
  transferTicket,
} from "#queries";
import { memberMention, res } from "#functions";
import type { Snowflake } from "discord-api-types/v10";
import { ResponderType } from "@constatic/base";
import { createLabel, createModal, createTextInput } from "@magicyan/discord";
import { MessageFlags, TextInputStyle } from "discord.js";
import { z } from "zod";
import {
  buildStaffManageActionMenu,
  buildStaffManageUserSelect,
  buildThreadControlMessageForAccepted,
  buildThreadControlMessageForClosed,
  canManageTicket,
  isSupervisor,
  sanitizeSummary,
  ticketManageActionSchema,
  ticketStaffRoutes,
} from "./shared.js";

const ticketIdParamsSchema = z.object({
  ticketId: z.coerce.number().int().min(1),
});

const ticketManageParamsSchema = z.object({
  ticketId: z.coerce.number().int().min(1),
  action: ticketManageActionSchema,
});

async function resolveTicketData(guildId: Snowflake, ticketId: number) {
  const ticket = await findTicketById(ticketId);
  if (!ticket || ticket.guildId !== guildId) return null;
  return ticket;
}

function ensureCanManage(interaction: {
  member: {
    permissions: { has(permission: bigint): boolean };
    roles?: { cache: Map<string, unknown> };
  };
}) {
  return canManageTicket(interaction.member);
}

function canManageAssignment(data: {
  assignedToId: string | null;
  actorId: string;
  isSupervisor: boolean;
}) {
  if (data.isSupervisor) return true;
  return data.assignedToId === data.actorId;
}

createResponder({
  customId: ticketStaffRoutes.assume,
  cache: "cached",
  types: [ResponderType.Button],
  parse: ticketIdParamsSchema.parse,
  async run(interaction, params) {
    if (!config.ticketSystem.enabled) {
      await interaction.reply(
        res.danger("The ticket system is currently disabled in configuration."),
      );
      return;
    }

    if (!ensureCanManage(interaction)) {
      await interaction.reply(
        res.danger("You do not have permission to manage tickets."),
      );
      return;
    }

    const ticket = await resolveTicketData(
      interaction.guildId as Snowflake,
      params.ticketId,
    );
    if (!ticket) {
      await interaction.reply(res.danger("Ticket not found."));
      return;
    }

    if (ticket.status === "closed" || ticket.status === "cancelled") {
      await interaction.reply(res.warning("This ticket is already closed."));
      return;
    }

    if (ticket.status === "accepted" && ticket.assignedToId) {
      await interaction.reply(
        res.warning(
          `This ticket is already assigned to ${memberMention(ticket.assignedToId)}.`,
        ),
      );
      return;
    }

    const updatedTicket = await acceptTicket({
      threadId: ticket.threadId as Snowflake,
      acceptedById: interaction.user.id as Snowflake,
    });

    if (!updatedTicket) {
      await interaction.reply(
        res.danger("Unable to assume this ticket right now."),
      );
      return;
    }

    if (interaction.channel?.isThread()) {
      await interaction.channel.members
        .add(interaction.user.id as Snowflake)
        .catch(() => null);
    }

    await interaction.update(buildThreadControlMessageForAccepted(ticket.id));
    await interaction.followUp(
      res.success(`Ticket #${ticket.id} is now assigned to you.`),
    );
  },
});

createResponder({
  customId: ticketStaffRoutes.closeModalOpen,
  cache: "cached",
  types: [ResponderType.Button],
  parse: ticketIdParamsSchema.parse,
  async run(interaction, params) {
    if (!config.ticketSystem.enabled) {
      await interaction.reply(
        res.danger("The ticket system is currently disabled in configuration."),
      );
      return;
    }

    if (!ensureCanManage(interaction)) {
      await interaction.reply(
        res.danger("You do not have permission to close tickets."),
      );
      return;
    }

    const ticket = await resolveTicketData(
      interaction.guildId as Snowflake,
      params.ticketId,
    );
    if (!ticket) {
      await interaction.reply(res.danger("Ticket not found."));
      return;
    }

    const supervisor = isSupervisor(interaction.member);
    if (
      !canManageAssignment({
        assignedToId: ticket.assignedToId,
        actorId: interaction.user.id,
        isSupervisor: supervisor,
      })
    ) {
      await interaction.reply(
        res.warning(
          "Only the assigned staff member or a supervisor can close this ticket.",
        ),
      );
      return;
    }

    await interaction.showModal(
      createModal(
        `/ticket/staff/${ticket.id}/close/submit`,
        "Close Ticket",
        createLabel(
          "Close reason",
          "Optional, but recommended for better audit history.",
          createTextInput({
            customId: "reason",
            style: TextInputStyle.Paragraph,
            required: false,
            maxLength: 500,
            placeholder: "Describe why this ticket is being closed",
          }),
        ),
      ),
    );
  },
});

createResponder({
  customId: ticketStaffRoutes.closeModalSubmit,
  cache: "cached",
  types: [ResponderType.ModalComponent],
  parse: ticketIdParamsSchema.parse,
  async run(interaction, params) {
    if (!config.ticketSystem.enabled) {
      await interaction.reply(
        res.danger("The ticket system is currently disabled in configuration."),
      );
      return;
    }

    if (!ensureCanManage(interaction)) {
      await interaction.reply(
        res.danger("You do not have permission to close tickets."),
      );
      return;
    }

    const ticket = await resolveTicketData(
      interaction.guildId as Snowflake,
      params.ticketId,
    );
    if (!ticket) {
      await interaction.reply(res.danger("Ticket not found."));
      return;
    }

    const supervisor = isSupervisor(interaction.member);
    if (
      !canManageAssignment({
        assignedToId: ticket.assignedToId,
        actorId: interaction.user.id,
        isSupervisor: supervisor,
      })
    ) {
      await interaction.reply(
        res.warning(
          "Only the assigned staff member or a supervisor can close this ticket.",
        ),
      );
      return;
    }

    const closeReason = sanitizeSummary(
      interaction.fields.getTextInputValue("reason") ?? "",
    );

    const closedTicket = await closeTicket({
      threadId: ticket.threadId as Snowflake,
      closedById: interaction.user.id as Snowflake,
      closeReason: closeReason || null,
    });

    if (!closedTicket) {
      await interaction.reply(
        res.danger("Unable to close this ticket right now."),
      );
      return;
    }

    await interaction.update(buildThreadControlMessageForClosed(ticket.id));
    await interaction.followUp(
      res.success(
        `Ticket #${ticket.id} closed successfully.`,
        `Reason: ${closeReason || "n/a"}`,
        "Use `Delete Ticket` to permanently remove the thread.",
      ),
    );
  },
});

createResponder({
  customId: ticketStaffRoutes.options,
  cache: "cached",
  types: [ResponderType.Button],
  parse: ticketIdParamsSchema.parse,
  async run(interaction, params) {
    if (!config.ticketSystem.enabled) {
      await interaction.reply(
        res.danger("The ticket system is currently disabled in configuration."),
      );
      return;
    }

    if (!ensureCanManage(interaction)) {
      await interaction.reply(
        res.danger("You do not have permission to manage tickets."),
      );
      return;
    }

    const ticket = await resolveTicketData(
      interaction.guildId as Snowflake,
      params.ticketId,
    );
    if (!ticket) {
      await interaction.reply(res.danger("Ticket not found."));
      return;
    }

    if (ticket.status !== "accepted" || !ticket.assignedToId) {
      await interaction.reply(
        res.warning(
          "A staff member must assume this ticket before using staff options.",
        ),
      );
      return;
    }

    await interaction.reply({
      ...buildStaffManageActionMenu(ticket.id),
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  },
});

createResponder({
  customId: ticketStaffRoutes.manageAction,
  cache: "cached",
  types: [ResponderType.Button],
  parse: ticketManageParamsSchema.parse,
  async run(interaction, params) {
    if (!config.ticketSystem.enabled) {
      await interaction.reply(
        res.danger("The ticket system is currently disabled in configuration."),
      );
      return;
    }

    if (!ensureCanManage(interaction)) {
      await interaction.reply(
        res.danger("You do not have permission to manage tickets."),
      );
      return;
    }

    const ticket = await resolveTicketData(
      interaction.guildId as Snowflake,
      params.ticketId,
    );
    if (!ticket) {
      await interaction.reply(res.danger("Ticket not found."));
      return;
    }

    if (ticket.status !== "accepted" || !ticket.assignedToId) {
      await interaction.reply(
        res.warning(
          "A staff member must assume this ticket before using staff options.",
        ),
      );
      return;
    }

    const supervisor = isSupervisor(interaction.member);
    if (
      !canManageAssignment({
        assignedToId: ticket.assignedToId,
        actorId: interaction.user.id,
        isSupervisor: supervisor,
      }) &&
      params.action !== "add_member" &&
      params.action !== "remove_member"
    ) {
      await interaction.reply(
        res.warning(
          "Only the assigned staff member or a supervisor can use this action.",
        ),
      );
      return;
    }

    await interaction.update(
      buildStaffManageUserSelect(ticket.id, params.action),
    );
  },
});

createResponder({
  customId: ticketStaffRoutes.manageSelect,
  cache: "cached",
  types: [ResponderType.UserSelect],
  parse: ticketManageParamsSchema.parse,
  async run(interaction, params) {
    if (!config.ticketSystem.enabled) {
      await interaction.reply(
        res.danger("The ticket system is currently disabled in configuration."),
      );
      return;
    }

    if (!ensureCanManage(interaction)) {
      await interaction.reply(
        res.danger("You do not have permission to manage tickets."),
      );
      return;
    }

    const ticket = await resolveTicketData(
      interaction.guildId as Snowflake,
      params.ticketId,
    );
    if (!ticket) {
      await interaction.reply(res.danger("Ticket not found."));
      return;
    }

    if (ticket.status !== "accepted" || !ticket.assignedToId) {
      await interaction.reply(
        res.warning(
          "A staff member must assume this ticket before using staff options.",
        ),
      );
      return;
    }

    const selectedMembers = interaction.values as Snowflake[];
    const supervisor = isSupervisor(interaction.member);

    switch (params.action) {
      case "transfer": {
        if (
          !canManageAssignment({
            assignedToId: ticket.assignedToId,
            actorId: interaction.user.id,
            isSupervisor: supervisor,
          })
        ) {
          await interaction.reply(
            res.warning(
              "Only the assigned staff member or a supervisor can transfer this ticket.",
            ),
          );
          return;
        }

        const [targetStaffId] = selectedMembers;
        if (!targetStaffId) {
          await interaction.reply(
            res.warning("Select one staff member to transfer."),
          );
          return;
        }

        const transferredTicket = await transferTicket({
          threadId: ticket.threadId as Snowflake,
          toUserId: targetStaffId,
          transferredById: interaction.user.id as Snowflake,
          reason: "Transferred from ticket controls",
        });

        if (!transferredTicket) {
          await interaction.reply(
            res.danger("Unable to transfer this ticket."),
          );
          return;
        }

        if (interaction.channel?.isThread()) {
          await interaction.channel.members
            .add(targetStaffId)
            .catch(() => null);
        }

        await interaction.update(
          res.success(`Ticket transferred to ${memberMention(targetStaffId)}.`),
        );
        return;
      }
      case "add_staff":
      case "add_member": {
        for (const memberId of selectedMembers) {
          await addTicketParticipant({
            ticketId: ticket.id,
            userId: memberId,
            addedById: interaction.user.id as Snowflake,
          }).catch(() => null);

          if (interaction.channel?.isThread()) {
            await interaction.channel.members.add(memberId).catch(() => null);
          }
        }

        await interaction.update(
          res.success(
            `${selectedMembers.length} member(s) added successfully.`,
          ),
        );
        return;
      }
      case "remove_staff":
      case "remove_member": {
        for (const memberId of selectedMembers) {
          if (memberId === ticket.ownerId) continue;

          await removeTicketParticipant({
            ticketId: ticket.id,
            userId: memberId,
            removedById: interaction.user.id as Snowflake,
            reason: "Removed from ticket controls",
          }).catch(() => null);

          if (interaction.channel?.isThread()) {
            await interaction.channel.members
              .remove(memberId)
              .catch(() => null);
          }
        }

        await interaction.update(
          res.success(
            `${selectedMembers.length} member(s) removed successfully.`,
          ),
        );
        return;
      }
      default: {
        await interaction.reply(res.danger("Unsupported staff action."));
      }
    }
  },
});
