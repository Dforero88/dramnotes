import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, users, userAromaProfile, userTagStats, tastingNotes, tagLang, isMysql } from '@/lib/db'
import { and, eq, inArray, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const lang = (searchParams.get('lang') || 'fr').trim()

  if (!userId) {
    return NextResponse.json({ error: 'userId missing' }, { status: 400 })
  }

  const userRows = await db
    .select({ id: users.id, visibility: users.visibility })
    .from(users)
    .where(isMysql ? sql`binary ${users.id} = binary ${userId}` : eq(users.id, userId))
    .limit(1)

  const user = userRows?.[0]
  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const isOwner = user.id === session.user.id
  if (!isOwner && user.visibility !== 'public') {
    return NextResponse.json({ error: 'Private' }, { status: 403 })
  }

  const profileRows = await db
    .select({
      avgRating: userAromaProfile.avgRating,
      totalNotes: userAromaProfile.totalNotes,
    })
    .from(userAromaProfile)
    .where(isMysql ? sql`binary ${userAromaProfile.userId} = binary ${user.id}` : eq(userAromaProfile.userId, user.id))
    .limit(1)

  const profileRow = profileRows?.[0]
  if (!profileRow) {
    const countRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(tastingNotes)
      .where(and(
        isMysql ? sql`binary ${tastingNotes.userId} = binary ${user.id}` : eq(tastingNotes.userId, user.id),
        eq(tastingNotes.status, 'published')
      ))
    const totalNotes = Number(countRes?.[0]?.count || 0)
    return NextResponse.json({
      hasProfile: false,
      totalNotes,
      avgRating: 0,
      top: { nose: [], palate: [], finish: [] },
      worst: { nose: [], palate: [], finish: [] },
    })
  }

  const statsRows = await db
    .select({
      tagId: userTagStats.tagId,
      section: userTagStats.section,
      avgScore: userTagStats.avgScore,
      count: userTagStats.count,
      name: tagLang.name,
    })
    .from(userTagStats)
    .leftJoin(tagLang, and(eq(tagLang.tagId, userTagStats.tagId), eq(tagLang.lang, lang)))
    .where(isMysql ? sql`binary ${userTagStats.userId} = binary ${user.id}` : eq(userTagStats.userId, user.id))
  type UserTagStatRow = {
    tagId: string
    section: 'nose' | 'palate' | 'finish'
    avgScore: number | null
    count: number | null
    name: string | null
  }

  const grouped = {
    nose: [] as { name: string; score: number; count: number }[],
    palate: [] as { name: string; score: number; count: number }[],
    finish: [] as { name: string; score: number; count: number }[],
  }

  ;(statsRows as UserTagStatRow[]).forEach((row: UserTagStatRow) => {
    if (!row.name) return
    if (row.section === 'nose') grouped.nose.push({ name: row.name, score: Number(row.avgScore || 0), count: Number(row.count || 0) })
    if (row.section === 'palate') grouped.palate.push({ name: row.name, score: Number(row.avgScore || 0), count: Number(row.count || 0) })
    if (row.section === 'finish') grouped.finish.push({ name: row.name, score: Number(row.avgScore || 0), count: Number(row.count || 0) })
  })

  const sortTop = (items: { name: string; score: number; count: number }[]) =>
    [...items].sort((a, b) => b.score - a.score).slice(0, 6)

  const sortWorst = (items: { name: string; score: number; count: number }[]) =>
    [...items].sort((a, b) => a.score - b.score).slice(0, 6)

  return NextResponse.json({
    hasProfile: true,
    totalNotes: Number(profileRow.totalNotes || 0),
    avgRating: Number(profileRow.avgRating || 0),
    top: {
      nose: sortTop(grouped.nose),
      palate: sortTop(grouped.palate),
      finish: sortTop(grouped.finish),
    },
    worst: {
      nose: sortWorst(grouped.nose),
      palate: sortWorst(grouped.palate),
      finish: sortWorst(grouped.finish),
    },
  })
}
