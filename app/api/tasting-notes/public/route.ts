import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, tastingNotes, tastingNoteTags, tagLang, users } from '@/lib/db'
import { and, eq, inArray, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const whiskyId = searchParams.get('whiskyId')
  const lang = (searchParams.get('lang') || 'fr').trim()
  const pseudo = searchParams.get('user')?.trim()
  const page = Math.max(1, Number(searchParams.get('page') || '1'))
  const pageSize = Math.max(1, Math.min(20, Number(searchParams.get('pageSize') || '5')))
  const offset = (page - 1) * pageSize

  if (!whiskyId) {
    return NextResponse.json({ error: 'whiskyId missing' }, { status: 400 })
  }

  const filters: any[] = [
    eq(tastingNotes.whiskyId, whiskyId),
    eq(users.visibility, 'public'),
    sql`${users.id} <> ${userId}`,
  ]

  if (pseudo) {
    filters.push(sql`lower(${users.pseudo}) = ${pseudo.toLowerCase()}`)
  }

  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(tastingNotes)
    .leftJoin(users, sql`binary ${users.id} = binary ${tastingNotes.userId}`)
    .where(and(...filters))

  const total = Number(countRes?.[0]?.count || 0)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const notes = await db
    .select({
      id: tastingNotes.id,
      tastingDate: tastingNotes.tastingDate,
      location: tastingNotes.location,
      overall: tastingNotes.overall,
      rating: tastingNotes.rating,
      userId: tastingNotes.userId,
      pseudo: users.pseudo,
    })
    .from(tastingNotes)
    .leftJoin(users, sql`binary ${users.id} = binary ${tastingNotes.userId}`)
    .where(and(...filters))
    .orderBy(sql`${tastingNotes.tastingDate} desc`)
    .limit(pageSize)
    .offset(offset)

  type NoteRow = {
    id: string
    tastingDate: string
    location: string | null
    overall: string | null
    rating: number | null
    userId: string
    pseudo: string | null
  }
  const noteIds = (notes as NoteRow[]).map((n: NoteRow) => n.id)
  type TagType = 'nose' | 'palate' | 'finish'
  type TagRow = { noteId: string; type: TagType; tagId: string; name: string | null }
  let tags: TagRow[] = []
  if (noteIds.length > 0) {
    tags = await db
      .select({
        noteId: tastingNoteTags.noteId,
        type: tastingNoteTags.type,
        tagId: tastingNoteTags.tagId,
        name: tagLang.name,
      })
      .from(tastingNoteTags)
      .leftJoin(tagLang, and(eq(tagLang.tagId, tastingNoteTags.tagId), eq(tagLang.lang, lang)))
      .where(inArray(tastingNoteTags.noteId, noteIds))
  }

  type TagOut = { id: string; name: string | null }
  const tagsByNote: Record<string, { nose: TagOut[]; palate: TagOut[]; finish: TagOut[] }> = {}
  tags.forEach((t: TagRow) => {
    if (!tagsByNote[t.noteId]) tagsByNote[t.noteId] = { nose: [], palate: [], finish: [] }
    tagsByNote[t.noteId][t.type].push({ id: t.tagId, name: t.name })
  })

  const items = (notes as NoteRow[]).map((note: NoteRow) => ({
    ...note,
    tags: tagsByNote[note.id] || { nose: [], palate: [], finish: [] },
  }))

  return NextResponse.json({
    items,
    total,
    totalPages,
    page,
    pageSize,
    filteredUser: pseudo || null,
  })
}
