import { db, tastingNotes, tastingNoteTags, whiskyAnalyticsCache, isMysql } from '@/lib/db'
import { eq, sql } from 'drizzle-orm'

export type AromaProfile = {
  nose: { tagId: string; count: number }[]
  palate: { tagId: string; count: number }[]
  finish: { tagId: string; count: number }[]
}

export async function recomputeWhiskyAnalytics(whiskyId: string) {
  const stats = await db
    .select({
      avgRating: sql<number>`round(avg(${tastingNotes.rating}), 1)`,
      totalReviews: sql<number>`count(*)`,
    })
    .from(tastingNotes)
    .where(isMysql ? sql`binary ${tastingNotes.whiskyId} = binary ${whiskyId}` : eq(tastingNotes.whiskyId, whiskyId))

  const totalReviews = Number(stats?.[0]?.totalReviews || 0)
  if (totalReviews === 0) {
    await db.delete(whiskyAnalyticsCache).where(eq(whiskyAnalyticsCache.whiskyId, whiskyId))
    return null
  }

  const avgRating = Number(stats?.[0]?.avgRating || 0)

  const tagRows = await db
    .select({
      tagId: tastingNoteTags.tagId,
      type: tastingNoteTags.type,
      count: sql<number>`count(*)`,
    })
    .from(tastingNoteTags)
    .leftJoin(
      tastingNotes,
      isMysql
        ? sql`binary ${tastingNoteTags.noteId} = binary ${tastingNotes.id}`
        : sql`${tastingNoteTags.noteId} = ${tastingNotes.id}`
    )
    .where(isMysql ? sql`binary ${tastingNotes.whiskyId} = binary ${whiskyId}` : eq(tastingNotes.whiskyId, whiskyId))
    .groupBy(tastingNoteTags.tagId, tastingNoteTags.type)
    .orderBy(sql`count(*) desc`)

  const profile: AromaProfile = { nose: [], palate: [], finish: [] }
  ;(tagRows as { tagId: string; type: string; count: number }[]).forEach((row) => {
    if (!profile[row.type as keyof AromaProfile]) return
    profile[row.type as keyof AromaProfile].push({ tagId: row.tagId, count: Number(row.count || 0) })
  })

  await db.delete(whiskyAnalyticsCache).where(eq(whiskyAnalyticsCache.whiskyId, whiskyId))
  await db.insert(whiskyAnalyticsCache).values({
    whiskyId,
    avgRating,
    totalReviews,
    aromaProfile: JSON.stringify(profile),
    lastCalculated: new Date(),
  } as any)

  return { avgRating, totalReviews, aromaProfile: profile }
}
