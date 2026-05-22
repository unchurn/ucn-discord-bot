import {
  createContainer,
  createLabel,
  createModal,
  createRow,
  createTextInput,
  Separator,
} from "@magicyan/discord";
import type { Snowflake } from "discord-api-types/v10";
import { config } from "#config";
import { Store } from "#functions";
import type { TicketType } from "#schemas";
import {
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} from "discord.js";
import { z } from "zod";
import {
  TICKET_PANEL_LEGACY_SELECT_CUSTOM_ID,
  TICKET_PANEL_SELECT_CUSTOM_ID,
} from "#functions";

export const ticketCreateRoutes = {
  select: TICKET_PANEL_SELECT_CUSTOM_ID,
  legacySelect: TICKET_PANEL_LEGACY_SELECT_CUSTOM_ID,
  createModal: "/ticket/create/modal/:nonce",
  reviewAction: "/ticket/create/review/:nonce/:action",
  editModal: "/ticket/create/edit/:nonce",
} as const;

export const ticketStaffRoutes = {
  assume: "/ticket/staff/:ticketId/assume",
  closeModalOpen: "/ticket/staff/:ticketId/close/open",
  closeModalSubmit: "/ticket/staff/:ticketId/close/submit",
  options: "/ticket/staff/:ticketId/options",
  manageAction: "/ticket/staff/:ticketId/manage/:action",
  manageSelect: "/ticket/staff/:ticketId/manage/:action/select",
} as const;

export const ticketDeleteRoutes = {
  execute: "/ticket/delete/:ticketId",
} as const;

export const ticketReviewActionSchema = z.enum(["confirm", "cancel", "edit"]);
export const ticketManageActionSchema = z.enum([
  "transfer",
  "add_staff",
  "remove_staff",
  "add_member",
  "remove_member",
]);

export type TicketReviewAction = z.infer<typeof ticketReviewActionSchema>;
export type TicketManageAction = z.infer<typeof ticketManageActionSchema>;

export type TicketPanelCategory =
  (typeof config.ticketSystem.categories)[number]["value"];

const panelCategoryValues = config.ticketSystem.categories.map(
  (category) => category.value,
) as [TicketPanelCategory, ...TicketPanelCategory[]];

export const ticketPanelCategorySchema = z.enum(panelCategoryValues);

export type TicketCreateDraft = {
  nonce: string;
  guildId: Snowflake;
  panelChannelId: Snowflake;
  panelMessageId: Snowflake;
  memberId: Snowflake;
  category: TicketPanelCategory;
  summary: string;
  createdAt: number;
  expiresAt: number;
};

const draftStore = new Store<TicketCreateDraft>({
  clearTime: config.ticketSystem.createFlowExpiresInMs,
});
const draftNonceByMemberStore = new Store<string>({
  clearTime: config.ticketSystem.createFlowExpiresInMs,
});

export function createNonce() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export function upsertDraft(draft: TicketCreateDraft) {
  draftStore.set(draft.nonce, draft, {
    beforeEnd() {
      const memberNonce = draftNonceByMemberStore.get(draft.memberId);
      if (memberNonce === draft.nonce) {
        draftNonceByMemberStore.delete(draft.memberId);
      }
      return true;
    },
  });
  draftNonceByMemberStore.set(draft.memberId, draft.nonce);
  return draft;
}

export function clearDraft(nonce: string) {
  const draft = draftStore.get(nonce);
  if (draft) {
    const memberNonce = draftNonceByMemberStore.get(draft.memberId);
    if (memberNonce === nonce) {
      draftNonceByMemberStore.delete(draft.memberId);
    }
  }
  draftStore.delete(nonce);
}

export function getDraftByNonce(nonce: string) {
  return draftStore.get(nonce);
}

export function getDraftByMember(memberId: Snowflake) {
  const nonce = draftNonceByMemberStore.get(memberId);
  if (!nonce) return null;

  const draft = draftStore.get(nonce);
  if (!draft) {
    draftNonceByMemberStore.delete(memberId);
    return null;
  }

  return draft;
}

export function sanitizeSummary(raw: string) {
  return raw.replace(/\s+/g, " ").trim().slice(0, 1000);
}

function codeBlock(value: string) {
  return `\`\`\`\n${value.replace(/```/g, "'''")}\n\`\`\``;
}

export function resolveCategoryLabel(category: string) {
  return (
    config.ticketSystem.categories.find((item) => item.value === category)
      ?.label ?? category
  );
}

