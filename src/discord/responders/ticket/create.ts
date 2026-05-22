import { createResponder } from "#base";
import { config } from "#config";
import { createTicket, listTicketsByOwnerId } from "#queries";
import { res } from "#functions";
import type { Snowflake } from "discord-api-types/v10";
import { ResponderType } from "@constatic/base";
import {
  ChannelType,
  MessageFlags,
  type StringSelectMenuInteraction,
  ThreadAutoArchiveDuration,
} from "discord.js";
import { z } from "zod";
import { buildTicketPanelContainer } from "#functions";
import {
  buildEditModal,
  buildCreateModal,
  buildReviewMessage,
  buildTicketOpenedMessage,
  buildThreadControlMessage,
  clearDraft,
  createNonce,
  getDraftByMember,
  getDraftByNonce,
  resolveCategoryLabel,
  sanitizeSummary,
  ticketCreateRoutes,
  ticketPanelCategorySchema,
  ticketReviewActionSchema,
  toTicketType,
  upsertDraft,
} from "./shared.js";

const createModalParamsSchema = z.object({
  nonce: z.string().min(1),
});

const reviewActionParamsSchema = z.object({
  nonce: z.string().min(1),
  action: ticketReviewActionSchema,
});

function ensureDraftOwnership(data: {
  nonce: string;
  memberId: Snowflake;
  guildId: Snowflake;
}) {
  const draft = getDraftByNonce(data.nonce);
  if (!draft) return null;
  if (draft.memberId !== data.memberId) return null;
  if (draft.guildId !== data.guildId) return null;
  return draft;
}

function ensureTicketSystemEnabled() {
  return config.ticketSystem.enabled;
}

async function refreshTicketPanelMessage(message: {
  attachments: { first(): { url: string } | undefined };
  edit(options: unknown): Promise<unknown>;
}) {
  const bannerUrl = message.attachments.first()?.url;
  if (!bannerUrl) return;

  const panelContainer = buildTicketPanelContainer({ bannerSource: bannerUrl });
  await message.edit({
    components: [panelContainer],
    flags: MessageFlags.IsComponentsV2,
  });
}

async function handleTicketCategorySelect(
  interaction: StringSelectMenuInteraction<"cached">,
) {
  if (!ensureTicketSystemEnabled()) {
    await interaction.reply(
      res.danger("The ticket system is currently disabled in configuration."),
    );
    return;
  }

  const selectedCategory = ticketPanelCategorySchema.safeParse(
    interaction.values[0],
  );

  if (!selectedCategory.success) {
    await interaction.reply(
      res.danger("Invalid category selected. Try again from the panel."),
    );
    return;
  }

  const existingDraft = getDraftByMember(interaction.user.id as Snowflake);
  if (existingDraft) {
    await interaction.reply(
      res.warning(
        "You already have an open ticket creation flow.",
        "Use the existing confirmation message or wait 7 minutes for expiration.",
      ),
    );
    return;
  }

  const ownerTickets = await listTicketsByOwnerId(
    interaction.user.id as Snowflake,
  );
  const hasActiveTicket = ownerTickets.some(
    (ticket) =>
      ticket.guildId === interaction.guildId &&
      (ticket.status === "open" || ticket.status === "accepted"),
  );

  if (hasActiveTicket) {
    await interaction.reply(
      res.warning(
        "You already have an active ticket in this server.",
        "Close the current one before opening a new ticket.",
      ),
    );
    return;
  }

  const nonce = createNonce();
  const now = Date.now();
  upsertDraft({
    nonce,
    guildId: interaction.guildId as Snowflake,
    panelChannelId: interaction.channelId as Snowflake,
    panelMessageId: interaction.message.id as Snowflake,
    memberId: interaction.user.id as Snowflake,
    category: selectedCategory.data,
    summary: "",
    createdAt: now,
    expiresAt: now + config.ticketSystem.createFlowExpiresInMs,
  });

  await refreshTicketPanelMessage(interaction.message).catch(() => null);

  await interaction.showModal(buildCreateModal(nonce, selectedCategory.data));
}

createResponder({
  customId: ticketCreateRoutes.select,
  cache: "cached",
  types: [ResponderType.StringSelect],
  async run(interaction) {
    await handleTicketCategorySelect(interaction);
  },
});

createResponder({
  customId: ticketCreateRoutes.legacySelect,
  cache: "cached",
  types: [ResponderType.StringSelect],
  async run(interaction) {
    await handleTicketCategorySelect(interaction);
  },
});

