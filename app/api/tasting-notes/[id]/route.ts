import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, tastingNotes, tastingNoteTags } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { recomputeWhiskyAnalytics } from '@/lib/whisky-analytics'
import { recomputeUserAroma } from '@/lib/user-aroma'
import { validateLocation, validateOverall, validateDisplayName } from '@/lib/moderation'
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

function apiError(code: string, message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ errorCode: code, error: message, ...(extra || {}) }, { status })
}

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  const limit = rateLimit(request, {
    key: buildRateLimitKey(request, userId, 'tasting-notes-update'),
    windowMs: 60 * 60 * 1000,
    max: 30,
  })
  if (!limit.ok) {
    return NextResponse.json(
      { errorCode: 'RATE_LIMIT', error: 'Trop de requêtes. Réessayez plus tard.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  const id = context.params.id
  const body = await request.json()
  const tastingDate = String(body?.tastingDate || '').trim()
  const overallRaw = String(body?.overall || '').trim()
  const rating = Number(body?.rating || 0)
  const locationRaw = body?.location ? String(body.location).trim() : ''
  const latitude = body?.latitude ? Number(body.latitude) : null
  const longitude = body?.longitude ? Number(body.longitude) : null
  const countryRaw = body?.country ? String(body.country).trim() : ''
  const cityRaw = body?.city ? String(body.city).trim() : ''
  const tags = (body?.tags || {}) as TagsPayload

  if (!tastingDate || !overallRaw) {
    return apiError('MISSING_REQUIRED_FIELDS', 'Données manquantes', 400)
  }
  if (!locationRaw) {
    return apiError('LOCATION_REQUIRED', 'Lieu requis', 400)
  }
  if (rating < 1 || rating > 10) {
    return apiError('RATING_INVALID', 'Rating invalide', 400)
  }
  const noseTagIds = normalizeTagIds(tags.nose)
  const palateTagIds = normalizeTagIds(tags.palate)
  const finishTagIds = normalizeTagIds(tags.finish)
  if (noseTagIds.length === 0 || palateTagIds.length === 0 || finishTagIds.length === 0) {
    return apiError('TAGS_REQUIRED_ALL_SECTIONS', 'Au moins un tag par section est requis', 400)
  }

  const overallCheck = await validateOverall(overallRaw)
  if (!overallCheck.ok) {
    return apiError('OVERALL_INVALID', overallCheck.message || 'Overall invalide', 400)
  }
  const locationCheck = await validateLocation(locationRaw)
  if (!locationCheck.ok) {
    return apiError('LOCATION_INVALID', locationCheck.message || 'Location invalide', 400)
  }
  const overall = overallCheck.value
  const location = locationCheck.value

  let country: string | null = null
  if (countryRaw) {
    const check = await validateDisplayName(countryRaw, 80)
    if (!check.ok) {
      return apiError('COUNTRY_INVALID', check.message || 'Pays invalide', 400)
    }
    country = check.value
  }

  let city: string | null = null
  if (cityRaw) {
    const check = await validateDisplayName(cityRaw, 80)
    if (!check.ok) {
      return apiError('CITY_INVALID', check.message || 'Ville invalide', 400)
    }
    city = check.value
  }

  const existing = await db
    .select({ id: tastingNotes.id, whiskyId: tastingNotes.whiskyId })
    .from(tastingNotes)
    .where(and(eq(tastingNotes.id, id), eq(tastingNotes.userId, userId)))
    .limit(1)

  if (existing.length === 0) {
    return apiError('NOTE_NOT_FOUND', 'Note introuvable', 404)
  }

  await db.update(tastingNotes).set({
    tastingDate,
    location,
    latitude,
    longitude,
    country,
    city,
    overall,
    rating,
    updatedAt: new Date(),
  }).where(eq(tastingNotes.id, id))

  await db.delete(tastingNoteTags).where(eq(tastingNoteTags.noteId, id))
  const relations: any[] = []
  noseTagIds.forEach((tagId: string) => relations.push({ noteId: id, tagId, type: 'nose' }))
  palateTagIds.forEach((tagId: string) => relations.push({ noteId: id, tagId, type: 'palate' }))
  finishTagIds.forEach((tagId: string) => relations.push({ noteId: id, tagId, type: 'finish' }))
  if (relations.length > 0) {
    await db.insert(tastingNoteTags).values(relations)
  }

  await recomputeWhiskyAnalytics(existing[0].whiskyId)
  await recomputeUserAroma(userId)

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest, context: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  const limit = rateLimit(request, {
    key: buildRateLimitKey(request, userId, 'tasting-notes-delete'),
    windowMs: 60 * 60 * 1000,
    max: 30,
  })
  if (!limit.ok) {
    return NextResponse.json(
      { errorCode: 'RATE_LIMIT', error: 'Trop de requêtes. Réessayez plus tard.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  const id = context.params.id

  const existing = await db
    .select({ id: tastingNotes.id, whiskyId: tastingNotes.whiskyId })
    .from(tastingNotes)
    .where(and(eq(tastingNotes.id, id), eq(tastingNotes.userId, userId)))
    .limit(1)

  if (existing.length === 0) {
    return apiError('NOTE_NOT_FOUND', 'Note introuvable', 404)
  }

  await db.delete(tastingNoteTags).where(eq(tastingNoteTags.noteId, id))
  await db.delete(tastingNotes).where(eq(tastingNotes.id, id))

  await recomputeWhiskyAnalytics(existing[0].whiskyId)
  await recomputeUserAroma(userId)

  return NextResponse.json({ success: true })
}
