import type { Snowflake } from "discord-api-types/v10";
import { and, eq } from "drizzle-orm";
import { db } from "../index.js";
import { member } from "../schema/index.js";

type CreateMemberInput = {
  id?: string;
  guildId: Snowflake;
  userId: Snowflake;
  username?: string | null;
  displayName?: string | null;
  joinedAt?: Date | null;
};

type UpdateMemberInput = {
  username?: string | null;
  displayName?: string | null;
  joinedAt?: Date | null;
};

export async function findMemberByUserId(userId: Snowflake) {
  const result = await db
    .select()
    .from(member)
    .where(eq(member.userId, userId))
    .limit(1);

  return result[0] ?? null;
}

export async function findMemberByGuildAndUserId(data: {
  guildId: Snowflake;
  userId: Snowflake;
}) {
  const result = await db
    .select()
    .from(member)
    .where(
      and(eq(member.guildId, data.guildId), eq(member.userId, data.userId)),
    )
    .limit(1);

  return result[0] ?? null;
}

export async function listMembers() {
  return db.select().from(member);
}

export async function listMembersByGuildId(guildId: Snowflake) {
  return db.select().from(member).where(eq(member.guildId, guildId));
}

export async function createMember(data: CreateMemberInput) {
  const result = await db
    .insert(member)
    .values({
      id: data.id ?? crypto.randomUUID(),
      guildId: data.guildId,
      userId: data.userId,
      username: data.username ?? null,
      displayName: data.displayName ?? null,
      joinedAt: data.joinedAt ?? null,
    })
    .returning();

  return result[0] ?? null;
}

export async function updateMemberByUserId(
  userId: Snowflake,
  data: UpdateMemberInput,
) {
  const result = await db
    .update(member)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(member.userId, userId))
    .returning();

  return result[0] ?? null;
}

export async function deleteMemberByUserId(userId: Snowflake) {
  const result = await db
    .delete(member)
    .where(eq(member.userId, userId))
    .returning();

  return result[0] ?? null;
}

export async function upsertMember(data: CreateMemberInput) {
  const existingMember = await findMemberByGuildAndUserId({
    guildId: data.guildId,
    userId: data.userId,
  });

  if (existingMember) {
    return updateMemberByUserId(data.userId, {
      username: data.username ?? null,
      displayName: data.displayName ?? null,
      joinedAt: data.joinedAt ?? existingMember.joinedAt,
    });
  }

  return createMember(data);
}
