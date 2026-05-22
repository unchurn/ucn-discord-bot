import type { Snowflake } from "discord-api-types/v10";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../index.js";
import { ticket, ticketAuditLog, ticketParticipant } from "../schema/index.js";
import type { TicketType } from "../schema/index.js";

type CreateTicketInput = {
  guildId: Snowflake;
  threadId: Snowflake;
  ownerId: Snowflake;
  createdById: Snowflake;
  ticketType: TicketType;
  summary: string;
};

type CreateAuditLogInput = {
  ticketId: number;
  action:
    | "created"
    | "accepted"
    | "closed"
    | "cancelled"
    | "participant_added"
    | "participant_removed"
    | "transferred";
  actorId: Snowflake;
  targetUserId?: Snowflake | null;
  reason?: string | null;
};

async function createTicketAuditLog(data: CreateAuditLogInput) {
  await db.insert(ticketAuditLog).values({
    ticketId: data.ticketId,
    action: data.action,
    actorId: data.actorId,
    targetUserId: data.targetUserId ?? null,
    reason: data.reason ?? null,
  });
}

export async function createTicket(data: CreateTicketInput) {
  const result = await db
    .insert(ticket)
    .values({
      guildId: data.guildId,
      threadId: data.threadId,
      ownerId: data.ownerId,
      createdById: data.createdById,
      ticketType: data.ticketType,
      summary: data.summary,
      status: "open",
    })
    .returning();

  const createdTicket = result[0] ?? null;

  if (createdTicket) {
    await createTicketAuditLog({
      ticketId: createdTicket.id,
      action: "created",
      actorId: data.createdById,
      targetUserId: data.ownerId,
    });
  }

  return createdTicket;
}

export async function findTicketByThreadId(threadId: Snowflake) {
  const result = await db
    .select()
    .from(ticket)
    .where(eq(ticket.threadId, threadId))
    .limit(1);

  return result[0] ?? null;
}

export async function findTicketById(ticketId: number) {
  const result = await db
    .select()
    .from(ticket)
    .where(eq(ticket.id, ticketId))
    .limit(1);

  return result[0] ?? null;
}

export async function listTicketsByGuildId(guildId: Snowflake) {
  return db
    .select()
    .from(ticket)
    .where(eq(ticket.guildId, guildId))
    .orderBy(desc(ticket.createdAt));
}

export async function listTicketsByOwnerId(ownerId: Snowflake) {
  return db
    .select()
    .from(ticket)
    .where(eq(ticket.ownerId, ownerId))
    .orderBy(desc(ticket.createdAt));
}

export async function listTicketAuditLogs(ticketId: number) {
  return db
    .select()
    .from(ticketAuditLog)
    .where(eq(ticketAuditLog.ticketId, ticketId))
    .orderBy(desc(ticketAuditLog.createdAt));
}

export async function listActiveTicketParticipants(ticketId: number) {
  return db
    .select()
    .from(ticketParticipant)
    .where(
      and(
        eq(ticketParticipant.ticketId, ticketId),
        eq(ticketParticipant.isActive, true),
      ),
    );
}

export async function acceptTicket(data: {
  threadId: Snowflake;
  acceptedById: Snowflake;
}) {
  const existingTicket = await findTicketByThreadId(data.threadId);

  if (!existingTicket) return null;

  const acceptedAt = new Date();

  const firstResponseSeconds = Math.floor(
    (acceptedAt.getTime() - existingTicket.createdAt.getTime()) / 1000,
  );

  const result = await db
    .update(ticket)
    .set({
      status: "accepted",
      acceptedById: data.acceptedById,
      assignedToId: data.acceptedById,
      acceptedAt,
      firstResponseSeconds,
      updatedAt: new Date(),
    })
    .where(eq(ticket.id, existingTicket.id))
    .returning();

  const updatedTicket = result[0] ?? null;

  if (updatedTicket) {
    await addTicketParticipant({
      ticketId: updatedTicket.id,
      userId: data.acceptedById,
      addedById: data.acceptedById,
    });

    await createTicketAuditLog({
      ticketId: updatedTicket.id,
      action: "accepted",
      actorId: data.acceptedById,
      targetUserId: data.acceptedById,
    });
  }

  return updatedTicket;
}

