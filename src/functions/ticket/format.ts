import type { TicketStatus } from "#schemas";

const statusLabels: Record<TicketStatus, string> = {
  open: "Open",
  accepted: "Accepted",
  closed: "Closed",
  cancelled: "Cancelled",
};

export function isTicketActive(status: TicketStatus) {
  return status === "open" || status === "accepted";
}

export function ticketStatusLabel(status: TicketStatus) {
  return statusLabels[status];
}

export function discordTimestamp(date: Date | null) {
  return date ? `<t:${Math.floor(date.getTime() / 1000)}:f>` : "n/a";
}

export function memberMention(id: string | null) {
  return id ? `<@${id}>` : "n/a";
}

export function secondsLabel(seconds: number | null) {
  if (seconds === null) return "n/a";
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function averageSeconds(values: Array<number | null>) {
  const validValues = values.filter((value): value is number => value !== null);
  if (!validValues.length) return null;

  return Math.floor(
    validValues.reduce((total, value) => total + value, 0) / validValues.length,
  );
}
