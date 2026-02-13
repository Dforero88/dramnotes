import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { and, eq, gt } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import { buildRateLimitKey, rateLimit } from '@/lib/rate-limit'
import { activities, db, generateId, userShelf } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUSES = new Set(['wishlist', 'owned_unopened', 'owned_opened', 'finished', 'none'])

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const whiskyId = request.nextUrl.searchParams.get('whiskyId')?.trim()
  if (!whiskyId) {
    return NextResponse.json({ error: 'whiskyId missing' }, { status: 400 })
  }

  const rows = await db
    .select({ status: userShelf.status })
    .from(userShelf)
    .where(and(eq(userShelf.userId, session.user.id), eq(userShelf.whiskyId, whiskyId)))
    .limit(1)

  return NextResponse.json({ status: rows?.[0]?.status || 'none' })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limit = rateLimit(request, {
    key: buildRateLimitKey(request, session.user.id, 'shelf-status'),
    windowMs: 60_000,
    max: 60,
  })
  if (!limit.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const body = await request.json()
  const whiskyId = String(body?.whiskyId || '').trim()
  const status = String(body?.status || 'none').trim()

  if (!whiskyId) {
    return NextResponse.json({ error: 'whiskyId missing' }, { status: 400 })
  }
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const existing = await db
    .select({ id: userShelf.id })
    .from(userShelf)
    .where(and(eq(userShelf.userId, session.user.id), eq(userShelf.whiskyId, whiskyId)))
    .limit(1)

  if (status === 'none') {
    if (existing.length) {
      await db.delete(userShelf).where(eq(userShelf.id, existing[0].id))
    }
    return NextResponse.json({ success: true, status: 'none' })
  }

  if (existing.length) {
    await db
      .update(userShelf)
      .set({ status, updatedAt: new Date() })
      .where(eq(userShelf.id, existing[0].id))
  } else {
    await db.insert(userShelf).values({
      id: generateId(),
      userId: session.user.id,
      whiskyId,
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Activity only when whisky is added to shelf (none -> status), deduped over last 24h.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recent = await db
      .select({ id: activities.id })
      .from(activities)
      .where(
        and(
          eq(activities.userId, session.user.id),
          eq(activities.type, 'shelf_add'),
          eq(activities.targetId, whiskyId),
          gt(activities.createdAt, since),
        )
      )
      .limit(1)

    if (recent.length === 0) {
      await db.insert(activities).values({
        id: generateId(),
        userId: session.user.id,
        type: 'shelf_add',
        targetId: whiskyId,
        createdAt: new Date(),
      })
    }
  }

  return NextResponse.json({ success: true, status })
}
