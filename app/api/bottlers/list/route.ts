import { NextRequest, NextResponse } from 'next/server'
import { db, bottlers, countries, whiskies } from '@/lib/db'
import { and, eq, sql } from 'drizzle-orm'
import { normalizeSearch } from '@/lib/moderation'
import { getRouteCache, setRouteCache } from '@/lib/server-route-cache'

export const dynamic = 'force-dynamic'
const CACHE_TTL_SECONDS = 600

function buildLike(value: string) {
  return `%${value.toLowerCase()}%`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cacheKey = `bottlers:list:${searchParams.toString()}`
    const cached = getRouteCache<{
      items: unknown[]
      total: number
      totalPages: number
      page: number
      pageSize: number
    }>(cacheKey)
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': `public, max-age=0, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=60` },
      })
    }
    const page = Math.max(1, Number(searchParams.get('page') || '1'))
    const pageSize = Math.max(1, Math.min(24, Number(searchParams.get('pageSize') || '12')))
    const offset = (page - 1) * pageSize

    const name = normalizeSearch(searchParams.get('name') || '', 80)
    const region = normalizeSearch(searchParams.get('region') || '', 80)
    const countryId = searchParams.get('countryId')?.trim() || ''
    const locale = (searchParams.get('lang') || 'fr').toLowerCase()
    const sort = searchParams.get('sort') || 'name_asc'

    const filters: any[] = [eq(bottlers.isActive, 1), sql`${bottlers.mergedIntoId} is null`]
    if (name) filters.push(sql`lower(${bottlers.name}) like ${buildLike(name)}`)
    if (region) filters.push(sql`lower(${bottlers.region}) like ${buildLike(region)}`)
    if (countryId) filters.push(eq(bottlers.countryId, countryId))
    const whereClause = filters.length ? and(...filters) : undefined

    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(bottlers)
      .where(whereClause)
    const total = Number(countRows?.[0]?.count || 0)
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    const baseQuery = db
      .select({
        id: bottlers.id,
        slug: bottlers.slug,
        name: bottlers.name,
        imageUrl: bottlers.imageUrl,
        region: bottlers.region,
        countryName: countries.name,
        countryNameFr: countries.nameFr,
        whiskyCount: sql<number>`count(${whiskies.id})`,
      })
      .from(bottlers)
      .leftJoin(countries, eq(countries.id, bottlers.countryId))
      .leftJoin(whiskies, eq(whiskies.bottlerId, bottlers.id))
      .where(whereClause)
      .groupBy(bottlers.id)

    const rows =
      sort === 'name_desc'
        ? await baseQuery.orderBy(sql`lower(${bottlers.name}) desc`).limit(pageSize).offset(offset)
        : sort === 'count_desc'
          ? await baseQuery
              .orderBy(sql`count(${whiskies.id}) desc`, sql`lower(${bottlers.name}) asc`)
              .limit(pageSize)
              .offset(offset)
          : sort === 'count_asc'
            ? await baseQuery
                .orderBy(sql`count(${whiskies.id}) asc`, sql`lower(${bottlers.name}) asc`)
                .limit(pageSize)
                .offset(offset)
            : await baseQuery.orderBy(sql`lower(${bottlers.name}) asc`).limit(pageSize).offset(offset)

    type BottlerRow = {
      id: string
      slug: string | null
      name: string
      imageUrl: string | null
      region: string | null
      countryName: string | null
      countryNameFr: string | null
      whiskyCount: number | string | null
    }

    const items = (rows as BottlerRow[]).map((row) => ({
      ...row,
      whiskyCount: Number(row.whiskyCount || 0),
      countryName: locale === 'fr' ? row.countryNameFr || row.countryName : row.countryName,
    }))

    const payload = { items, total, totalPages, page, pageSize }
    setRouteCache(cacheKey, payload, CACHE_TTL_SECONDS)
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': `public, max-age=0, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=60` },
    })
  } catch (error) {
    console.error('❌ Erreur list bottlers:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
