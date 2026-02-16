import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, tastingNotes, tastingNoteTags, activities, users } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { generateId } from '@/lib/db'
import { recomputeWhiskyAnalytics } from '@/lib/whisky-analytics'
import { recomputeUserAroma } from '@/lib/user-aroma'
import { validateLocation, validateOverall, validateDisplayName } from '@/lib/moderation'
import * as Sentry from '@sentry/nextjs'
import { buildRateLimitKey, rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

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

type NoteStatus = 'draft' | 'published'

function getRequestedStatus(value: unknown): NoteStatus {
  return value === 'draft' ? 'draft' : 'published'
}

async function parseAndValidatePayload(body: any, targetStatus: NoteStatus, userVisibility: 'public' | 'private') {
  const whiskyId = String(body?.whiskyId || '').trim()
  const tastingDateRaw = String(body?.tastingDate || '').trim()
  const tastingDate = tastingDateRaw || new Date().toISOString().slice(0, 10)
  const overallRaw = String(body?.overall || '').trim()
  const ratingRaw = body?.rating
  const ratingNumber = ratingRaw === null || ratingRaw === undefined || ratingRaw === '' ? null : Number(ratingRaw)
  const locationRaw = body?.location ? String(body.location).trim() : ''
  const latitude = body?.latitude ? Number(body.latitude) : null
  const longitude = body?.longitude ? Number(body.longitude) : null
  const countryRaw = body?.country ? String(body.country).trim() : ''
  const cityRaw = body?.city ? String(body.city).trim() : ''
  const tags = (body?.tags || {}) as TagsPayload
  const requestedLocationVisibility = body?.locationVisibility === 'public_precise' ? 'public_precise' : 'public_city'
  const locationVisibility = userVisibility === 'public' ? requestedLocationVisibility : 'public_city'

  if (!whiskyId) {
    return { error: apiError('MISSING_REQUIRED_FIELDS', 'Données manquantes', 400) }
  }

  const noseTagIds = normalizeTagIds(tags.nose)
  const palateTagIds = normalizeTagIds(tags.palate)
  const finishTagIds = normalizeTagIds(tags.finish)

  if (targetStatus === 'published') {
    if (!tastingDate || !locationRaw || !overallRaw) {
      return { error: apiError('MISSING_REQUIRED_FIELDS', 'Données manquantes', 400) }
    }
    if (ratingNumber === null || ratingNumber < 1 || ratingNumber > 10) {
      return { error: apiError('RATING_INVALID', 'Rating invalide', 400) }
    }
    if (noseTagIds.length === 0 || palateTagIds.length === 0 || finishTagIds.length === 0) {
      return { error: apiError('TAGS_REQUIRED_ALL_SECTIONS', 'Au moins un tag par section est requis', 400) }
    }
  } else if (ratingNumber !== null && (ratingNumber < 1 || ratingNumber > 10)) {
    return { error: apiError('RATING_INVALID', 'Rating invalide', 400) }
  }

  let overall: string | null = null
  if (overallRaw) {
    const overallCheck = await validateOverall(overallRaw)
    if (!overallCheck.ok) {
      return { error: apiError('OVERALL_INVALID', overallCheck.message || 'Overall invalide', 400) }
    }
    overall = overallCheck.value
  } else if (targetStatus === 'published') {
    return { error: apiError('OVERALL_REQUIRED', 'Overall requis', 400) }
  }

  let location: string | null = null
  if (locationRaw) {
    const locationCheck = await validateLocation(locationRaw)
    if (!locationCheck.ok) {
      return { error: apiError('LOCATION_INVALID', locationCheck.message || 'Location invalide', 400) }
    }
    location = locationCheck.value
  } else if (targetStatus === 'published') {
    return { error: apiError('LOCATION_REQUIRED', 'Lieu requis', 400) }
  }

  let country: string | null = null
  if (countryRaw) {
    const check = await validateDisplayName(countryRaw, 80)
    if (!check.ok) {
      return { error: apiError('COUNTRY_INVALID', check.message || 'Pays invalide', 400) }
    }
    country = check.value
  }

  let city: string | null = null
  if (cityRaw) {
    const check = await validateDisplayName(cityRaw, 80)
    if (!check.ok) {
      return { error: apiError('CITY_INVALID', check.message || 'Ville invalide', 400) }
    }
    city = check.value
  }

  return {
    payload: {
      whiskyId,
      tastingDate,
      location,
      locationVisibility,
      latitude,
      longitude,
      country,
      city,
      overall,
      rating: ratingNumber,
      tags: { noseTagIds, palateTagIds, finishTagIds },
    },
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }

  const limit = rateLimit(request, {
    key: buildRateLimitKey(request, userId, 'tasting-notes-create'),
    windowMs: 60 * 60 * 1000,
    max: 20,
  })
  if (!limit.ok) {
    return NextResponse.json(
      { errorCode: 'RATE_LIMIT', error: 'Trop de requêtes. Réessayez plus tard.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  const body = await request.json()
  const status = getRequestedStatus(body?.status)
  const userRows = await db
    .select({ visibility: users.visibility })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  const userVisibility = (userRows?.[0]?.visibility === 'public' ? 'public' : 'private') as 'public' | 'private'
  const parsed = await parseAndValidatePayload(body, status, userVisibility)
  if ('error' in parsed) return parsed.error
  const { payload } = parsed

  const existing = await db
    .select({ id: tastingNotes.id, status: tastingNotes.status })
    .from(tastingNotes)
    .where(and(eq(tastingNotes.whiskyId, payload.whiskyId), eq(tastingNotes.userId, userId)))
    .limit(1)

  if (existing.length > 0) {
    const existingNote = existing[0]
    if (existingNote.status === 'published') {
      return apiError('NOTE_ALREADY_EXISTS', 'Note déjà existante', 409)
    }
    if (status === 'draft') {
      await db.update(tastingNotes).set({
        status,
        tastingDate: payload.tastingDate,
        location: payload.location,
        locationVisibility: payload.locationVisibility,
        latitude: payload.latitude,
        longitude: payload.longitude,
        country: payload.country,
        city: payload.city,
        overall: payload.overall,
        rating: payload.rating,
        updatedAt: new Date(),
      }).where(eq(tastingNotes.id, existingNote.id))

      await db.delete(tastingNoteTags).where(eq(tastingNoteTags.noteId, existingNote.id))
      const relations: any[] = []
      payload.tags.noseTagIds.forEach((tagId: string) => relations.push({ noteId: existingNote.id, tagId, type: 'nose' }))
      payload.tags.palateTagIds.forEach((tagId: string) => relations.push({ noteId: existingNote.id, tagId, type: 'palate' }))
      payload.tags.finishTagIds.forEach((tagId: string) => relations.push({ noteId: existingNote.id, tagId, type: 'finish' }))
      if (relations.length > 0) {
        await db.insert(tastingNoteTags).values(relations)
      }
      return NextResponse.json({ success: true, id: existingNote.id, status: 'draft', created: false })
    }

    // Publish existing draft
    await db.update(tastingNotes).set({
      status: 'published',
      tastingDate: payload.tastingDate,
      location: payload.location,
      locationVisibility: payload.locationVisibility,
      latitude: payload.latitude,
      longitude: payload.longitude,
      country: payload.country,
      city: payload.city,
      overall: payload.overall,
      rating: payload.rating,
      updatedAt: new Date(),
    }).where(eq(tastingNotes.id, existingNote.id))

    await db.delete(tastingNoteTags).where(eq(tastingNoteTags.noteId, existingNote.id))
    const relations: any[] = []
    payload.tags.noseTagIds.forEach((tagId: string) => relations.push({ noteId: existingNote.id, tagId, type: 'nose' }))
    payload.tags.palateTagIds.forEach((tagId: string) => relations.push({ noteId: existingNote.id, tagId, type: 'palate' }))
    payload.tags.finishTagIds.forEach((tagId: string) => relations.push({ noteId: existingNote.id, tagId, type: 'finish' }))
    if (relations.length > 0) {
      await db.insert(tastingNoteTags).values(relations)
    }

    const now = new Date()
    await db.insert(activities).values({
      id: generateId(),
      userId,
      type: 'new_note',
      targetId: payload.whiskyId,
      createdAt: now,
    } as any)

    await recomputeWhiskyAnalytics(payload.whiskyId)
    await recomputeUserAroma(userId)

    const sentryEventId = Sentry.captureMessage('tasting_note_published', {
      level: 'info',
      tags: { userId, whiskyId: payload.whiskyId },
    })
    await Sentry.flush(2000)
    console.info(`[sentry-business] sent "tasting_note_published" (eventId: ${sentryEventId || 'n/a'})`)

    return NextResponse.json({ success: true, id: existingNote.id, status: 'published', created: false, publishedFromDraft: true })
  }

  const id = generateId()
  const now = new Date()
  await db.insert(tastingNotes).values({
    id,
    whiskyId: payload.whiskyId,
    userId,
    status,
    tastingDate: payload.tastingDate,
    location: payload.location,
    locationVisibility: payload.locationVisibility,
    latitude: payload.latitude,
    longitude: payload.longitude,
    country: payload.country,
    city: payload.city,
    overall: payload.overall,
    rating: payload.rating,
    createdAt: now,
    updatedAt: now,
  })

  const relations: any[] = []
  payload.tags.noseTagIds.forEach((tagId: string) => relations.push({ noteId: id, tagId, type: 'nose' }))
  payload.tags.palateTagIds.forEach((tagId: string) => relations.push({ noteId: id, tagId, type: 'palate' }))
  payload.tags.finishTagIds.forEach((tagId: string) => relations.push({ noteId: id, tagId, type: 'finish' }))
  if (relations.length > 0) {
    await db.insert(tastingNoteTags).values(relations)
  }

  if (status === 'published') {
    await db.insert(activities).values({
      id: generateId(),
      userId,
      type: 'new_note',
      targetId: payload.whiskyId,
      createdAt: now,
    } as any)

    await recomputeWhiskyAnalytics(payload.whiskyId)
    await recomputeUserAroma(userId)

    const sentryEventId = Sentry.captureMessage('tasting_note_created', {
      level: 'info',
      tags: { userId, whiskyId: payload.whiskyId },
    })
    await Sentry.flush(2000)
    console.info(`[sentry-business] sent "tasting_note_created" (eventId: ${sentryEventId || 'n/a'})`)
  } else {
    const sentryEventId = Sentry.captureMessage('tasting_note_draft_created', {
      level: 'info',
      tags: { userId, whiskyId: payload.whiskyId },
    })
    await Sentry.flush(2000)
    console.info(`[sentry-business] sent "tasting_note_draft_created" (eventId: ${sentryEventId || 'n/a'})`)
  }

  return NextResponse.json({ success: true, id, status, created: true })
}
