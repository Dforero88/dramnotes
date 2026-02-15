import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import {
  activities,
  db,
  follows,
  tastingNotes,
  tastingNoteTags,
  userAromaProfile,
  userShelf,
  users,
  userTagStats,
  whiskies,
} from '@/lib/db'
import { recomputeWhiskyAnalytics } from '@/lib/whisky-analytics'
import * as Sentry from '@sentry/nextjs'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const password = String(body?.password || '')
  if (!password) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 })
  }

  const userRows = await db
    .select({ id: users.id, password: users.password })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const user = userRows?.[0]
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const passwordOk = await bcrypt.compare(password, user.password)
  if (!passwordOk) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 400 })
  }

  const userNoteRows = await db
    .select({ id: tastingNotes.id, whiskyId: tastingNotes.whiskyId })
    .from(tastingNotes)
    .where(eq(tastingNotes.userId, userId))

  const impactedWhiskyIds = Array.from(new Set((userNoteRows as { id: string; whiskyId: string }[]).map((row) => row.whiskyId)))
  const noteIds = (userNoteRows as { id: string; whiskyId: string }[]).map((row) => row.id)

  await db.update(whiskies).set({ addedById: null }).where(eq(whiskies.addedById, userId))

  if (noteIds.length > 0) {
    for (const noteId of noteIds) {
      await db.delete(tastingNoteTags).where(eq(tastingNoteTags.noteId, noteId))
    }
  }

  await db.delete(tastingNotes).where(eq(tastingNotes.userId, userId))
  await db.delete(userShelf).where(eq(userShelf.userId, userId))
  await db.delete(follows).where(eq(follows.followerId, userId))
  await db.delete(follows).where(eq(follows.followedId, userId))
  await db.delete(activities).where(eq(activities.userId, userId))
  await db.delete(activities).where(and(eq(activities.type, 'new_follow'), eq(activities.targetId, userId)))
  await db.delete(userTagStats).where(eq(userTagStats.userId, userId))
  await db.delete(userAromaProfile).where(eq(userAromaProfile.userId, userId))

  Sentry.captureMessage('account_deleted', {
    level: 'warning',
    tags: { userId },
    extra: {
      notesDeleted: noteIds.length,
      impactedWhiskies: impactedWhiskyIds.length,
    },
  })

  await db.delete(users).where(eq(users.id, userId))

  for (const whiskyId of impactedWhiskyIds as string[]) {
    await recomputeWhiskyAnalytics(whiskyId)
  }

  return NextResponse.json({ success: true })
}
