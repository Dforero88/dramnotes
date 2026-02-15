import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, follows, tastingNotes, users, isMysql } from '@/lib/db'
import { and, eq, sql } from 'drizzle-orm'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  const friends = await db
    .select({
      id: users.id,
      pseudo: users.pseudo,
      tastingCount: sql<number>`count(${tastingNotes.id})`,
    })
    .from(follows)
    .leftJoin(
      users,
      isMysql ? sql`binary ${users.id} = binary ${follows.followedId}` : eq(users.id, follows.followedId)
    )
    .leftJoin(
      tastingNotes,
      isMysql
        ? sql`binary ${tastingNotes.userId} = binary ${users.id} and ${tastingNotes.latitude} is not null and binary ${tastingNotes.status} = 'published'`
        : sql`${tastingNotes.userId} = ${users.id} and ${tastingNotes.latitude} is not null and ${tastingNotes.status} = 'published'`
    )
    .where(and(
      isMysql ? sql`binary ${follows.followerId} = binary ${userId}` : eq(follows.followerId, userId),
      isMysql ? sql`binary ${users.visibility} = 'public'` : eq(users.visibility, 'public')
    ))
    .groupBy(users.id)
    .orderBy(sql`lower(${users.pseudo}) asc`)

  const myCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(tastingNotes)
    .where(and(
      isMysql ? sql`binary ${tastingNotes.userId} = binary ${userId}` : eq(tastingNotes.userId, userId),
      eq(tastingNotes.status, 'published'),
      sql`${tastingNotes.latitude} is not null`
    ))

  return NextResponse.json({
    friends: (friends as { id: string; pseudo: string; tastingCount: number | null }[]).map((f) => ({
      id: f.id,
      pseudo: f.pseudo,
      tastingCount: Number(f.tastingCount || 0),
    })),
    myTastingCount: Number(myCountRes?.[0]?.count || 0),
  })
}
