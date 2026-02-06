import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, activities, users, follows, whiskies, isMysql } from '@/lib/db'
import { and, eq, inArray, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.max(1, Math.min(20, Number(searchParams.get('limit') || '5')))

  type FollowRow = { followedId: string }
  const followRows = await db
    .select({ followedId: follows.followedId })
    .from(follows)
    .where(eq(follows.followerId, session.user.id))

  const followedIds = (followRows as FollowRow[]).map((row: FollowRow) => row.followedId)
  if (followedIds.length === 0) {
    return NextResponse.json({ items: [] })
  }

  const rows = await db
    .select({
      id: activities.id,
      userId: activities.userId,
      type: activities.type,
      targetId: activities.targetId,
      createdAt: activities.createdAt,
      pseudo: users.pseudo,
      whiskyName: whiskies.name,
    })
    .from(activities)
    .leftJoin(
      users,
      isMysql ? sql`binary ${users.id} = binary ${activities.userId}` : eq(users.id, activities.userId)
    )
    .leftJoin(whiskies, eq(whiskies.id, activities.targetId))
    .where(inArray(activities.userId, followedIds))
    .orderBy(sql`${activities.createdAt} desc`)
    .limit(limit)

  type ActivityRow = {
    id: string
    userId: string
    type: string
    targetId: string
    createdAt: Date | null
    pseudo: string | null
    whiskyName: string | null
  }
  const typedRows = rows as ActivityRow[]
  const userIds = typedRows.map((row: ActivityRow) => row.userId)
  const targetUserIds = typedRows.filter((row: ActivityRow) => row.type === 'new_follow').map((row: ActivityRow) => row.targetId)
  const idsToFetch = Array.from(new Set([...userIds, ...targetUserIds]))

  type UserRow = { id: string; pseudo: string | null; visibility: string | null }
  const usersRows = idsToFetch.length
    ? await db.select({ id: users.id, pseudo: users.pseudo, visibility: users.visibility }).from(users)
      .where(inArray(users.id, idsToFetch))
    : [] as UserRow[]

  const usersMap = (usersRows as UserRow[]).reduce((acc, row: UserRow) => {
    acc[row.id] = row
    return acc
  }, {} as Record<string, { id: string; pseudo: string | null; visibility: string | null }>)

  const items = typedRows
    .filter((row: ActivityRow) => usersMap[row.userId]?.visibility === 'public')
    .filter((row: ActivityRow) => {
      if (row.type !== 'new_follow') return true
      return usersMap[row.targetId]?.visibility === 'public'
    })
    .map((row: ActivityRow) => ({
      id: row.id,
      type: row.type,
      createdAt: row.createdAt,
      actor: {
        id: row.userId,
        pseudo: usersMap[row.userId]?.pseudo || row.pseudo || '—',
      },
      targetUser: row.type === 'new_follow'
        ? { id: row.targetId, pseudo: usersMap[row.targetId]?.pseudo || '—' }
        : null,
      whisky: row.type === 'new_note'
        ? { id: row.targetId, name: row.whiskyName || '—' }
        : null,
    }))

  return NextResponse.json({ items })
}
