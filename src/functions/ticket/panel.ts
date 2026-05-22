import {
  createContainer,
  createMediaGallery,
  createRow,
  Separator,
} from "@magicyan/discord";
import { StringSelectMenuBuilder } from "discord.js";
import { config } from "#config";

export const TICKET_PANEL_LEGACY_SELECT_CUSTOM_ID = "/ticket/create/select";
export const TICKET_PANEL_SELECT_CUSTOM_ID = "/ticket/create/select/:nonce";

function createPanelSelectCustomId() {
  const nonce = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `/ticket/create/select/${nonce}`;
}

type TicketPanelContainerOptions = {
  bannerSource: string;
};

export function buildTicketPanelContainer({
  bannerSource,
}: TicketPanelContainerOptions) {
  const description = config.ticketSystem.panelDescription.replace(
    /\\n/g,
    "\n",
  );
  const descriptionLines = description
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const introLine = descriptionLines[0] ?? "";
  const instructionLine = descriptionLines[1] ?? "";

  const scheduleBlock = [
    `> **Support hours (${config.ticketSystem.supportHours.timeZoneLabel})**`,
    `> ${config.ticketSystem.supportHours.daysLabel} | ${config.ticketSystem.supportHours.windows.join(" and ")}`,
    `> ${config.ticketSystem.supportHours.note}`,
  ].join("\n");

  const selectMenu = new StringSelectMenuBuilder({
    customId: createPanelSelectCustomId(),
    placeholder: "Choose a support category",
    minValues: 1,
    maxValues: 1,
    options: config.ticketSystem.categories,
  });

  return createContainer(
    constants.colors.discord,
    createMediaGallery(bannerSource),
    Separator.Hidden,
    `## ${config.ticketSystem.panelTitle}`,
    introLine,
    scheduleBlock,
    Separator.Default,
    instructionLine,
    createRow(selectMenu),
    Separator.Default,
    `*${config.ticketSystem.panelFooter}*`,
  );
}