createResponder({
  customId: ticketCreateRoutes.createModal,
  cache: "cached",
  types: [ResponderType.ModalComponent],
  parse: createModalParamsSchema.parse,
  async run(interaction, params) {
    if (!ensureTicketSystemEnabled()) {
      await interaction.reply(
        res.danger("The ticket system is currently disabled in configuration."),
      );
      return;
    }

    const draft = ensureDraftOwnership({
      nonce: params.nonce,
      memberId: interaction.user.id as Snowflake,
      guildId: interaction.guildId as Snowflake,
    });

    if (!draft) {
      await interaction.reply(
        res.warning(
          "This ticket creation flow expired.",
          "Start again from the panel.",
        ),
      );
      return;
    }

    const summary = sanitizeSummary(
      interaction.fields.getTextInputValue("summary"),
    );

    if (summary.length < 10) {
      await interaction.reply(
        res.warning(
          "Please provide a longer summary (at least 10 characters).",
        ),
      );
      return;
    }

    const nextDraft = {
      ...draft,
      summary,
      expiresAt: Date.now() + config.ticketSystem.createFlowExpiresInMs,
    };
    upsertDraft(nextDraft);

    await interaction.reply({
      ...buildReviewMessage(nextDraft),
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  },
});

createResponder({
  customId: ticketCreateRoutes.reviewAction,
  cache: "cached",
  types: [ResponderType.Button],
  parse: reviewActionParamsSchema.parse,
  async run(interaction, params) {
    if (!ensureTicketSystemEnabled()) {
      await interaction.reply(
        res.danger("The ticket system is currently disabled in configuration."),
      );
      return;
    }

    const draft = ensureDraftOwnership({
      nonce: params.nonce,
      memberId: interaction.user.id as Snowflake,
      guildId: interaction.guildId as Snowflake,
    });

    if (!draft) {
      await interaction.update(
        res.warning(
          "This ticket creation flow expired.",
          "Start again from the panel.",
        ),
      );
      return;
    }

    if (params.action === "cancel") {
      clearDraft(draft.nonce);
      await interaction.update(res.warning("Ticket creation cancelled."));
      return;
    }

    if (params.action === "edit") {
      await interaction.showModal(buildEditModal(draft));
      return;
    }

    await interaction.deferUpdate();

    const panelChannel = await interaction.guild.channels
      .fetch(draft.panelChannelId as Snowflake)
      .catch(() => null);

    if (!panelChannel || panelChannel.type !== ChannelType.GuildText) {
      await interaction.editReply(
        res.danger(
          "Ticket panel channel is not available.",
          "Setup the panel in a guild text channel and try again.",
        ),
      );
      return;
    }

    const threadName =
      `ticket-${resolveCategoryLabel(draft.category).toLowerCase().replace(/\s+/g, "-")}-${interaction.user.username}`
        .replace(/[^a-z0-9-]/gi, "")
        .slice(0, 90);

    const thread = await panelChannel.threads
      .create({
        name: threadName || `ticket-${interaction.user.username}`.slice(0, 90),
        autoArchiveDuration: config.ticketSystem
          .defaultThreadAutoArchiveDuration as ThreadAutoArchiveDuration,
        type: ChannelType.PrivateThread,
        invitable: false,
        reason: `Ticket opened by ${interaction.user.tag}`,
      })
      .catch(() => null);

    if (!thread) {
      await interaction.editReply(
        res.danger(
          "Unable to create the private ticket thread.",
          "Check the bot permissions for creating private threads.",
        ),
      );
      return;
    }

    await thread.members
      .add(interaction.user.id as Snowflake)
      .catch(() => null);

    const createdTicket = await createTicket({
      guildId: interaction.guildId as Snowflake,
      threadId: thread.id as Snowflake,
      ownerId: interaction.user.id as Snowflake,
      createdById: interaction.user.id as Snowflake,
      ticketType: toTicketType(draft.category),
      summary: draft.summary,
    });

    if (!createdTicket) {
      await interaction.editReply(
        res.danger(
          "Ticket record creation failed.",
          "Try again in a few seconds.",
        ),
      );
      return;
    }

    const supportMention = config.ticketSystem.supportRoleId
      ? `<@&${config.ticketSystem.supportRoleId}>`
      : "Support Team";

    await thread.send(
      buildTicketOpenedMessage({
        ticketId: createdTicket.id,
        ownerId: draft.memberId,
        ownerTag: interaction.user.tag,
        ownerAvatarUrl: interaction.user.displayAvatarURL(),
        category: draft.category,
        summary: draft.summary,
        supportMention,
      }),
    );

    await thread.send(buildThreadControlMessage(createdTicket.id));

    clearDraft(draft.nonce);

    await interaction.editReply(
      res.success("Ticket created successfully.", `Thread: <#${thread.id}>`),
    );
  },
});

createResponder({
  customId: ticketCreateRoutes.editModal,
  cache: "cached",
  types: [ResponderType.ModalComponent],
  parse: createModalParamsSchema.parse,
  async run(interaction, params) {
    if (!ensureTicketSystemEnabled()) {
      await interaction.reply(
        res.danger("The ticket system is currently disabled in configuration."),
      );
      return;
    }

    const draft = ensureDraftOwnership({
      nonce: params.nonce,
      memberId: interaction.user.id as Snowflake,
      guildId: interaction.guildId as Snowflake,
    });

    if (!draft) {
      await interaction.reply(
        res.warning(
          "This ticket creation flow expired.",
          "Start again from the panel.",
        ),
      );
      return;
    }

    const selectedCategory = ticketPanelCategorySchema.safeParse(
      interaction.fields.getStringSelectValues("category")[0],
    );
    const summary = sanitizeSummary(
      interaction.fields.getTextInputValue("summary"),
    );

    if (!selectedCategory.success) {
      await interaction.reply(
        res.danger("Invalid category selected in modal."),
      );
      return;
    }

    if (summary.length < 10) {
      await interaction.reply(
        res.warning(
          "Please provide a longer summary (at least 10 characters).",
        ),
      );
      return;
    }

    const updatedDraft = {
      ...draft,
      category: selectedCategory.data,
      summary,
      expiresAt: Date.now() + config.ticketSystem.createFlowExpiresInMs,
    };
    upsertDraft(updatedDraft);

    await interaction.update(buildReviewMessage(updatedDraft));
  },
});
