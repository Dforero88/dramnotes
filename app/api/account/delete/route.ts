import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import {
  activities,
  db,
  follows,
  isMysql,
  tastingNotes,
  tastingNoteTags,
  userAromaProfile,
  userEngagementEmails,
  userShelf,
  users,
  userTagStats,
  whiskies,
} from '@/lib/db'
import { recomputeWhiskyAnalytics } from '@/lib/whisky-analytics'
import { captureBusinessEvent } from '@/lib/sentry-business'

export const runtime = 'nodejs'

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

  const runDeleteTransactionAsync = async (qx: any) => {
    await qx.update(whiskies).set({ addedById: null }).where(eq(whiskies.addedById, userId))

    if (noteIds.length > 0) {
      for (const noteId of noteIds) {
        await qx.delete(tastingNoteTags).where(eq(tastingNoteTags.noteId, noteId))
      }
    }

    await qx.delete(tastingNotes).where(eq(tastingNotes.userId, userId))
    await qx.delete(userShelf).where(eq(userShelf.userId, userId))
    await qx.delete(follows).where(eq(follows.followerId, userId))
    await qx.delete(follows).where(eq(follows.followedId, userId))
    await qx.delete(activities).where(eq(activities.userId, userId))
    await qx.delete(activities).where(and(eq(activities.type, 'new_follow'), eq(activities.targetId, userId)))
    await qx.delete(userTagStats).where(eq(userTagStats.userId, userId))
    await qx.delete(userAromaProfile).where(eq(userAromaProfile.userId, userId))
    await qx.delete(userEngagementEmails).where(eq(userEngagementEmails.userId, userId))
    await qx.delete(users).where(eq(users.id, userId))
  }

  if (isMysql) {
    await db.transaction(async (tx: any) => {
      await runDeleteTransactionAsync(tx)
    })
  } else {
    db.transaction((tx: any) => {
      tx.update(whiskies).set({ addedById: null }).where(eq(whiskies.addedById, userId)).run()

      if (noteIds.length > 0) {
        for (const noteId of noteIds) {
          tx.delete(tastingNoteTags).where(eq(tastingNoteTags.noteId, noteId)).run()
        }
      }

      tx.delete(tastingNotes).where(eq(tastingNotes.userId, userId)).run()
      tx.delete(userShelf).where(eq(userShelf.userId, userId)).run()
      tx.delete(follows).where(eq(follows.followerId, userId)).run()
      tx.delete(follows).where(eq(follows.followedId, userId)).run()
      tx.delete(activities).where(eq(activities.userId, userId)).run()
      tx.delete(activities).where(and(eq(activities.type, 'new_follow'), eq(activities.targetId, userId))).run()
      tx.delete(userTagStats).where(eq(userTagStats.userId, userId)).run()
      tx.delete(userAromaProfile).where(eq(userAromaProfile.userId, userId)).run()
      tx.delete(userEngagementEmails).where(eq(userEngagementEmails.userId, userId)).run()
      tx.delete(users).where(eq(users.id, userId)).run()
    })
  }

  await captureBusinessEvent('account_deleted', {
    level: 'warning',
    tags: { userId },
    extra: {
      notesDeleted: noteIds.length,
      impactedWhiskies: impactedWhiskyIds.length,
    },
  })

  for (const whiskyId of impactedWhiskyIds as string[]) {
    await recomputeWhiskyAnalytics(whiskyId)
  }

  return NextResponse.json({ success: true })
}
