import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { and, eq, sql } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import { bottlers, countries, db, distillers, isMysql, userShelf, users, whiskies } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const lang = (searchParams.get('lang') || 'fr').trim().toLowerCase()
  const page = Math.max(1, Number(searchParams.get('page') || '1'))
  const pageSize = Math.max(1, Math.min(24, Number(searchParams.get('pageSize') || '12')))
  const offset = (page - 1) * pageSize
  const sort = (searchParams.get('sort') || 'updated_desc').trim()

  if (!userId) {
    return NextResponse.json({ error: 'userId missing' }, { status: 400 })
  }

  const userRows = await db
    .select({ id: users.id, visibility: users.visibility, shelfVisibility: users.shelfVisibility })
    .from(users)
    .where(isMysql ? sql`binary ${users.id} = binary ${userId}` : eq(users.id, userId))
    .limit(1)
  const user = userRows?.[0]
  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const isOwner = user.id === session.user.id
  if (!isOwner) {
    if (user.visibility !== 'public' || user.shelfVisibility !== 'public') {
      return NextResponse.json({ error: 'Private' }, { status: 403 })
    }
  }

  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(userShelf)
    .where(eq(userShelf.userId, user.id))
  const total = Number(countRes?.[0]?.count || 0)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const baseQuery = db
    .select({
      id: userShelf.id,
      status: userShelf.status,
      updatedAt: userShelf.updatedAt,
      whiskyId: whiskies.id,
      whiskySlug: whiskies.slug,
      whiskyName: whiskies.name,
      bottleImageUrl: sql<string>`coalesce(${whiskies.bottleImageUrl}, ${whiskies.imageUrl})`,
      distillerName: distillers.name,
      bottlerName: bottlers.name,
      bottlingType: whiskies.bottlingType,
      type: whiskies.type,
      countryName: countries.name,
      countryNameFr: countries.nameFr,
    })
    .from(userShelf)
    .leftJoin(whiskies, eq(userShelf.whiskyId, whiskies.id))
    .leftJoin(distillers, eq(whiskies.distillerId, distillers.id))
    .leftJoin(bottlers, eq(whiskies.bottlerId, bottlers.id))
    .leftJoin(countries, eq(whiskies.countryId, countries.id))
    .where(eq(userShelf.userId, user.id))

  const rows =
    sort === 'updated_asc'
      ? await baseQuery.orderBy(sql`${userShelf.updatedAt} asc`).limit(pageSize).offset(offset)
      : sort === 'name_asc'
        ? await baseQuery.orderBy(sql`lower(${whiskies.name}) asc`).limit(pageSize).offset(offset)
        : sort === 'name_desc'
          ? await baseQuery.orderBy(sql`lower(${whiskies.name}) desc`).limit(pageSize).offset(offset)
          : await baseQuery.orderBy(sql`${userShelf.updatedAt} desc`).limit(pageSize).offset(offset)

  type ShelfRow = {
    id: string
    status: string
    updatedAt: Date | string | number | null
    whiskyId: string | null
    whiskySlug: string | null
    whiskyName: string | null
    bottleImageUrl: string | null
    distillerName: string | null
    bottlerName: string | null
    bottlingType: string | null
    type: string | null
    countryName: string | null
    countryNameFr: string | null
  }

  const items = (rows as ShelfRow[]).map((row) => ({
    ...row,
    countryName: lang === 'fr' ? row.countryNameFr || row.countryName : row.countryName,
  }))

  return NextResponse.json({ items, total, totalPages, page, pageSize })
}
