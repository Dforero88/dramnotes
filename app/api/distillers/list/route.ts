import { NextRequest, NextResponse } from 'next/server'
import { db, distillers, countries, whiskies } from '@/lib/db'
import { and, eq, sql } from 'drizzle-orm'
import { normalizeSearch } from '@/lib/moderation'

export const dynamic = 'force-dynamic'

function buildLike(value: string) {
  return `%${value.toLowerCase()}%`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') || '1'))
    const pageSize = Math.max(1, Math.min(24, Number(searchParams.get('pageSize') || '12')))
    const offset = (page - 1) * pageSize

    const name = normalizeSearch(searchParams.get('name') || '', 80)
    const region = normalizeSearch(searchParams.get('region') || '', 80)
    const countryId = searchParams.get('countryId')?.trim() || ''
    const locale = (searchParams.get('lang') || 'fr').toLowerCase()
    const sort = searchParams.get('sort') || 'name_asc'

    const filters: any[] = [eq(distillers.isActive, 1), sql`${distillers.mergedIntoId} is null`]
    if (name) filters.push(sql`lower(${distillers.name}) like ${buildLike(name)}`)
    if (region) filters.push(sql`lower(${distillers.region}) like ${buildLike(region)}`)
    if (countryId) filters.push(eq(distillers.countryId, countryId))
    const whereClause = filters.length ? and(...filters) : undefined

    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(distillers)
      .where(whereClause)
    const total = Number(countRows?.[0]?.count || 0)
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    const baseQuery = db
      .select({
        id: distillers.id,
        slug: distillers.slug,
        name: distillers.name,
        imageUrl: distillers.imageUrl,
        region: distillers.region,
        countryName: countries.name,
        countryNameFr: countries.nameFr,
        whiskyCount: sql<number>`count(${whiskies.id})`,
      })
      .from(distillers)
      .leftJoin(countries, eq(countries.id, distillers.countryId))
      .leftJoin(whiskies, eq(whiskies.distillerId, distillers.id))
      .where(whereClause)
      .groupBy(distillers.id)

    const rows =
      sort === 'name_desc'
        ? await baseQuery.orderBy(sql`lower(${distillers.name}) desc`).limit(pageSize).offset(offset)
        : sort === 'count_desc'
          ? await baseQuery
              .orderBy(sql`count(${whiskies.id}) desc`, sql`lower(${distillers.name}) asc`)
              .limit(pageSize)
              .offset(offset)
          : sort === 'count_asc'
            ? await baseQuery
                .orderBy(sql`count(${whiskies.id}) asc`, sql`lower(${distillers.name}) asc`)
                .limit(pageSize)
                .offset(offset)
            : await baseQuery.orderBy(sql`lower(${distillers.name}) asc`).limit(pageSize).offset(offset)

    type DistillerRow = {
      id: string
      slug: string | null
      name: string
      imageUrl: string | null
      region: string | null
      countryName: string | null
      countryNameFr: string | null
      whiskyCount: number | string | null
    }

    const items = (rows as DistillerRow[]).map((row) => ({
      ...row,
      whiskyCount: Number(row.whiskyCount || 0),
      countryName: locale === 'fr' ? row.countryNameFr || row.countryName : row.countryName,
    }))

    return NextResponse.json({ items, total, totalPages, page, pageSize })
  } catch (error) {
    console.error('❌ Erreur list distillers:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