export async function addTicketParticipant(data: {
  ticketId: number;
  userId: Snowflake;
  addedById: Snowflake;
}) {
  const result = await db
    .insert(ticketParticipant)
    .values({
      ticketId: data.ticketId,
      userId: data.userId,
      addedById: data.addedById,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [ticketParticipant.ticketId, ticketParticipant.userId],
      set: {
        addedById: data.addedById,
        removedById: null,
        removedAt: null,
        isActive: true,
      },
    })
    .returning();

  await createTicketAuditLog({
    ticketId: data.ticketId,
    action: "participant_added",
    actorId: data.addedById,
    targetUserId: data.userId,
  });

  return result[0] ?? null;
}

export async function removeTicketParticipant(data: {
  ticketId: number;
  userId: Snowflake;
  removedById: Snowflake;
  reason?: string | null;
}) {
  const result = await db
    .update(ticketParticipant)
    .set({
      isActive: false,
      removedById: data.removedById,
      removedAt: new Date(),
    })
    .where(
      and(
        eq(ticketParticipant.ticketId, data.ticketId),
        eq(ticketParticipant.userId, data.userId),
      ),
    )
    .returning();

  await createTicketAuditLog({
    ticketId: data.ticketId,
    action: "participant_removed",
    actorId: data.removedById,
    targetUserId: data.userId,
    reason: data.reason ?? null,
  });

  return result[0] ?? null;
}

export async function transferTicket(data: {
  threadId: Snowflake;
  toUserId: Snowflake;
  transferredById: Snowflake;
  reason?: string | null;
}) {
  const existingTicket = await findTicketByThreadId(data.threadId);

  if (!existingTicket) return null;

  if (existingTicket.assignedToId) {
    await removeTicketParticipant({
      ticketId: existingTicket.id,
      userId: existingTicket.assignedToId,
      removedById: data.transferredById,
      reason: data.reason,
    });
  }

  await addTicketParticipant({
    ticketId: existingTicket.id,
    userId: data.toUserId,
    addedById: data.transferredById,
  });

  const result = await db
    .update(ticket)
    .set({
      assignedToId: data.toUserId,
      updatedAt: new Date(),
    })
    .where(eq(ticket.id, existingTicket.id))
    .returning();

  await createTicketAuditLog({
    ticketId: existingTicket.id,
    action: "transferred",
    actorId: data.transferredById,
    targetUserId: data.toUserId,
    reason: data.reason ?? null,
  });

  return result[0] ?? null;
}

export async function closeTicket(data: {
  threadId: Snowflake;
  closedById: Snowflake;
  closeReason?: string | null;
}) {
  const existingTicket = await findTicketByThreadId(data.threadId);

  if (!existingTicket) return null;

  const closedAt = new Date();

  const resolutionSeconds = Math.floor(
    (closedAt.getTime() - existingTicket.createdAt.getTime()) / 1000,
  );

  const result = await db
    .update(ticket)
    .set({
      status: "closed",
      closedById: data.closedById,
      closeReason: data.closeReason ?? null,
      closedAt,
      resolutionSeconds,
      updatedAt: new Date(),
    })
    .where(eq(ticket.id, existingTicket.id))
    .returning();

  await createTicketAuditLog({
    ticketId: existingTicket.id,
    action: "closed",
    actorId: data.closedById,
    reason: data.closeReason ?? null,
  });

  return result[0] ?? null;
}

export async function cancelTicket(data: {
  threadId: Snowflake;
  closedById: Snowflake;
  closeReason?: string | null;
}) {
  const existingTicket = await findTicketByThreadId(data.threadId);

  if (!existingTicket) return null;

  const closedAt = new Date();

  const resolutionSeconds = Math.floor(
    (closedAt.getTime() - existingTicket.createdAt.getTime()) / 1000,
  );

  const result = await db
    .update(ticket)
    .set({
      status: "cancelled",
      closedById: data.closedById,
      closeReason: data.closeReason ?? null,
      closedAt,
      resolutionSeconds,
      updatedAt: new Date(),
    })
    .where(eq(ticket.id, existingTicket.id))
    .returning();

  await createTicketAuditLog({
    ticketId: existingTicket.id,
    action: "cancelled",
    actorId: data.closedById,
    reason: data.closeReason ?? null,
  });

  return result[0] ?? null;
}
