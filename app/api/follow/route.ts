import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, follows, users, isMysql, activities } from '@/lib/db'
import crypto from 'crypto'
import { and, eq, sql } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { targetUserId } = await request.json().catch(() => ({}))
  if (!targetUserId || typeof targetUserId !== 'string') {
    return NextResponse.json({ error: 'Invalid user' }, { status: 400 })
  }

  const currentUserId = session.user.id
  if (currentUserId === targetUserId) {
    return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })
  }

  const publicUser = await db
    .select({ id: users.id })
    .from(users)
    .where(and(
      eq(users.id, targetUserId),
      isMysql ? sql`binary ${users.visibility} = 'public'` : eq(users.visibility, 'public')
    ))
    .limit(1)

  if (!publicUser?.length) {
    return NextResponse.json({ error: 'User not public' }, { status: 403 })
  }

  const existing = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(and(
      eq(follows.followerId, currentUserId),
      eq(follows.followedId, targetUserId)
    ))
    .limit(1)

  if (existing.length > 0) {
    await db.delete(follows).where(and(
      eq(follows.followerId, currentUserId),
      eq(follows.followedId, targetUserId)
    ))
    return NextResponse.json({ following: false })
  }

  await db.insert(follows).values({
    followerId: currentUserId,
    followedId: targetUserId,
  } as any)

  await db.insert(activities).values({
    id: crypto.randomUUID(),
    userId: currentUserId,
    type: 'new_follow',
    targetId: targetUserId,
  } as any)

  return NextResponse.json({ following: true })
}
