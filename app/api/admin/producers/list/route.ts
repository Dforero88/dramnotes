import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { and, eq, sql } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import { db, bottlers, countries, distillers, whiskies } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { normalizeSearch } from '@/lib/moderation'
import { isWhiskyNameAgeNormalized } from '@/lib/whisky-name'

export const dynamic = 'force-dynamic'

function buildLike(value: string) {
  return `%${value.toLowerCase()}%`
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const kindParam = (searchParams.get('kind') || 'distiller').toLowerCase()
    const kind = kindParam === 'bottler' ? 'bottler' : kindParam === 'whisky' ? 'whisky' : 'distiller'
    const page = Math.max(1, Number(searchParams.get('page') || '1'))
    const pageSize = Math.max(1, Math.min(50, Number(searchParams.get('pageSize') || '20')))
    const offset = (page - 1) * pageSize
    const q = normalizeSearch(searchParams.get('q') || '', 120)
    const missingDescription = searchParams.get('missingDescription') === '1'
    const missingImage = searchParams.get('missingImage') === '1'
    const missingEan13 = searchParams.get('missingEan13') === '1'
    const ageNotNormalized = searchParams.get('ageNotNormalized') === '1'
    const locale = (searchParams.get('lang') || 'fr').toLowerCase()

    if (kind === 'distiller') {
      const filters: any[] = []
      if (q) filters.push(sql`lower(${distillers.name}) like ${buildLike(q)}`)
      if (missingDescription) {
        filters.push(
          sql`(coalesce(${distillers.descriptionFr}, '') = '' and coalesce(${distillers.descriptionEn}, '') = '')`
        )
      }
      if (missingImage) filters.push(sql`coalesce(${distillers.imageUrl}, '') = ''`)
      const whereClause = filters.length ? and(...filters) : undefined

      const countRows = await db
        .select({ count: sql<number>`count(*)` })
        .from(distillers)
        .where(whereClause)
      const total = Number(countRows?.[0]?.count || 0)
      const totalPages = Math.max(1, Math.ceil(total / pageSize))

      const rows = await db
        .select({
          id: distillers.id,
          name: distillers.name,
          slug: distillers.slug,
          imageUrl: distillers.imageUrl,
          descriptionFr: distillers.descriptionFr,
          descriptionEn: distillers.descriptionEn,
          countryId: distillers.countryId,
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
        .orderBy(sql`lower(${distillers.name}) asc`)
        .limit(pageSize)
        .offset(offset)

      type DistillerAdminRow = {
        id: string
        name: string
        slug: string | null
        imageUrl: string | null
        descriptionFr: string | null
        descriptionEn: string | null
        countryId: string | null
        region: string | null
        countryName: string | null
        countryNameFr: string | null
        whiskyCount: number | string | null
      }
      const items = (rows as DistillerAdminRow[]).map((row) => ({
        ...row,
        whiskyCount: Number(row.whiskyCount || 0),
        countryName: locale === 'fr' ? row.countryNameFr || row.countryName : row.countryName,
      }))
      return NextResponse.json({ items, total, totalPages, page, pageSize })
    }

    if (kind === 'whisky') {
      const filters: any[] = []
      if (q) filters.push(sql`lower(${whiskies.name}) like ${buildLike(q)}`)
      if (missingImage) filters.push(sql`coalesce(${whiskies.bottleImageUrl}, '') = ''`)
      if (missingEan13) filters.push(sql`coalesce(${whiskies.barcode}, '') = ''`)
      if (ageNotNormalized) {
        filters.push(sql`(
          lower(${whiskies.name}) like '% yo%'
          or lower(${whiskies.name}) like '% y.o%'
          or (
            lower(${whiskies.name}) like '% years%'
            and lower(${whiskies.name}) not like '% years old%'
          )
        )`)
      }
      const whereClause = filters.length ? and(...filters) : undefined

      const countRows = await db
        .select({ count: sql<number>`count(*)` })
        .from(whiskies)
        .where(whereClause)
      const total = Number(countRows?.[0]?.count || 0)
      const totalPages = Math.max(1, Math.ceil(total / pageSize))

      const rows = await db
        .select({
          id: whiskies.id,
          slug: whiskies.slug,
          name: whiskies.name,
          bottleImageUrl: whiskies.bottleImageUrl,
          barcode: whiskies.barcode,
          age: whiskies.age,
          distilledYear: whiskies.distilledYear,
          bottledYear: whiskies.bottledYear,
          alcoholVolume: whiskies.alcoholVolume,
          bottlingType: whiskies.bottlingType,
          distillerId: whiskies.distillerId,
          bottlerId: whiskies.bottlerId,
          countryId: whiskies.countryId,
          region: whiskies.region,
          type: whiskies.type,
          createdAt: whiskies.createdAt,
          distillerName: distillers.name,
          bottlerName: bottlers.name,
          countryName: countries.name,
          countryNameFr: countries.nameFr,
        })
        .from(whiskies)
        .leftJoin(distillers, eq(distillers.id, whiskies.distillerId))
        .leftJoin(bottlers, eq(bottlers.id, whiskies.bottlerId))
        .leftJoin(countries, eq(countries.id, whiskies.countryId))
        .where(whereClause)
        .orderBy(sql`${whiskies.createdAt} desc`)
        .limit(pageSize)
        .offset(offset)

      type WhiskyAdminRow = {
        id: string
        slug: string | null
        name: string
        bottleImageUrl: string | null
        barcode: string | null
        age: number | null
        distilledYear: number | null
        bottledYear: number | null
        alcoholVolume: number | null
        bottlingType: string | null
        distillerId: string | null
        bottlerId: string | null
        countryId: string | null
        region: string | null
        type: string | null
        createdAt: Date | string | null
        distillerName: string | null
        bottlerName: string | null
        countryName: string | null
        countryNameFr: string | null
      }

      const items = (rows as WhiskyAdminRow[]).map((row) => ({
        ...row,
        countryName: locale === 'fr' ? row.countryNameFr || row.countryName : row.countryName,
        missingEan13: !row.barcode || !String(row.barcode).trim(),
        ageNotNormalized: !isWhiskyNameAgeNormalized(row.name || ''),
        missingImage: !row.bottleImageUrl || !String(row.bottleImageUrl).trim(),
      }))
      return NextResponse.json({ items, total, totalPages, page, pageSize })
    }

    const filters: any[] = []
    if (q) filters.push(sql`lower(${bottlers.name}) like ${buildLike(q)}`)
    if (missingDescription) {
      filters.push(
        sql`(coalesce(${bottlers.descriptionFr}, '') = '' and coalesce(${bottlers.descriptionEn}, '') = '')`
      )
    }
    if (missingImage) filters.push(sql`coalesce(${bottlers.imageUrl}, '') = ''`)
    const whereClause = filters.length ? and(...filters) : undefined

    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(bottlers)
      .where(whereClause)
    const total = Number(countRows?.[0]?.count || 0)
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    const rows = await db
      .select({
        id: bottlers.id,
        name: bottlers.name,
        slug: bottlers.slug,
        imageUrl: bottlers.imageUrl,
        descriptionFr: bottlers.descriptionFr,
        descriptionEn: bottlers.descriptionEn,
        countryId: bottlers.countryId,
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
      .orderBy(sql`lower(${bottlers.name}) asc`)
      .limit(pageSize)
      .offset(offset)

    type BottlerAdminRow = {
      id: string
      name: string
      slug: string | null
      imageUrl: string | null
      descriptionFr: string | null
      descriptionEn: string | null
      countryId: string | null
      region: string | null
      countryName: string | null
      countryNameFr: string | null
      whiskyCount: number | string | null
    }
    const items = (rows as BottlerAdminRow[]).map((row) => ({
      ...row,
      whiskyCount: Number(row.whiskyCount || 0),
      countryName: locale === 'fr' ? row.countryNameFr || row.countryName : row.countryName,
    }))
    return NextResponse.json({ items, total, totalPages, page, pageSize })
  } catch (error) {
    console.error('❌ admin producers list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
