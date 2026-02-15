import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, users, tastingNotes } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const visibility = body?.visibility === 'public' ? 'public' : 'private'
  const shelfVisibility = body?.shelfVisibility === 'public' ? 'public' : 'private'

  const existing = await db
    .select({ visibility: users.visibility })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  const previousVisibility = existing?.[0]?.visibility === 'public' ? 'public' : 'private'

  await db
    .update(users)
    .set({ visibility, shelfVisibility, updatedAt: new Date() })
    .where(eq(users.id, userId))

  if (previousVisibility === 'private' && visibility === 'public') {
    await db
      .update(tastingNotes)
      .set({ locationVisibility: 'public_city', updatedAt: new Date() })
      .where(eq(tastingNotes.userId, userId))
  }

  return NextResponse.json({ success: true })
}
