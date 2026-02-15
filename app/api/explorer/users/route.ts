import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, tastingNotes, users, follows, isMysql } from '@/lib/db'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { normalizeSearch } from '@/lib/moderation'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = normalizeSearch((searchParams.get('q') || '').toLowerCase(), 40)
  const requestedPage = Math.max(1, Number(searchParams.get('page') || '1'))
  const requestedPageSize = Math.max(1, Math.min(24, Number(searchParams.get('pageSize') || '12')))
  const isEmptyQuery = q.length === 0
  const page = isEmptyQuery ? 1 : requestedPage
  const pageSize = isEmptyQuery ? 3 : requestedPageSize
  const offset = (page - 1) * pageSize

  const filters: any[] = [
    isMysql ? sql`binary ${users.visibility} = 'public'` : eq(users.visibility, 'public')
  ]
  if (q) {
    filters.push(sql`lower(${users.pseudo}) like ${`%${q}%`}`)
  }

  let total = 0
  let totalPages = 1
  if (!isEmptyQuery) {
    const totalRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(...filters))
    total = Number(totalRes?.[0]?.count || 0)
    totalPages = Math.max(1, Math.ceil(total / pageSize))
  }

  const rows = await db
    .select({
      id: users.id,
      pseudo: users.pseudo,
      notesCount: sql<number>`count(${tastingNotes.id})`,
    })
    .from(users)
    .leftJoin(
      tastingNotes,
      isMysql
        ? sql`binary ${tastingNotes.userId} = binary ${users.id} and binary ${tastingNotes.status} = 'published'`
        : sql`${tastingNotes.userId} = ${users.id} and ${tastingNotes.status} = 'published'`
    )
    .where(and(...filters))
    .groupBy(users.id)
    .orderBy(isEmptyQuery ? sql`count(${tastingNotes.id}) desc` : sql`lower(${users.pseudo}) asc`)
    .limit(pageSize)
    .offset(offset)

  type Row = { id: string; pseudo: string; notesCount: number | null }
  const baseItems = (rows as Row[]).map((row: Row) => ({
    id: row.id,
    pseudo: row.pseudo,
    notesCount: Number(row.notesCount || 0),
  }))

  const ids = baseItems.map((row) => row.id)
  let followingIds = new Set<string>()
  if (ids.length > 0) {
    const followRows = await db
      .select({ followedId: follows.followedId })
      .from(follows)
      .where(and(
        isMysql ? sql`binary ${follows.followerId} = binary ${session.user.id}` : eq(follows.followerId, session.user.id),
        inArray(follows.followedId, ids)
      ))
    followingIds = new Set((followRows as { followedId: string }[]).map((row) => row.followedId))
  }

  const items = baseItems.map((row) => ({
    ...row,
    isFollowing: followingIds.has(row.id),
  }))

  return NextResponse.json({ items, total, totalPages, page, pageSize, isTop: isEmptyQuery })
}
