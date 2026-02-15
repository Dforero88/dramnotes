import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, tastingNotes, tastingNoteTags, activities, generateId, users } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { recomputeWhiskyAnalytics } from '@/lib/whisky-analytics'
import { recomputeUserAroma } from '@/lib/user-aroma'
import { validateLocation, validateOverall, validateDisplayName } from '@/lib/moderation'
import { buildRateLimitKey, rateLimit } from '@/lib/rate-limit'
import * as Sentry from '@sentry/nextjs'

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

function normalizeRequestedStatus(value: unknown, fallback: NoteStatus): NoteStatus {
  if (value === 'draft') return 'draft'
  if (value === 'published') return 'published'
  return fallback
}

async function parseAndValidatePayload(body: any, targetStatus: NoteStatus, userVisibility: 'public' | 'private') {
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

  const { id } = await context.params
  const body = await request.json()
  const userRows = await db
    .select({ visibility: users.visibility })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  const userVisibility = (userRows?.[0]?.visibility === 'public' ? 'public' : 'private') as 'public' | 'private'
  const existing = await db
    .select({ id: tastingNotes.id, whiskyId: tastingNotes.whiskyId, status: tastingNotes.status })
    .from(tastingNotes)
    .where(and(eq(tastingNotes.id, id), eq(tastingNotes.userId, userId)))
    .limit(1)

  if (existing.length === 0) {
    return apiError('NOTE_NOT_FOUND', 'Note introuvable', 404)
  }

  const current = existing[0]
  const nextStatus = normalizeRequestedStatus(body?.status, (current.status as NoteStatus) || 'published')
  if (current.status === 'published' && nextStatus === 'draft') {
    return apiError('CANNOT_DOWNGRADE_PUBLISHED', 'Une note publiée ne peut pas redevenir brouillon', 400)
  }

  const parsed = await parseAndValidatePayload(body, nextStatus, userVisibility)
  if ('error' in parsed) return parsed.error
  const { payload } = parsed

  await db.update(tastingNotes).set({
    status: nextStatus,
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
  }).where(eq(tastingNotes.id, id))

  await db.delete(tastingNoteTags).where(eq(tastingNoteTags.noteId, id))
  const relations: any[] = []
  payload.tags.noseTagIds.forEach((tagId: string) => relations.push({ noteId: id, tagId, type: 'nose' }))
  payload.tags.palateTagIds.forEach((tagId: string) => relations.push({ noteId: id, tagId, type: 'palate' }))
  payload.tags.finishTagIds.forEach((tagId: string) => relations.push({ noteId: id, tagId, type: 'finish' }))
  if (relations.length > 0) {
    await db.insert(tastingNoteTags).values(relations)
  }

  if (current.status !== 'published' && nextStatus === 'published') {
    await db.insert(activities).values({
      id: generateId(),
      userId,
      type: 'new_note',
      targetId: current.whiskyId,
      createdAt: new Date(),
    } as any)
  }

  if (current.status === 'published' || nextStatus === 'published') {
    await recomputeWhiskyAnalytics(current.whiskyId)
    await recomputeUserAroma(userId)
  }

  if (current.status !== 'published' && nextStatus === 'published') {
    Sentry.captureMessage('tasting_note_published', {
      level: 'info',
      tags: { userId, whiskyId: current.whiskyId },
    })
  }

  return NextResponse.json({
    success: true,
    status: nextStatus,
    publishedFromDraft: current.status !== 'published' && nextStatus === 'published',
  })
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

  const { id } = await context.params

  const existing = await db
    .select({ id: tastingNotes.id, whiskyId: tastingNotes.whiskyId, status: tastingNotes.status })
    .from(tastingNotes)
    .where(and(eq(tastingNotes.id, id), eq(tastingNotes.userId, userId)))
    .limit(1)

  if (existing.length === 0) {
    return apiError('NOTE_NOT_FOUND', 'Note introuvable', 404)
  }

  await db.delete(tastingNoteTags).where(eq(tastingNoteTags.noteId, id))
  await db.delete(tastingNotes).where(eq(tastingNotes.id, id))
  if (existing[0].status === 'published') {
    await db
      .delete(activities)
      .where(
        and(
          eq(activities.userId, userId),
          eq(activities.targetId, existing[0].whiskyId),
          eq(activities.type, 'new_note')
        )
      )

    await recomputeWhiskyAnalytics(existing[0].whiskyId)
    await recomputeUserAroma(userId)
  } else {
    Sentry.captureMessage('tasting_note_draft_deleted', {
      level: 'info',
      tags: { userId, whiskyId: existing[0].whiskyId },
    })
  }

  return NextResponse.json({ success: true, deletedStatus: existing[0].status })
}
