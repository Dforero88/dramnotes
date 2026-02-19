import { NextRequest, NextResponse } from 'next/server'
import { db, distillers, bottlers } from '@/lib/db'
import { and, eq, sql } from 'drizzle-orm'
import { normalizeSearch } from '@/lib/moderation'

export const dynamic = 'force-dynamic'

type ProducerKind = 'distiller' | 'bottler'

function isProducerKind(value: string): value is ProducerKind {
  return value === 'distiller' || value === 'bottler'
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const kind = String(searchParams.get('kind') || '').trim()
    const q = normalizeSearch(searchParams.get('q') || '', 80)
    const limit = Math.min(10, Math.max(1, Number(searchParams.get('limit') || '8')))

    if (!isProducerKind(kind) || q.length < 2) {
      return NextResponse.json({ items: [] })
    }

    const lowerQ = q.toLowerCase()
    const likePrefix = `${lowerQ}%`

    const source = kind === 'distiller' ? distillers : bottlers
    const activeFilter =
      kind === 'distiller'
        ? and(eq(distillers.isActive, 1), sql`${distillers.mergedIntoId} is null`)
        : and(eq(bottlers.isActive, 1), sql`${bottlers.mergedIntoId} is null`)
    const rows = await db
      .select({ name: source.name })
      .from(source)
      .where(and(sql`lower(${source.name}) like ${likePrefix}`, activeFilter))
      .orderBy(sql`length(${source.name}) asc, lower(${source.name}) asc`)
      .limit(limit)

    const items = Array.from(
      new Set(rows.map((r: { name: string | null }) => String(r.name || '').trim()).filter(Boolean))
    )

    return NextResponse.json({ items })
  } catch (error) {
    return NextResponse.json({ items: [] })
  }
}
