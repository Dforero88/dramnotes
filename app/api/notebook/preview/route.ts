import { NextRequest, NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import {
  db,
  users,
  tastingNotes,
  whiskies,
  countries,
  distillers,
  bottlers,
  userShelf,
  userAromaProfile,
  userTagStats,
  tagLang,
  follows,
  isMysql,
} from '@/lib/db'
import { normalizeSearch } from '@/lib/moderation'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pseudo = normalizeSearch(
      searchParams.get('pseudo') || process.env.NEXT_PUBLIC_NOTEBOOK_PREVIEW_PSEUDO || 'dforero',
      40
    )
    const lang = (searchParams.get('lang') || 'fr').trim().toLowerCase()

    if (!pseudo) return NextResponse.json({ error: 'Pseudo missing' }, { status: 400 })

    const userRows = await db
      .select({
        id: users.id,
        pseudo: users.pseudo,
        countryId: users.countryId,
        visibility: users.visibility,
        shelfVisibility: users.shelfVisibility,
      })
      .from(users)
      .where(and(sql`lower(${users.pseudo}) = ${pseudo.toLowerCase()}`, eq(users.visibility, 'public')))
      .limit(1)

    const user = userRows?.[0]
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const notesCountRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(tastingNotes)
      .where(and(eq(tastingNotes.userId, user.id), eq(tastingNotes.status, 'published')))

    const followersCountRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followedId, user.id))

    const followingCountRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followerId, user.id))

    const shelfCountRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(userShelf)
      .where(eq(userShelf.userId, user.id))

    const notes = await db
      .select({
        id: tastingNotes.id,
        tastingDate: tastingNotes.tastingDate,
        rating: tastingNotes.rating,
        location: tastingNotes.location,
        city: tastingNotes.city,
        country: tastingNotes.country,
        locationVisibility: tastingNotes.locationVisibility,
        latitude: tastingNotes.latitude,
        longitude: tastingNotes.longitude,
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
      .where(and(eq(tastingNotes.userId, user.id), eq(tastingNotes.status, 'published')))
      .orderBy(sql`${tastingNotes.createdAt} desc`)
      .limit(3)

    const shelf =
      user.shelfVisibility === 'public'
        ? await db
            .select({
              id: userShelf.id,
              status: userShelf.status,
              updatedAt: userShelf.updatedAt,
              whiskyId: whiskies.id,
              whiskySlug: whiskies.slug,
              whiskyName: whiskies.name,
              distillerName: distillers.name,
              bottlerName: bottlers.name,
              bottlingType: whiskies.bottlingType,
              type: whiskies.type,
              countryName: countries.name,
              countryNameFr: countries.nameFr,
              bottleImageUrl: sql<string>`coalesce(${whiskies.bottleImageUrl}, ${whiskies.imageUrl})`,
            })
            .from(userShelf)
            .leftJoin(whiskies, eq(userShelf.whiskyId, whiskies.id))
            .leftJoin(distillers, eq(whiskies.distillerId, distillers.id))
            .leftJoin(bottlers, eq(whiskies.bottlerId, bottlers.id))
            .leftJoin(countries, eq(whiskies.countryId, countries.id))
            .where(eq(userShelf.userId, user.id))
            .orderBy(sql`${userShelf.updatedAt} desc`)
            .limit(3)
        : []

    const followers = await db
      .select({
        id: users.id,
        pseudo: users.pseudo,
        countryId: users.countryId,
        notesCount: sql<number>`count(${tastingNotes.id})`,
      })
      .from(follows)
      .leftJoin(
        users,
        isMysql ? sql`binary ${users.id} = binary ${follows.followerId}` : eq(users.id, follows.followerId)
      )
      .leftJoin(
        tastingNotes,
        isMysql
          ? sql`binary ${tastingNotes.userId} = binary ${users.id} and binary ${tastingNotes.status} = 'published'`
          : sql`${tastingNotes.userId} = ${users.id} and ${tastingNotes.status} = 'published'`
      )
      .where(and(eq(follows.followedId, user.id), eq(users.visibility, 'public')))
      .groupBy(users.id)
      .orderBy(sql`count(${tastingNotes.id}) desc`)
      .limit(3)

    const following = await db
      .select({
        id: users.id,
        pseudo: users.pseudo,
        countryId: users.countryId,
        notesCount: sql<number>`count(${tastingNotes.id})`,
      })
      .from(follows)
      .leftJoin(
        users,
        isMysql ? sql`binary ${users.id} = binary ${follows.followedId}` : eq(users.id, follows.followedId)
      )
      .leftJoin(
        tastingNotes,
        isMysql
          ? sql`binary ${tastingNotes.userId} = binary ${users.id} and binary ${tastingNotes.status} = 'published'`
          : sql`${tastingNotes.userId} = ${users.id} and ${tastingNotes.status} = 'published'`
      )
      .where(and(eq(follows.followerId, user.id), eq(users.visibility, 'public')))
      .groupBy(users.id)
      .orderBy(sql`count(${tastingNotes.id}) desc`)
      .limit(3)

    const profileRows = await db
      .select({
        avgRating: userAromaProfile.avgRating,
        totalNotes: userAromaProfile.totalNotes,
      })
      .from(userAromaProfile)
      .where(eq(userAromaProfile.userId, user.id))
      .limit(1)
    const profile = profileRows?.[0]

    const statsRows = await db
      .select({
        tagId: userTagStats.tagId,
        section: userTagStats.section,
        avgScore: userTagStats.avgScore,
        count: userTagStats.count,
        name: tagLang.name,
      })
      .from(userTagStats)
      .leftJoin(tagLang, and(eq(tagLang.tagId, userTagStats.tagId), eq(tagLang.lang, lang)))
      .where(eq(userTagStats.userId, user.id))

    const grouped = {
      nose: [] as { name: string; score: number; count: number }[],
      palate: [] as { name: string; score: number; count: number }[],
      finish: [] as { name: string; score: number; count: number }[],
    }
    ;(statsRows as Array<{ section: 'nose' | 'palate' | 'finish'; name: string | null; avgScore: number | null; count: number | null }>).forEach((row) => {
      if (!row.name) return
      grouped[row.section].push({
        name: row.name,
        score: Number(row.avgScore || 0),
        count: Number(row.count || 0),
      })
    })
    const top = {
      nose: grouped.nose.sort((a, b) => b.score - a.score).slice(0, 3),
      palate: grouped.palate.sort((a, b) => b.score - a.score).slice(0, 3),
      finish: grouped.finish.sort((a, b) => b.score - a.score).slice(0, 3),
    }

    return NextResponse.json({
      user: {
        id: user.id,
        pseudo: user.pseudo,
        countryId: user.countryId || null,
        shelfVisibility: user.shelfVisibility || 'private',
      },
      counts: {
        notes: Number(notesCountRes?.[0]?.count || 0),
        shelf: Number(shelfCountRes?.[0]?.count || 0),
        followers: Number(followersCountRes?.[0]?.count || 0),
        following: Number(followingCountRes?.[0]?.count || 0),
      },
      notes: notes.map((note: any) => ({
        ...note,
        location:
          note.locationVisibility === 'public_precise'
            ? note.location
            : [note.city, note.country].filter(Boolean).join(', ') || note.country || null,
        countryName: lang === 'fr' ? note.countryNameFr || note.countryName : note.countryName,
      })),
      shelf: shelf.map((item: any) => ({
        ...item,
        countryName: lang === 'fr' ? item.countryNameFr || item.countryName : item.countryName,
      })),
      followers: followers.map((row: any) => ({
        ...row,
        notesCount: Number(row.notesCount || 0),
      })),
      following: following.map((row: any) => ({
        ...row,
        notesCount: Number(row.notesCount || 0),
      })),
      aroma: {
        hasProfile: Boolean(profile),
        totalNotes: Number(profile?.totalNotes || notesCountRes?.[0]?.count || 0),
        avgRating: Number(profile?.avgRating || 0),
        top,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
