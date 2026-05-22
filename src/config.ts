export const config = {
  ticketSystem: {
    enabled: true,
    allowTicketCreationOutsideSupportHours: true,
    panelBannerPath: "public/banner.jpg",
    panelBannerAttachmentName: "ticket-banner.jpg",
    panelTitle: "Support Center",
    panelDescription:
      "Need help with the server or platform? Open a ticket and our team will assist you.\n**Select one category below to route your request.**",
    panelFooter:
      "-# Open tickets responsibly. Misuse of this system may result in moderation actions.",
    supportHours: {
      timeZoneLabel: "America/Sao_Paulo (Brasilia)",
      daysLabel: "Wednesday to Sunday",
      windows: ["07:00-12:00", "19:30-00:10"],
      note: "You can open tickets anytime. Responses are prioritized during support hours.",
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
      },
      {
        label: "Billing",
        value: "billing",
        description: "Billing, payments, refunds, and invoices.",
      },
      {
        label: "Bug Report",
        value: "bug_report",
        description: "Report bugs and unexpected behavior.",
      },
      {
        label: "Security",
        value: "security_report",
        description: "Security incidents and vulnerability reports.",
      },
      {
        label: "Other",
        value: "other",
        description: "Anything that does not fit the categories above.",
      },
    ],
  },
} as const;
