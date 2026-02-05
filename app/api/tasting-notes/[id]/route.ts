import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, tastingNotes, tastingNoteTags } from '@/lib/db'
import { and, eq } from 'drizzle-orm'

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

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = context.params.id
  const body = await request.json()
  const tastingDate = String(body?.tastingDate || '').trim()
  const overall = String(body?.overall || '').trim()
  const rating = Number(body?.rating || 0)
  const location = body?.location ? String(body.location).trim() : null
  const latitude = body?.latitude ? Number(body.latitude) : null
  const longitude = body?.longitude ? Number(body.longitude) : null
  const country = body?.country ? String(body.country).trim() : null
  const city = body?.city ? String(body.city).trim() : null
  const tags = (body?.tags || {}) as TagsPayload

  if (!tastingDate || !overall) {
    return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
  }
  if (rating < 1 || rating > 10) {
    return NextResponse.json({ error: 'Rating invalide' }, { status: 400 })
  }

  const existing = await db
    .select({ id: tastingNotes.id })
    .from(tastingNotes)
    .where(and(eq(tastingNotes.id, id), eq(tastingNotes.userId, userId)))
    .limit(1)

  if (existing.length === 0) {
    return NextResponse.json({ error: 'Note introuvable' }, { status: 404 })
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
  ;['nose', 'palate', 'finish'].forEach((type) => {
    const list = normalizeTagIds((tags as any)[type])
    list.forEach((tagId: string) => {
      relations.push({ noteId: id, tagId, type })
    })
  })
  if (relations.length > 0) {
    await db.insert(tastingNoteTags).values(relations)
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(_request: NextRequest, context: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = context.params.id

  const existing = await db
    .select({ id: tastingNotes.id })
    .from(tastingNotes)
    .where(and(eq(tastingNotes.id, id), eq(tastingNotes.userId, userId)))
    .limit(1)

  if (existing.length === 0) {
    return NextResponse.json({ error: 'Note introuvable' }, { status: 404 })
  }

  await db.delete(tastingNoteTags).where(eq(tastingNoteTags.noteId, id))
  await db.delete(tastingNotes).where(eq(tastingNotes.id, id))

  return NextResponse.json({ success: true })
}
