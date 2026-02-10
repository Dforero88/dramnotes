import { db, tastingNotes, tastingNoteTags, userAromaProfile, userTagStats, isMysql } from '@/lib/db'
import { eq, sql } from 'drizzle-orm'
import * as Sentry from '@sentry/nextjs'

export async function recomputeUserAroma(userId: string) {
  const stats = await db
    .select({
      avgRating: sql<number>`round(avg(${tastingNotes.rating}), 1)`,
      totalNotes: sql<number>`count(*)`,
    })
    .from(tastingNotes)
    .where(isMysql ? sql`binary ${tastingNotes.userId} = binary ${userId}` : eq(tastingNotes.userId, userId))

  const totalNotes = Number(stats?.[0]?.totalNotes || 0)
  if (totalNotes === 0) {
    await db.delete(userAromaProfile).where(eq(userAromaProfile.userId, userId))
    await db.delete(userTagStats).where(eq(userTagStats.userId, userId))
    return null
  }

  const avgRating = Number(stats?.[0]?.avgRating || 0)

  const rows = await db
    .select({
      tagId: tastingNoteTags.tagId,
      type: tastingNoteTags.type,
      score: sql<number>`round(avg(${tastingNotes.rating}), 1)`,
      count: sql<number>`count(*)`,
    })
    .from(tastingNoteTags)
    .leftJoin(
      tastingNotes,
      isMysql
        ? sql`binary ${tastingNoteTags.noteId} = binary ${tastingNotes.id}`
        : sql`${tastingNoteTags.noteId} = ${tastingNotes.id}`
    )
    .where(isMysql ? sql`binary ${tastingNotes.userId} = binary ${userId}` : eq(tastingNotes.userId, userId))
    .groupBy(tastingNoteTags.tagId, tastingNoteTags.type)

  await db.delete(userTagStats).where(eq(userTagStats.userId, userId))
  if (rows.length > 0) {
    await db.insert(userTagStats).values(
      (rows as { tagId: string; type: string; score: number; count: number }[]).map((row) => ({
        userId,
        tagId: row.tagId,
        section: row.type,
        avgScore: Number(row.score || 0),
        count: Number(row.count || 0),
      }))
    )
  }

  await db.delete(userAromaProfile).where(eq(userAromaProfile.userId, userId))
  await db.insert(userAromaProfile).values({
    userId,
    avgRating,
    totalNotes,
    lastUpdated: new Date(),
  } as any)

  Sentry.captureMessage('aroma_user_recomputed', {
    level: 'info',
    tags: { userId },
  })

  return { avgRating, totalNotes }
}
