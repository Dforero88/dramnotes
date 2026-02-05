import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, tastingNotes, tastingNoteTags, tagLang } from '@/lib/db'
import { and, eq, inArray } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const whiskyId = searchParams.get('whiskyId')
  const lang = (searchParams.get('lang') || 'fr').trim()
  if (!whiskyId) {
    return NextResponse.json({ error: 'whiskyId missing' }, { status: 400 })
  }

  const note = await db
    .select()
    .from(tastingNotes)
    .where(and(eq(tastingNotes.whiskyId, whiskyId), eq(tastingNotes.userId, userId)))
    .limit(1)

  if (note.length === 0) {
    return NextResponse.json({ note: null })
  }

  const noteId = note[0].id
  const tags = await db
    .select({
      noteId: tastingNoteTags.noteId,
      type: tastingNoteTags.type,
      tagId: tastingNoteTags.tagId,
      name: tagLang.name,
    })
    .from(tastingNoteTags)
    .leftJoin(tagLang, and(eq(tagLang.tagId, tastingNoteTags.tagId), eq(tagLang.lang, lang)))
    .where(eq(tastingNoteTags.noteId, noteId))

  type TagRow = { type: string; tagId: string; name: string | null }
  const grouped = { nose: [], palate: [], finish: [] } as Record<string, TagRow[]>
  tags.forEach((t: TagRow) => {
    if (!grouped[t.type]) grouped[t.type] = []
    grouped[t.type].push({ id: t.tagId, name: t.name })
  })

  return NextResponse.json({ note: note[0], tags: grouped })
}
