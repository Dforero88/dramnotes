import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, tastingNotes, tastingNoteTags } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { generateId } from '@/lib/db'

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

  const body = await request.json()
  const whiskyId = String(body?.whiskyId || '').trim()
  const tastingDate = String(body?.tastingDate || '').trim()
  const overall = String(body?.overall || '').trim()
  const rating = Number(body?.rating || 0)
  const location = body?.location ? String(body.location).trim() : null
  const latitude = body?.latitude ? Number(body.latitude) : null
  const longitude = body?.longitude ? Number(body.longitude) : null
  const country = body?.country ? String(body.country).trim() : null
  const city = body?.city ? String(body.city).trim() : null
  const tags = (body?.tags || {}) as TagsPayload

  if (!whiskyId || !tastingDate) {
    return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
  }
  if (!overall) {
    return NextResponse.json({ error: 'Overall requis' }, { status: 400 })
  }
  if (rating < 1 || rating > 10) {
    return NextResponse.json({ error: 'Rating invalide' }, { status: 400 })
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

  return NextResponse.json({ success: true, id })
}
