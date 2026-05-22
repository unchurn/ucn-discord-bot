export const config = {
  ticketSystem: {
    enabled: true,
    allowTicketCreationOutsideSupportHours: true,
    panelBannerPath: "public/banner.jpg",
    panelBannerAttachmentName: "ticket-banner.jpg",
    panelTitle: "Support Center",
    panelDescription:
      "Open a ticket only when you really need support.\n\n**Select the category below that best matches your request.**",
    panelFooter:
      "-# Open tickets responsibly. Misuse of this system may result in moderation actions.",
    supportHours: {
      timeZoneLabel: "America/Sao_Paulo (Brasilia)",
      daysLabel: "Wednesday to Sunday",
      windows: ["07:00AM-12:00PM", "07:30PM-12:10AM"],
      note: "Tickets can still be opened outside support hours.",
    },
    ticketTypePriority: {
      security_report: 100,
      bug_report: 80,
      billing: 60,
      other: 40,
      question: 20,
    },
    queueDefaults: {
      limit: 20,
      includeClosed: false,
    },
    categories: [
      {
        label: "Questions",
        value: "question",
        description: "General questions and guidance.",
        emoji: "❓",
      },
      {
        label: "Billing",
        value: "billing",
        description: "Billing, payments, refunds, and invoices.",
        emoji: "💳",
      },
      {
        label: "Bug Report",
        value: "bug_report",
        description: "Report bugs and unexpected behavior.",
        emoji: "🐞",
      },
      {
        label: "Security",
        value: "security_report",
        description: "Security incidents and vulnerability reports.",
        emoji: "🔐",
      },
      {
        label: "Other",
        value: "other",
        description: "Anything that does not fit the categories above.",
        emoji: "🧩",
      },
    ],
  },
} as const;
