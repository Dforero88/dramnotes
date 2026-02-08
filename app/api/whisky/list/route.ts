import { NextRequest, NextResponse } from 'next/server'
import { db, whiskies, distillers, bottlers, countries, whiskyAnalyticsCache } from '@/lib/db'
import { and, eq, sql } from 'drizzle-orm'

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

    const name = searchParams.get('name')?.trim() || ''
    const distiller = searchParams.get('distiller')?.trim() || ''
    const bottler = searchParams.get('bottler')?.trim() || ''
    const barcode = searchParams.get('barcode')?.trim() || ''
    const distilledYear = searchParams.get('distilledYear')?.trim() || ''
    const bottledYear = searchParams.get('bottledYear')?.trim() || ''
    const age = searchParams.get('age')?.trim() || ''
    const alcoholVolume = searchParams.get('alcoholVolume')?.trim() || ''
    const region = searchParams.get('region')?.trim() || ''
    const type = searchParams.get('type')?.trim() || ''
    const countryId = searchParams.get('countryId')?.trim() || ''
    const bottlingType = searchParams.get('bottlingType')?.trim() || ''
    const sort = searchParams.get('sort')?.trim() || 'name_asc'

    const filters: any[] = []

    if (name) {
      filters.push(sql`lower(${whiskies.name}) like ${buildLike(name)}`)
    }
    if (barcode) {
      filters.push(sql`lower(${whiskies.barcode}) like ${buildLike(barcode)}`)
    }
    if (region) {
      filters.push(sql`lower(${whiskies.region}) like ${buildLike(region)}`)
    }
    if (type) {
      filters.push(eq(whiskies.type, type))
    }
    if (countryId) {
      filters.push(eq(whiskies.countryId, countryId))
    }
    if (bottlingType) {
      filters.push(eq(whiskies.bottlingType, bottlingType))
    }
    if (distilledYear) {
      filters.push(eq(whiskies.distilledYear, Number(distilledYear)))
    }
    if (bottledYear) {
      filters.push(eq(whiskies.bottledYear, Number(bottledYear)))
    }
    if (age) {
      filters.push(eq(whiskies.age, Number(age)))
    }
    if (alcoholVolume) {
      filters.push(eq(whiskies.alcoholVolume, Number(alcoholVolume)))
    }
    if (distiller) {
      filters.push(sql`lower(${distillers.name}) like ${buildLike(distiller)}`)
    }
    if (bottler) {
      filters.push(sql`lower(${bottlers.name}) like ${buildLike(bottler)}`)
    }

    const whereClause = filters.length ? and(...filters) : undefined

    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(whiskies)
      .leftJoin(distillers, eq(whiskies.distillerId, distillers.id))
      .leftJoin(bottlers, eq(whiskies.bottlerId, bottlers.id))
      .where(whereClause)

    const total = Number(countRows?.[0]?.count || 0)
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    const rows = await db
      .select({
        id: whiskies.id,
        name: whiskies.name,
        bottleImageUrl: sql<string>`coalesce(${whiskies.bottleImageUrl}, ${whiskies.imageUrl})`,
        distillerName: distillers.name,
        bottlerName: bottlers.name,
        countryName: countries.name,
        type: whiskies.type,
        age: whiskies.age,
        region: whiskies.region,
        alcoholVolume: whiskies.alcoholVolume,
      })
      .from(whiskies)
      .leftJoin(distillers, eq(whiskies.distillerId, distillers.id))
      .leftJoin(bottlers, eq(whiskies.bottlerId, bottlers.id))
      .leftJoin(countries, eq(whiskies.countryId, countries.id))
      .leftJoin(whiskyAnalyticsCache, eq(whiskies.id, whiskyAnalyticsCache.whiskyId))
      .where(whereClause)
      .orderBy(
        sort === 'name_desc'
          ? sql`lower(${whiskies.name}) desc`
          : sort === 'created_desc'
            ? sql`${whiskies.createdAt} desc`
            : sort === 'created_asc'
              ? sql`${whiskies.createdAt} asc`
              : sort === 'notes_desc'
                ? sql`coalesce(${whiskyAnalyticsCache.totalReviews}, 0) desc`
                : sort === 'notes_asc'
                  ? sql`coalesce(${whiskyAnalyticsCache.totalReviews}, 0) asc`
                  : sort === 'rating_desc'
                    ? sql`coalesce(${whiskyAnalyticsCache.avgRating}, 0) desc`
                    : sort === 'rating_asc'
                      ? sql`coalesce(${whiskyAnalyticsCache.avgRating}, 0) asc`
                      : sql`lower(${whiskies.name}) asc`
      )
      .limit(pageSize)
      .offset(offset)

    return NextResponse.json({
      items: rows,
      total,
      totalPages,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('❌ Erreur list whiskies:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
