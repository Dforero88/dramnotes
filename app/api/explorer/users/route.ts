import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, tastingNotes, users } from '@/lib/db'
import { and, eq, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim().toLowerCase()
  const requestedPage = Math.max(1, Number(searchParams.get('page') || '1'))
  const requestedPageSize = Math.max(1, Math.min(24, Number(searchParams.get('pageSize') || '12')))
  const isEmptyQuery = q.length === 0
  const page = isEmptyQuery ? 1 : requestedPage
  const pageSize = isEmptyQuery ? 3 : requestedPageSize
  const offset = (page - 1) * pageSize

  const filters: any[] = [sql`binary ${users.visibility} = 'public'`]
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
    .leftJoin(tastingNotes, sql`binary ${tastingNotes.userId} = binary ${users.id}`)
    .where(and(...filters))
    .groupBy(users.id)
    .orderBy(isEmptyQuery ? sql`count(${tastingNotes.id}) desc` : sql`lower(${users.pseudo}) asc`)
    .limit(pageSize)
    .offset(offset)

  type Row = { id: string; pseudo: string; notesCount: number | null }
  const items = (rows as Row[]).map((row: Row) => ({
    id: row.id,
    pseudo: row.pseudo,
    notesCount: Number(row.notesCount || 0),
  }))

  return NextResponse.json({ items, total, totalPages, page, pageSize, isTop: isEmptyQuery })
}
