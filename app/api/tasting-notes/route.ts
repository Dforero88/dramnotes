import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, tastingNotes, tastingNoteTags, activities } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { generateId } from '@/lib/db'
import { recomputeWhiskyAnalytics } from '@/lib/whisky-analytics'
import { recomputeUserAroma } from '@/lib/user-aroma'
import { validateLocation, validateOverall, validateDisplayName } from '@/lib/moderation'
import * as Sentry from '@sentry/nextjs'
import { buildRateLimitKey, rateLimit } from '@/lib/rate-limit'

type TagsPayload = {
  nose?: Array<string | { id: string }>
  palate?: Array<string | { id: string }>
  finish?: Array<string | { id: string }>
}

function normalizeTagIds(list: Array<string | { id: string }> | undefined) {
  if (!Array.isArray(list)) return []
  return list
    .map((t) => (typeof t === 'string' ? t : t?.id))
    .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limit = rateLimit(request, {
    key: buildRateLimitKey(request, userId, 'tasting-notes-create'),
    windowMs: 60 * 60 * 1000,
    max: 20,
  })
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Trop de requêtes. Réessayez plus tard.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  const body = await request.json()
  const whiskyId = String(body?.whiskyId || '').trim()
  const tastingDate = String(body?.tastingDate || '').trim()
  const overallRaw = String(body?.overall || '').trim()
  const rating = Number(body?.rating || 0)
  const locationRaw = body?.location ? String(body.location).trim() : ''
  const latitude = body?.latitude ? Number(body.latitude) : null
  const longitude = body?.longitude ? Number(body.longitude) : null
  const countryRaw = body?.country ? String(body.country).trim() : ''
  const cityRaw = body?.city ? String(body.city).trim() : ''
  const tags = (body?.tags || {}) as TagsPayload

  if (!whiskyId || !tastingDate) {
    return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
  }
  if (!overallRaw) {
    return NextResponse.json({ error: 'Overall requis' }, { status: 400 })
  }
  if (rating < 1 || rating > 10) {
    return NextResponse.json({ error: 'Rating invalide' }, { status: 400 })
  }

  const overallCheck = await validateOverall(overallRaw)
  if (!overallCheck.ok) {
    return NextResponse.json({ error: overallCheck.message || 'Overall invalide' }, { status: 400 })
  }
  const locationCheck = await validateLocation(locationRaw)
  if (!locationCheck.ok) {
    return NextResponse.json({ error: locationCheck.message || 'Location invalide' }, { status: 400 })
  }
  const overall = overallCheck.value
  const location = locationCheck.value

  let country: string | null = null
  if (countryRaw) {
    const check = await validateDisplayName(countryRaw, 80)
    if (!check.ok) {
      return NextResponse.json({ error: check.message || 'Pays invalide' }, { status: 400 })
    }
    country = check.value
  }

  let city: string | null = null
  if (cityRaw) {
    const check = await validateDisplayName(cityRaw, 80)
    if (!check.ok) {
      return NextResponse.json({ error: check.message || 'Ville invalide' }, { status: 400 })
    }
    city = check.value
  }

  const existing = await db
    .select({ id: tastingNotes.id })
    .from(tastingNotes)
    .where(and(eq(tastingNotes.whiskyId, whiskyId), eq(tastingNotes.userId, userId)))
    .limit(1)

  if (existing.length > 0) {
    return NextResponse.json({ error: 'Note déjà existante' }, { status: 409 })
  }

  const id = generateId()
  const now = new Date()
  await db.insert(tastingNotes).values({
    id,
    whiskyId,
    userId,
    tastingDate,
    location,
    latitude,
    longitude,
    country,
    city,
    overall,
    rating,
    createdAt: now,
    updatedAt: now,
  })

  const relations: any[] = []
  ;['nose', 'palate', 'finish'].forEach((type) => {
    const list = normalizeTagIds((tags as any)[type])
    list.forEach((tagId: string) => {
      relations.push({ noteId: id, tagId, type })
    })
  })
  if (relations.length > 0) {
    await db.insert(tastingNoteTags).values(relations)
  }

  await db.insert(activities).values({
    id: generateId(),
    userId,
    type: 'new_note',
    targetId: whiskyId,
    createdAt: now,
  } as any)

  await recomputeWhiskyAnalytics(whiskyId)
  await recomputeUserAroma(userId)

  Sentry.captureMessage('tasting_note_created', {
    level: 'info',
    tags: { userId, whiskyId },
  })

  return NextResponse.json({ success: true, id })
}
