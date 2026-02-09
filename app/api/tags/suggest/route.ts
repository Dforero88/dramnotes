import { NextRequest, NextResponse } from 'next/server'
import { db, tagLang } from '@/lib/db'
import { and, eq, sql } from 'drizzle-orm'
import { normalizeSearch } from '@/lib/moderation'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = normalizeSearch(searchParams.get('q') || '', 40)
  const rawLang = (searchParams.get('lang') || 'fr').trim()
  const lang = rawLang.split('-')[0].split('_')[0].toLowerCase()

  if (q.length < 2) {
    return NextResponse.json({ tags: [] })
  }

  const results = await db
    .select({
      id: tagLang.tagId,
      name: tagLang.name,
    })
    .from(tagLang)
    .where(
      and(
        eq(tagLang.lang, lang),
        sql`lower(${tagLang.name}) like ${`%${q.toLowerCase()}%`}`
      )
    )
    .limit(10)

  return NextResponse.json({ tags: results })
}
