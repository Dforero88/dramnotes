import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, users, follows, tastingNotes, isMysql } from '@/lib/db'
import { and, eq, inArray, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const page = Math.max(1, Number(searchParams.get('page') || '1'))
  const pageSize = Math.max(1, Math.min(24, Number(searchParams.get('pageSize') || '12')))
  const offset = (page - 1) * pageSize

  if (!userId) {
    return NextResponse.json({ error: 'userId missing' }, { status: 400 })
  }

  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  const user = userRows?.[0]
  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const isOwner = user.id === session.user.id
  if (!isOwner && user.visibility !== 'public') {
    return NextResponse.json({ error: 'Private' }, { status: 403 })
  }

  const baseFilter = and(
    eq(follows.followerId, user.id),
    isMysql ? sql`binary ${users.visibility} = 'public'` : eq(users.visibility, 'public')
  )

  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(follows)
    .leftJoin(
      users,
      isMysql ? sql`binary ${users.id} = binary ${follows.followedId}` : eq(users.id, follows.followedId)
    )
    .where(baseFilter)
  const total = Number(countRes?.[0]?.count || 0)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const rows = await db
    .select({
      id: users.id,
      pseudo: users.pseudo,
      notesCount: sql<number>`count(${tastingNotes.id})`,
    })
    .from(follows)
    .leftJoin(
      users,
      isMysql ? sql`binary ${users.id} = binary ${follows.followedId}` : eq(users.id, follows.followedId)
    )
    .leftJoin(
      tastingNotes,
      isMysql ? sql`binary ${tastingNotes.userId} = binary ${users.id}` : eq(tastingNotes.userId, users.id)
    )
    .where(baseFilter)
    .groupBy(users.id)
    .orderBy(sql`lower(${users.pseudo}) asc`)
    .limit(pageSize)
    .offset(offset)

  type Row = { id: string; pseudo: string; notesCount: number | null }
  const items = (rows as Row[]).map((row: Row) => ({
    id: row.id,
    pseudo: row.pseudo,
    notesCount: Number(row.notesCount || 0),
  }))

  const viewerId = session.user.id
  let followingMap: Record<string, boolean> = {}
  if (items.length > 0) {
    const ids = items.map((item) => item.id)
    const existing = await db
      .select({ followedId: follows.followedId })
      .from(follows)
      .where(and(eq(follows.followerId, viewerId), inArray(follows.followedId, ids)))
    type ExistingRow = { followedId: string }
    followingMap = (existing as ExistingRow[]).reduce((acc: Record<string, boolean>, row: ExistingRow) => {
      acc[row.followedId] = true
      return acc
    }, {} as Record<string, boolean>)
  }

  return NextResponse.json({
    items: items.map((item) => ({ ...item, isFollowing: Boolean(followingMap[item.id]) })),
    total,
    totalPages,
    page,
    pageSize,
  })
}
