import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, users, userAromaProfile, tastingNotes, tagLang, isMysql } from '@/lib/db'
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { UserAromaProfile } from '@/lib/user-aroma'

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
      aromaProfile: userAromaProfile.aromaProfile,
    })
    .from(userAromaProfile)
    .where(isMysql ? sql`binary ${userAromaProfile.userId} = binary ${user.id}` : eq(userAromaProfile.userId, user.id))
    .limit(1)

  const profileRow = profileRows?.[0]
  if (!profileRow || !profileRow.aromaProfile) {
    const countRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(tastingNotes)
      .where(isMysql ? sql`binary ${tastingNotes.userId} = binary ${user.id}` : eq(tastingNotes.userId, user.id))
    const totalNotes = Number(countRes?.[0]?.count || 0)
    return NextResponse.json({
      hasProfile: false,
      totalNotes,
      avgRating: 0,
      top: { nose: [], palate: [], finish: [] },
      worst: { nose: [], palate: [], finish: [] },
    })
  }

  const profile = JSON.parse(profileRow.aromaProfile) as UserAromaProfile
  const allTagIds = Array.from(new Set([
    ...(profile.nose || []).map((t) => t.tagId),
    ...(profile.palate || []).map((t) => t.tagId),
    ...(profile.finish || []).map((t) => t.tagId),
  ]))

  const tagRows = allTagIds.length
    ? await db
        .select({ tagId: tagLang.tagId, name: tagLang.name })
        .from(tagLang)
        .where(and(eq(tagLang.lang, lang), inArray(tagLang.tagId, allTagIds)))
    : []

  const tagMap = new Map(tagRows.map((row) => [row.tagId, row.name]))

  const toDisplay = (items: { tagId: string; score: number; count: number }[]) =>
    items
      .map((item) => ({
        name: tagMap.get(item.tagId) || '',
        score: item.score,
        count: item.count,
      }))
      .filter((item) => item.name)

  const sortTop = (items: { tagId: string; score: number; count: number }[]) =>
    [...items].sort((a, b) => b.score - a.score).slice(0, 6)

  const sortWorst = (items: { tagId: string; score: number; count: number }[]) =>
    [...items].sort((a, b) => a.score - b.score).slice(0, 6)

  return NextResponse.json({
    hasProfile: true,
    totalNotes: Number(profileRow.totalNotes || 0),
    avgRating: Number(profileRow.avgRating || 0),
    top: {
      nose: toDisplay(sortTop(profile.nose || [])),
      palate: toDisplay(sortTop(profile.palate || [])),
      finish: toDisplay(sortTop(profile.finish || [])),
    },
    worst: {
      nose: toDisplay(sortWorst(profile.nose || [])),
      palate: toDisplay(sortWorst(profile.palate || [])),
      finish: toDisplay(sortWorst(profile.finish || [])),
    },
  })
}
