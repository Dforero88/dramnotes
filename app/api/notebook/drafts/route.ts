import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, users, tastingNotes, whiskies, distillers, bottlers, countries, tastingNoteTags, isMysql } from '@/lib/db'
import { and, eq, inArray, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const lang = (searchParams.get('lang') || 'fr').trim()
  const page = Math.max(1, Number(searchParams.get('page') || '1'))
  const pageSize = Math.max(1, Math.min(24, Number(searchParams.get('pageSize') || '12')))
  const offset = (page - 1) * pageSize
  const sort = (searchParams.get('sort') || 'updated_desc').trim()

  if (!userId) {
    return NextResponse.json({ error: 'userId missing' }, { status: 400 })
  }

  const userRows = await db
    .select()
    .from(users)
    .where(isMysql ? sql`binary ${users.id} = binary ${userId}` : eq(users.id, userId))
    .limit(1)
  const user = userRows?.[0]
  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const isOwner = user.id === session.user.id
  if (!isOwner) {
    return NextResponse.json({ error: 'Private' }, { status: 403 })
  }

  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(tastingNotes)
    .where(and(eq(tastingNotes.userId, user.id), eq(tastingNotes.status, 'draft')))
  const total = Number(countRes?.[0]?.count || 0)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  let orderBy = sql`${tastingNotes.updatedAt} desc`
  if (sort === 'updated_asc') {
    orderBy = sql`${tastingNotes.updatedAt} asc`
  } else if (sort === 'name_asc') {
    orderBy = sql`lower(${whiskies.name}) asc`
  } else if (sort === 'name_desc') {
    orderBy = sql`lower(${whiskies.name}) desc`
  }

  const notes = await db
    .select({
      id: tastingNotes.id,
      tastingDate: tastingNotes.tastingDate,
      rating: tastingNotes.rating,
      location: tastingNotes.location,
      overall: tastingNotes.overall,
      updatedAt: tastingNotes.updatedAt,
      whiskyId: whiskies.id,
      whiskySlug: whiskies.slug,
      whiskyName: whiskies.name,
      distillerName: distillers.name,
      bottlerName: bottlers.name,
      bottlingType: whiskies.bottlingType,
      type: whiskies.type,
      countryName: countries.name,
      countryNameFr: countries.nameFr,
      bottleImageUrl: sql<string>`coalesce(${whiskies.bottleImageUrl}, ${whiskies.imageUrl})`,
    })
    .from(tastingNotes)
    .leftJoin(
      whiskies,
      isMysql ? sql`binary ${tastingNotes.whiskyId} = binary ${whiskies.id}` : eq(tastingNotes.whiskyId, whiskies.id)
    )
    .leftJoin(distillers, eq(whiskies.distillerId, distillers.id))
    .leftJoin(bottlers, eq(whiskies.bottlerId, bottlers.id))
    .leftJoin(countries, eq(whiskies.countryId, countries.id))
    .where(and(
      isMysql ? sql`binary ${tastingNotes.userId} = binary ${user.id}` : eq(tastingNotes.userId, user.id),
      eq(tastingNotes.status, 'draft')
    ))
    .orderBy(orderBy)
    .limit(pageSize)
    .offset(offset)

  type NoteRow = {
    id: string
    tastingDate: string
    rating: number | null
    location: string | null
    overall: string | null
    updatedAt: Date | string | number | null
    whiskyId: string
    whiskySlug: string | null
    whiskyName: string | null
    distillerName: string | null
    bottlerName: string | null
    bottlingType: string | null
    type: string | null
    countryName: string | null
    countryNameFr: string | null
    bottleImageUrl: string | null
  }

  const noteIds = (notes as NoteRow[]).map((n: NoteRow) => n.id)
  let tags: { noteId: string; type: string; count: number }[] = []
  if (noteIds.length > 0) {
    tags = await db
      .select({
        noteId: tastingNoteTags.noteId,
        type: tastingNoteTags.type,
        count: sql<number>`count(*)`,
      })
      .from(tastingNoteTags)
      .where(inArray(tastingNoteTags.noteId, noteIds))
      .groupBy(tastingNoteTags.noteId, tastingNoteTags.type)
  }

  const tagCountsByNote: Record<string, Record<string, number>> = {}
  tags.forEach((tag) => {
    if (!tagCountsByNote[tag.noteId]) tagCountsByNote[tag.noteId] = {}
    tagCountsByNote[tag.noteId][tag.type] = Number(tag.count || 0)
  })

  const items = (notes as NoteRow[]).map((note: NoteRow) => {
    const tagCounts = tagCountsByNote[note.id] || {}
    const checks = [
      Boolean(note.location),
      Boolean(note.overall),
      typeof note.rating === 'number' && note.rating >= 1 && note.rating <= 10,
      Number(tagCounts.nose || 0) > 0,
      Number(tagCounts.palate || 0) > 0,
      Number(tagCounts.finish || 0) > 0,
    ]
    const completed = checks.filter(Boolean).length
    return {
      ...note,
      countryName: lang.toLowerCase() === 'fr' ? note.countryNameFr || note.countryName : note.countryName,
      completionPercent: Math.round((completed / checks.length) * 100),
    }
  })

  return NextResponse.json({ items, total, totalPages, page, pageSize })
}
