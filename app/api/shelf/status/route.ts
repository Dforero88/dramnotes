import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { and, eq } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import { buildRateLimitKey, rateLimit } from '@/lib/rate-limit'
import { db, generateId, userShelf } from '@/lib/db'

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
  }

  return NextResponse.json({ success: true, status })
}

