import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, users, tastingNotes, whiskies, distillers, bottlers, countries, tagLang, tastingNoteTags, isMysql } from '@/lib/db'
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
  if (!isOwner && user.visibility !== 'public') {
    return NextResponse.json({ error: 'Private' }, { status: 403 })
  }

  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(tastingNotes)
    .where(isMysql ? sql`binary ${tastingNotes.userId} = binary ${user.id}` : eq(tastingNotes.userId, user.id))
  const total = Number(countRes?.[0]?.count || 0)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const notes = await db
    .select({
      id: tastingNotes.id,
      tastingDate: tastingNotes.tastingDate,
      rating: tastingNotes.rating,
      whiskyId: tastingNotes.whiskyId,
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
    .where(isMysql ? sql`binary ${tastingNotes.userId} = binary ${user.id}` : eq(tastingNotes.userId, user.id))
    .orderBy(sql`${tastingNotes.tastingDate} desc`)
    .limit(pageSize)
    .offset(offset)

  type NoteRow = {
    id: string
    tastingDate: string
    rating: number | null
    whiskyId: string
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
  let tags: { noteId: string; name: string | null }[] = []
  if (noteIds.length > 0) {
    tags = await db
      .select({
        noteId: tastingNoteTags.noteId,
        name: tagLang.name,
      })
      .from(tastingNoteTags)
      .leftJoin(tagLang, and(eq(tagLang.tagId, tastingNoteTags.tagId), eq(tagLang.lang, lang)))
      .where(inArray(tastingNoteTags.noteId, noteIds))
  }

  const tagsByNote: Record<string, string[]> = {}
  tags.forEach((tag) => {
    if (!tagsByNote[tag.noteId]) tagsByNote[tag.noteId] = []
    if (tag.name) tagsByNote[tag.noteId].push(tag.name)
  })

  const items = (notes as NoteRow[]).map((note: NoteRow) => {
    const allTags = tagsByNote[note.id] || []
    const uniqueTags = Array.from(new Set(allTags))
    return {
      ...note,
      countryName: lang.toLowerCase() === 'fr' ? note.countryNameFr || note.countryName : note.countryName,
      tags: uniqueTags.slice(0, 3),
      extraTagsCount: Math.max(0, uniqueTags.length - 3),
    }
  })

  return NextResponse.json({ items, total, totalPages, page, pageSize })
}
