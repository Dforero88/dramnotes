import { db, tastingNotes, tastingNoteTags, userAromaProfile, isMysql } from '@/lib/db'
import { eq, sql } from 'drizzle-orm'

export type UserAromaProfile = {
  nose: { tagId: string; score: number; count: number }[]
  palate: { tagId: string; score: number; count: number }[]
  finish: { tagId: string; score: number; count: number }[]
}

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

  const profile: UserAromaProfile = { nose: [], palate: [], finish: [] }
  ;(rows as { tagId: string; type: string; score: number; count: number }[]).forEach((row) => {
    if (!profile[row.type as keyof UserAromaProfile]) return
    profile[row.type as keyof UserAromaProfile].push({
      tagId: row.tagId,
      score: Number(row.score || 0),
      count: Number(row.count || 0),
    })
  })

  await db.delete(userAromaProfile).where(eq(userAromaProfile.userId, userId))
  await db.insert(userAromaProfile).values({
    userId,
    avgRating,
    totalNotes,
    aromaProfile: JSON.stringify(profile),
    lastUpdated: new Date(),
  } as any)

  return { avgRating, totalNotes, aromaProfile: profile }
}
