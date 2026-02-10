import { db, tastingNotes, tastingNoteTags, whiskyAnalyticsCache, whiskyTagStats, isMysql } from '@/lib/db'
import { eq, sql } from 'drizzle-orm'
import * as Sentry from '@sentry/nextjs'

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
    await db.delete(whiskyTagStats).where(eq(whiskyTagStats.whiskyId, whiskyId))
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

  await db.delete(whiskyTagStats).where(eq(whiskyTagStats.whiskyId, whiskyId))
  if (tagRows.length > 0) {
    await db.insert(whiskyTagStats).values(
      (tagRows as { tagId: string; type: string; count: number }[]).map((row) => ({
        whiskyId,
        tagId: row.tagId,
        section: row.type,
        count: Number(row.count || 0),
      }))
    )
  }

  await db.delete(whiskyAnalyticsCache).where(eq(whiskyAnalyticsCache.whiskyId, whiskyId))
  await db.insert(whiskyAnalyticsCache).values({
    whiskyId,
    avgRating,
    totalReviews,
    lastCalculated: new Date(),
  } as any)

  Sentry.captureMessage('aroma_whisky_recomputed', {
    level: 'info',
    tags: { whiskyId },
  })

  return { avgRating, totalReviews }
}