export function buildCreateModal(
  nonce: string,
  selectedCategory: TicketPanelCategory,
) {
  return createModal(
    `/ticket/create/modal/${nonce}`,
    "Create Ticket",
    createLabel(
      "Summary",
      "Describe your request clearly so the team can help faster.",
      createTextInput({
        customId: "summary",
        placeholder: `Briefly explain your ${resolveCategoryLabel(selectedCategory).toLowerCase()} request`,
        style: TextInputStyle.Paragraph,
        minLength: 10,
        maxLength: 1000,
        required: true,
      }),
    ),
  );
}

export function buildEditModal(draft: TicketCreateDraft) {
  const categoryMenu = new StringSelectMenuBuilder({
    customId: "category",
    placeholder: "Choose a support category",
    minValues: 1,
    maxValues: 1,
    options: config.ticketSystem.categories.map((item) => ({
      ...item,
      default: item.value === draft.category,
    })),
  });

  return createModal(
    `/ticket/create/edit/${draft.nonce}`,
    "Edit Ticket Request",
    createLabel("Category", categoryMenu),
    createLabel(
      "Summary",
      "Update your request details before creating the ticket.",
      createTextInput({
        customId: "summary",
        style: TextInputStyle.Paragraph,
        minLength: 10,
        maxLength: 1000,
        required: true,
        value: draft.summary,
      }),
    ),
  );
}

export function buildReviewMessage(draft: TicketCreateDraft) {
  const expiresUnix = Math.floor(draft.expiresAt / 1000);
  const reviewButtons = createRow(
    new ButtonBuilder({
      customId: `/ticket/create/review/${draft.nonce}/confirm`,
      label: "Confirm",
      style: ButtonStyle.Success,
    }),
    new ButtonBuilder({
      customId: `/ticket/create/review/${draft.nonce}/cancel`,
      label: "Cancel",
      style: ButtonStyle.Danger,
    }),
    new ButtonBuilder({
      customId: `/ticket/create/review/${draft.nonce}/edit`,
      label: "Edit",
      style: ButtonStyle.Secondary,
    }),
  );

  const container = createContainer(
    constants.colors.default,
    "## Confirm ticket creation",
    [
      `**Category**`,
      resolveCategoryLabel(draft.category),
      `**Summary**`,
      codeBlock(draft.summary),
      `Expires: <t:${expiresUnix}:R>`,
    ].join("\n"),
    Separator.Default,
    reviewButtons,
  );

  return {
    flags: MessageFlags.IsComponentsV2 as MessageFlags.IsComponentsV2,
    components: [container],
  };
}

export function buildThreadControlMessage(ticketId: number) {
  const controls = createRow(
    new ButtonBuilder({
      customId: `/ticket/staff/${ticketId}/assume`,
      label: "Assume Ticket",
      style: ButtonStyle.Primary,
    }),
    new ButtonBuilder({
      customId: `/ticket/staff/${ticketId}/close/open`,
      label: "Close Ticket",
      style: ButtonStyle.Danger,
      disabled: true,
    }),
    new ButtonBuilder({
      customId: `/ticket/staff/${ticketId}/options`,
      label: "Staff Options",
      style: ButtonStyle.Secondary,
      disabled: true,
    }),
  );

  const container = createContainer(
    constants.colors.default,
    "## Ticket Controls",
    "A staff member must assume this ticket before closing it or using staff options.",
    Separator.Default,
    controls,
  );

  return {
    flags: MessageFlags.IsComponentsV2 as MessageFlags.IsComponentsV2,
    components: [container],
  };
}

export function buildThreadControlMessageForAccepted(ticketId: number) {
  const controls = createRow(
    new ButtonBuilder({
      customId: `/ticket/staff/${ticketId}/assume`,
      label: "Assume Ticket",
      style: ButtonStyle.Primary,
      disabled: true,
    }),
    new ButtonBuilder({
      customId: `/ticket/staff/${ticketId}/close/open`,
      label: "Close Ticket",
      style: ButtonStyle.Danger,
    }),
    new ButtonBuilder({
      customId: `/ticket/staff/${ticketId}/options`,
      label: "Staff Options",
      style: ButtonStyle.Secondary,
    }),
  );

  const container = createContainer(
    constants.colors.default,
    "## Ticket Controls",
    "Ticket is assigned. Staff actions are available below.",
    Separator.Default,
    controls,
  );

  return {
    flags: MessageFlags.IsComponentsV2 as MessageFlags.IsComponentsV2,
    components: [container],
  };
}

