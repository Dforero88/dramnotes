import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, follows, tastingNotes, whiskies, users, isMysql } from '@/lib/db'
import { and, eq, inArray, sql } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const requested: string[] = Array.isArray(body?.users) ? body.users : []

  if (requested.length === 0) {
    return NextResponse.json({ items: [] })
  }

  const userId = session.user.id

  const followRows = await db
    .select({ followedId: follows.followedId })
    .from(follows)
    .where(isMysql ? sql`binary ${follows.followerId} = binary ${userId}` : eq(follows.followerId, userId))

  const allowed = new Set<string>([userId, ...(followRows as { followedId: string }[]).map((r) => r.followedId)])
  const selectedIds: string[] = []
  requested.forEach((id) => {
    const actual = id === 'me' ? userId : id
    if (allowed.has(actual)) selectedIds.push(actual)
  })

  if (selectedIds.length === 0) {
    return NextResponse.json({ items: [] })
  }

  const rows = await db
    .select({
      latitude: tastingNotes.latitude,
      longitude: tastingNotes.longitude,
      tastingDate: tastingNotes.tastingDate,
      whiskyName: whiskies.name,
      whiskyId: tastingNotes.whiskyId,
      pseudo: users.pseudo,
      userId: users.id,
    })
    .from(tastingNotes)
    .leftJoin(
      users,
      isMysql ? sql`binary ${users.id} = binary ${tastingNotes.userId}` : eq(users.id, tastingNotes.userId)
    )
    .leftJoin(
      whiskies,
      isMysql ? sql`binary ${whiskies.id} = binary ${tastingNotes.whiskyId}` : eq(whiskies.id, tastingNotes.whiskyId)
    )
    .where(and(
      inArray(tastingNotes.userId, selectedIds),
      eq(tastingNotes.status, 'published'),
      sql`${tastingNotes.latitude} is not null`,
      sql`${tastingNotes.longitude} is not null`,
      isMysql
        ? sql`(binary ${users.id} = binary ${userId} OR binary ${users.visibility} = 'public')`
        : sql`(${users.id} = ${userId} OR ${users.visibility} = 'public')`
    ))

  const items = (rows as any[]).map((row) => ({
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    tastingDate: row.tastingDate,
    whiskyName: row.whiskyName,
    whiskyId: row.whiskyId,
    pseudo: row.pseudo,
    userId: row.userId,
  }))

  return NextResponse.json({ items })
}
