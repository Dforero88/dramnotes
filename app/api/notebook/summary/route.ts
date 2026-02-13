import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, users, tastingNotes, follows, userShelf, isMysql } from '@/lib/db'
import { and, eq, sql } from 'drizzle-orm'
import { normalizeSearch } from '@/lib/moderation'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const pseudo = normalizeSearch(searchParams.get('pseudo') || '', 40)
  const viewerId = session.user.id

  const userRows = pseudo
    ? await db.select().from(users).where(eq(users.pseudo, pseudo)).limit(1)
    : await db.select().from(users).where(eq(users.id, viewerId)).limit(1)

  const user = userRows?.[0]
  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const isOwner = user.id === viewerId
  const isPublic = user.visibility === 'public'
  const shelfIsPublic = user.shelfVisibility === 'public'
  if (!isOwner && !isPublic) {
    return NextResponse.json({ private: true, user: { id: user.id, pseudo: user.pseudo } })
  }

  const notesCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(tastingNotes)
    .where(eq(tastingNotes.userId, user.id))

  const followersCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(follows)
    .leftJoin(
      users,
      isMysql ? sql`binary ${users.id} = binary ${follows.followerId}` : eq(users.id, follows.followerId)
    )
    .where(and(
      eq(follows.followedId, user.id),
      isMysql ? sql`binary ${users.visibility} = 'public'` : eq(users.visibility, 'public')
    ))

  const followingCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(follows)
    .leftJoin(
      users,
      isMysql ? sql`binary ${users.id} = binary ${follows.followedId}` : eq(users.id, follows.followedId)
    )
    .where(and(
      eq(follows.followerId, user.id),
      isMysql ? sql`binary ${users.visibility} = 'public'` : eq(users.visibility, 'public')
    ))

  const shelfCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(userShelf)
    .where(eq(userShelf.userId, user.id))

  let isFollowing = false
  if (!isOwner) {
    const followRes = await db
      .select({ followerId: follows.followerId })
      .from(follows)
      .where(and(eq(follows.followerId, viewerId), eq(follows.followedId, user.id)))
      .limit(1)
    isFollowing = followRes.length > 0
  }

  return NextResponse.json({
    user: {
      id: user.id,
      pseudo: user.pseudo,
      visibility: user.visibility,
      shelfVisibility: user.shelfVisibility || 'private',
    },
    isOwner,
    isFollowing,
    counts: {
      notes: Number(notesCountRes?.[0]?.count || 0),
      shelf: isOwner || shelfIsPublic ? Number(shelfCountRes?.[0]?.count || 0) : 0,
      followers: Number(followersCountRes?.[0]?.count || 0),
      following: Number(followingCountRes?.[0]?.count || 0),
    },
  })
}