export function buildThreadControlMessageForClosed(ticketId: number) {
  const controls = createRow(
    new ButtonBuilder({
      customId: `/ticket/staff/${ticketId}/assume`,
      label: "Assume Ticket",
      style: ButtonStyle.Primary,
      disabled: true,
    }),
    new ButtonBuilder({
      customId: `/ticket/staff/${ticketId}/close/open`,
      label: "Close Ticket",
      style: ButtonStyle.Danger,
      disabled: true,
    }),
    new ButtonBuilder({
      customId: `/ticket/staff/${ticketId}/options`,
      label: "Staff Options",
      style: ButtonStyle.Secondary,
      disabled: true,
    }),
    new ButtonBuilder({
      customId: `/ticket/delete/${ticketId}`,
      label: "Delete Ticket",
      style: ButtonStyle.Danger,
    }),
  );

  const container = createContainer(
    constants.colors.default,
    "## Ticket Controls",
    "Ticket is closed. Controls are disabled.",
    Separator.Default,
    controls,
  );

  return {
    flags: MessageFlags.IsComponentsV2 as MessageFlags.IsComponentsV2,
    components: [container],
  };
}

export function buildStaffManageActionMenu(ticketId: number) {
  const row = createRow(
    new ButtonBuilder({
      customId: `/ticket/staff/${ticketId}/manage/transfer`,
      label: "Transfer",
      style: ButtonStyle.Primary,
    }),
    new ButtonBuilder({
      customId: `/ticket/staff/${ticketId}/manage/add_staff`,
      label: "Add Staff",
      style: ButtonStyle.Secondary,
    }),
    new ButtonBuilder({
      customId: `/ticket/staff/${ticketId}/manage/remove_staff`,
      label: "Remove Staff",
      style: ButtonStyle.Secondary,
    }),
    new ButtonBuilder({
      customId: `/ticket/staff/${ticketId}/manage/add_member`,
      label: "Add Member",
      style: ButtonStyle.Secondary,
    }),
    new ButtonBuilder({
      customId: `/ticket/staff/${ticketId}/manage/remove_member`,
      label: "Remove Member",
      style: ButtonStyle.Secondary,
    }),
  );

  const container = createContainer(
    constants.colors.default,
    "## Staff Management",
    "Select an action below. A user selector will open for the selected action.",
    Separator.Default,
    row,
  );

  return {
    flags: MessageFlags.IsComponentsV2 as MessageFlags.IsComponentsV2,
    components: [container],
  };
}

export function buildStaffManageUserSelect(
  ticketId: number,
  action: TicketManageAction,
) {
  const maxValues = action === "add_staff" || action === "add_member" ? 5 : 1;

  const menu = new UserSelectMenuBuilder({
    customId: `/ticket/staff/${ticketId}/manage/${action}/select`,
    placeholder: "Select member(s)",
    minValues: 1,
    maxValues,
  });

  const container = createContainer(
    constants.colors.default,
    `## ${
      {
        transfer: "Transfer Ticket",
        add_staff: "Add Staff",
        remove_staff: "Remove Staff",
        add_member: "Add Member",
        remove_member: "Remove Member",
      }[action]
    }`,
    "Choose the target member(s) below.",
    Separator.Default,
    createRow(menu),
  );

  return {
    flags: MessageFlags.IsComponentsV2 as MessageFlags.IsComponentsV2,
    components: [container],
  };
}

export function buildTicketOpenedMessage(data: {
  ticketId: number;
  ownerId: Snowflake;
  ownerTag: string;
  ownerAvatarUrl: string | null;
  category: string;
  summary: string;
  supportMention: string;
}) {
  const embed = new EmbedBuilder()
    .setColor(constants.colors.default as `#${string}`)
    .setTitle("Ticket Opened")
    .setAuthor({
      name: `Opened by ${data.ownerTag}`,
      iconURL: data.ownerAvatarUrl ?? undefined,
    })
    .setThumbnail(data.ownerAvatarUrl ?? null)
    .setDescription(
      [
        `**Ticket**`,
        `#${data.ticketId}`,
        `**Owner**`,
        `<@${data.ownerId}>`,
        `**Category**`,
        resolveCategoryLabel(data.category),
        `**Summary**`,
        codeBlock(data.summary),
        `**Support**`,
        data.supportMention,
      ].join("\n"),
    )
    .setTimestamp(new Date());

  return {
    embeds: [embed],
  };
}

export function canManageTicket(member: {
  permissions: {
    has(permission: bigint): boolean;
  };
  roles?: { cache: Map<string, unknown> };
}) {
  if (member.permissions.has(PermissionFlagsBits.ManageThreads)) return true;
  const supportRoleId = config.ticketSystem.supportRoleId;
  if (!supportRoleId || !member.roles) return false;
  return member.roles.cache.has(supportRoleId);
}

export function isSupervisor(member: {
  roles?: { cache: Map<string, unknown> };
}) {
  const supervisorRoleId = config.ticketSystem.supervisorRoleId;
  if (!supervisorRoleId || !member.roles) return false;
  return member.roles.cache.has(supervisorRoleId);
}

export function toTicketType(category: TicketPanelCategory): TicketType {
  return category as TicketType;
}
