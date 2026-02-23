import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTranslations, type Locale } from '@/lib/i18n'
import { db, tastingNotes, users, whiskies, follows, activities, countries, distillers, bottlers, isMysql, userShelf } from '@/lib/db'
import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import type { Metadata } from 'next'
import HomeHeroCarousel from '@/components/HomeHeroCarousel'
import HomeActivitiesFeed from '@/components/HomeActivitiesFeed'
import SignupCtaLink from '@/components/SignupCtaLink'
import { buildWhiskyPath } from '@/lib/whisky-url'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  const safeLocale: Locale = locale === 'en' ? 'en' : 'fr'
  const t = getTranslations(safeLocale)
  return { title: t('home.pageTitle') }
}

type TopUser = {
  id: string
  pseudo: string
  notesCount: number
  countryId: string | null
  followersCount?: number
  lastWhiskyName?: string | null
  lastWhiskyImageUrl?: string | null
}

type ActivityItem = {
  id: string
  type: string
  createdAt: Date | null
  actorId: string
  actorPseudo: string | null
  targetId: string
  whiskyName: string | null
  whiskyImageUrl: string | null
  whiskyType: string | null
  countryName: string | null
  bottlingType: string | null
  distillerName: string | null
  bottlerName: string | null
  location: string | null
  locationVisibility: string | null
  city: string | null
  country: string | null
  rating: number | null
  shelfStatus: string | null
}

function buildAvatar(pseudo: string) {
  const colors = [
    '#3498db', '#2ecc71', '#e74c3c', '#f39c12',
    '#9b59b6', '#1abc9c', '#d35400', '#c0392b',
    '#8e44ad', '#27ae60', '#2980b9', '#f1c40f',
  ]
  let hash = 0
  for (let i = 0; i < pseudo.length; i += 1) {
    hash = ((hash << 5) - hash) + pseudo.charCodeAt(i)
    hash |= 0
  }
  const color = colors[Math.abs(hash) % colors.length]
  const initial = pseudo.charAt(0).toUpperCase()
  return { color, initial }
}

function normalizeActivityDate(value: unknown) {
  if (!value) return null
  if (value instanceof Date) {
    const time = value.getTime()
    if (!Number.isFinite(time)) return null
    if (time > Date.now() + 1000 * 60 * 60 * 24 * 365) {
      return new Date(Math.floor(time / 1000))
    }
    return value
  }
  if (typeof value === 'number') {
    return new Date(value < 1e12 ? value * 1000 : value)
  }
  if (typeof value === 'string') {
    const numeric = Number(value)
    if (!Number.isNaN(numeric)) {
      return new Date(numeric < 1e12 ? numeric * 1000 : numeric)
    }
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

function formatRelativeDate(date: Date | null, locale: string) {
  if (!date) return ''
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const diffMs = date.getTime() - Date.now()
  const diffSeconds = Math.round(diffMs / 1000)
  const divisions: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.34524, unit: 'week' },
    { amount: 12, unit: 'month' },
  ]

  let duration = diffSeconds
  for (let i = 0; i < divisions.length; i += 1) {
    const division = divisions[i]
    if (Math.abs(duration) < division.amount) {
      return rtf.format(duration, division.unit)
    }
    duration = Math.round(duration / division.amount)
  }

  return rtf.format(duration, 'year')
}

function normalizeImage(url?: string | null) {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('/')) return url
  return `/${url}`
}

function getCountryFlagUrl(countryId?: string | null) {
  if (!countryId) return ''
  const code = String(countryId).trim().toLowerCase()
  if (!code) return ''
  if (code === 'sct') return '/flags/scotland.svg'
  return `https://hatscripts.github.io/circle-flags/flags/${code}.svg`
}

function pickActivitiesByType<T extends { type: string }>(
  source: T[],
  types: string[],
  maxPerType: number
) {
  const counters = new Map<string, number>()
  const selected: T[] = []
  for (const item of source) {
    if (!types.includes(item.type)) continue
    const current = counters.get(item.type) || 0
    if (current >= maxPerType) continue
    counters.set(item.type, current + 1)
    selected.push(item)
  }
  return selected
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const safeLocale: Locale = locale === 'en' ? 'en' : 'fr'
  const t = getTranslations(safeLocale)
  const session = await getServerSession(authOptions)
  const isLoggedIn = Boolean(session?.user?.id)
  const currentUserId = session?.user?.id || null

  const topUsers = (await db
    .select({
      id: users.id,
      pseudo: users.pseudo,
      notesCount: sql<number>`count(${tastingNotes.id})`,
      countryId: users.countryId,
    })
    .from(users)
    .leftJoin(
      tastingNotes,
      isMysql
        ? sql`binary ${tastingNotes.userId} = binary ${users.id} and binary ${tastingNotes.status} = 'published'`
        : sql`${tastingNotes.userId} = ${users.id} and ${tastingNotes.status} = 'published'`
    )
    .where(isMysql ? sql`binary ${users.visibility} = 'public'` : eq(users.visibility, 'public'))
    .groupBy(users.id)
    .orderBy(sql`count(${tastingNotes.id}) desc`)
    .limit(3)) as TopUser[]

  const topUserIds = topUsers.map((user) => user.id)
  const topUsersFollowers = topUserIds.length
    ? await db
        .select({
          userId: follows.followedId,
          followersCount: sql<number>`count(${follows.followerId})`,
        })
        .from(follows)
        .where(inArray(follows.followedId, topUserIds))
        .groupBy(follows.followedId)
    : []
  const topUsersFollowersMap = new Map(
    topUsersFollowers.map((row: { userId: string; followersCount: number | string | null }) => [
      row.userId,
      Number(row.followersCount || 0),
    ])
  )
  const topUsersWithMeta = topUsers.map((user) => ({
    ...user,
    followersCount: topUsersFollowersMap.get(user.id) || 0,
  }))
  const topUsersLatestNotes = topUserIds.length
    ? await db
        .select({
          userId: tastingNotes.userId,
          whiskyName: whiskies.name,
          whiskyImageUrl: sql<string | null>`coalesce(${whiskies.bottleImageUrl}, ${whiskies.imageUrl})`,
          createdAt: tastingNotes.createdAt,
        })
        .from(tastingNotes)
        .innerJoin(
          whiskies,
          isMysql
            ? sql`binary ${whiskies.id} = binary ${tastingNotes.whiskyId}`
            : eq(whiskies.id, tastingNotes.whiskyId)
        )
        .where(
          isMysql
            ? and(
                sql`binary ${tastingNotes.status} = 'published'`,
                sql`binary ${tastingNotes.userId} in (${sql.join(topUserIds.map((id) => sql`${id}`), sql`, `)})`
              )
            : and(inArray(tastingNotes.userId, topUserIds), eq(tastingNotes.status, 'published'))
        )
        .orderBy(sql`${tastingNotes.createdAt} desc`)
    : []
  const lastWhiskyByUser = new Map<string, { name: string; imageUrl: string | null }>()
  topUsersLatestNotes.forEach((row: { userId: string; whiskyName: string | null; whiskyImageUrl: string | null }) => {
    if (!row.whiskyName) return
    if (!lastWhiskyByUser.has(row.userId)) {
      lastWhiskyByUser.set(row.userId, {
        name: row.whiskyName,
        imageUrl: row.whiskyImageUrl ? normalizeImage(row.whiskyImageUrl) : null,
      })
    }
  })
  const topUsersWithLatest = topUsersWithMeta.map((user) => ({
    ...user,
    lastWhiskyName: lastWhiskyByUser.get(user.id)?.name || null,
    lastWhiskyImageUrl: lastWhiskyByUser.get(user.id)?.imageUrl || null,
  }))

  type LatestWhisky = {
    id: string
    name: string
    bottleImageUrl: string | null
    createdAt: Date | null
  }

  const latestWhiskies = (await db
    .select({
      id: whiskies.id,
      name: whiskies.name,
      bottleImageUrl: whiskies.bottleImageUrl,
      createdAt: whiskies.createdAt,
    })
    .from(whiskies)
    .orderBy(sql`${whiskies.createdAt} desc`)
    .limit(5)) as LatestWhisky[]

  const recentWindowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const stats = await db
    .select({
      totalWhiskies: sql<number>`count(${whiskies.id})`,
    })
    .from(whiskies)
    .where(gte(whiskies.createdAt, recentWindowStart))

  const noteStats = await db
    .select({
      totalNotes: sql<number>`count(${tastingNotes.id})`,
    })
    .from(tastingNotes)
    .where(and(eq(tastingNotes.status, 'published'), gte(tastingNotes.createdAt, recentWindowStart)))

  const publicUsers = await db
    .select({
      totalPublicUsers: sql<number>`count(${users.id})`,
    })
    .from(users)
    .where(and(gte(users.confirmedAt, recentWindowStart), sql`${users.confirmedAt} is not null`))

  type FollowedRow = { followedId: string }
  const followedRows = (isLoggedIn
    ? await db
        .select({ followedId: follows.followedId })
        .from(follows)
        .where(eq(follows.followerId, session?.user?.id || ''))
    : []) as FollowedRow[]
  const followedIds = followedRows.map((row: FollowedRow) => row.followedId)

  const recentActivities = (isLoggedIn && followedIds.length > 0
    ? await db
        .select({
          id: activities.id,
          type: activities.type,
          createdAt: activities.createdAt,
          actorId: activities.userId,
          actorPseudo: users.pseudo,
          targetId: activities.targetId,
          whiskyName: whiskies.name,
          whiskyImageUrl: sql<string>`coalesce(${whiskies.bottleImageUrl}, ${whiskies.imageUrl})`,
          whiskyType: whiskies.type,
          countryName: countries.name,
          bottlingType: whiskies.bottlingType,
          distillerName: distillers.name,
          bottlerName: bottlers.name,
          location: tastingNotes.location,
          locationVisibility: tastingNotes.locationVisibility,
          city: tastingNotes.city,
          country: tastingNotes.country,
          rating: tastingNotes.rating,
          shelfStatus: userShelf.status,
        })
        .from(activities)
        .leftJoin(
          users,
          isMysql ? sql`binary ${users.id} = binary ${activities.userId}` : eq(users.id, activities.userId)
        )
        .leftJoin(
          whiskies,
          isMysql ? sql`binary ${whiskies.id} = binary ${activities.targetId}` : eq(whiskies.id, activities.targetId)
        )
        .leftJoin(countries, eq(countries.id, whiskies.countryId))
        .leftJoin(distillers, eq(distillers.id, whiskies.distillerId))
        .leftJoin(bottlers, eq(bottlers.id, whiskies.bottlerId))
        .leftJoin(
          tastingNotes,
          isMysql
            ? sql`binary ${tastingNotes.userId} = binary ${activities.userId} and binary ${tastingNotes.whiskyId} = binary ${activities.targetId} and binary ${tastingNotes.status} = 'published'`
            : sql`${tastingNotes.userId} = ${activities.userId} and ${tastingNotes.whiskyId} = ${activities.targetId} and ${tastingNotes.status} = 'published'`
        )
        .leftJoin(
          userShelf,
          isMysql
            ? sql`binary ${userShelf.userId} = binary ${activities.userId} and binary ${userShelf.whiskyId} = binary ${activities.targetId}`
            : sql`${userShelf.userId} = ${activities.userId} and ${userShelf.whiskyId} = ${activities.targetId}`
        )
        .where(inArray(activities.userId, followedIds))
        .orderBy(sql`${activities.createdAt} desc`)
        .limit(8)
    : []) as ActivityItem[]

  const guestActivities = (!isLoggedIn
    ? await db
        .select({
          id: activities.id,
          type: activities.type,
          createdAt: activities.createdAt,
          actorId: activities.userId,
          actorPseudo: users.pseudo,
          targetId: activities.targetId,
          whiskyName: whiskies.name,
          whiskyImageUrl: sql<string>`coalesce(${whiskies.bottleImageUrl}, ${whiskies.imageUrl})`,
          whiskyType: whiskies.type,
          countryName: countries.name,
          bottlingType: whiskies.bottlingType,
          distillerName: distillers.name,
          bottlerName: bottlers.name,
          location: tastingNotes.location,
          locationVisibility: tastingNotes.locationVisibility,
          city: tastingNotes.city,
          country: tastingNotes.country,
          rating: tastingNotes.rating,
          shelfStatus: userShelf.status,
        })
        .from(activities)
        .leftJoin(
          users,
          isMysql ? sql`binary ${users.id} = binary ${activities.userId}` : eq(users.id, activities.userId)
        )
        .leftJoin(
          whiskies,
          isMysql ? sql`binary ${whiskies.id} = binary ${activities.targetId}` : eq(whiskies.id, activities.targetId)
        )
        .leftJoin(countries, eq(countries.id, whiskies.countryId))
        .leftJoin(distillers, eq(distillers.id, whiskies.distillerId))
        .leftJoin(bottlers, eq(bottlers.id, whiskies.bottlerId))
        .leftJoin(
          tastingNotes,
          isMysql
            ? sql`binary ${tastingNotes.userId} = binary ${activities.userId} and binary ${tastingNotes.whiskyId} = binary ${activities.targetId} and binary ${tastingNotes.status} = 'published'`
            : sql`${tastingNotes.userId} = ${activities.userId} and ${tastingNotes.whiskyId} = ${activities.targetId} and ${tastingNotes.status} = 'published'`
        )
        .leftJoin(
          userShelf,
          isMysql
            ? sql`binary ${userShelf.userId} = binary ${activities.userId} and binary ${userShelf.whiskyId} = binary ${activities.targetId}`
            : sql`${userShelf.userId} = ${activities.userId} and ${userShelf.whiskyId} = ${activities.targetId}`
        )
        .where(inArray(activities.type, ['new_note', 'new_whisky', 'shelf_add']))
        .orderBy(sql`${activities.createdAt} desc`)
        .limit(60)
    : []) as ActivityItem[]

  const sourceActivities = isLoggedIn ? recentActivities : guestActivities
  const activityUserIds = sourceActivities.map((row: ActivityItem) => row.actorId)
  type ActivityUserRow = { id: string; pseudo: string | null; visibility: string | null; shelfVisibility: string | null }
  const activityUsers = activityUserIds.length
    ? await db
        .select({ id: users.id, pseudo: users.pseudo, visibility: users.visibility, shelfVisibility: users.shelfVisibility })
        .from(users)
        .where(inArray(users.id, activityUserIds))
    : [] as ActivityUserRow[]
  const activityUsersMap = (activityUsers as ActivityUserRow[]).reduce((acc, row: ActivityUserRow) => {
    acc[row.id] = row
    return acc
  }, {} as Record<string, { id: string; pseudo: string | null; visibility: string | null; shelfVisibility: string | null }>)

  const activitiesVisible = sourceActivities
    .filter((row) => row.type === 'new_note' || row.type === 'new_whisky' || row.type === 'shelf_add')
    .filter((row) => (row.type === 'new_note' ? row.rating !== null : true))
    .filter((row) => activityUsersMap[row.actorId]?.visibility === 'public')
    .filter((row) => (row.type === 'shelf_add' ? activityUsersMap[row.actorId]?.shelfVisibility === 'public' : true))
    .sort((a, b) => {
      const aDate = normalizeActivityDate(a.createdAt)
      const bDate = normalizeActivityDate(b.createdAt)
      const aTime = aDate ? aDate.getTime() : 0
      const bTime = bDate ? bDate.getTime() : 0
      return bTime - aTime
    })
    .map((row) => ({
      ...row,
      location:
        row.locationVisibility === 'public_precise'
          ? row.location
          : [row.city, row.country].filter(Boolean).join(', ') || row.country || null,
    }))
  const activitiesToDisplay = isLoggedIn
    ? activitiesVisible
    : pickActivitiesByType(activitiesVisible, ['new_note', 'new_whisky', 'shelf_add'], 2)
  const whiskiesRecentCount = Number(stats?.[0]?.totalWhiskies || 0)
  const notesRecentCount = Number(noteStats?.[0]?.totalNotes || 0)
  const membersRecentCount = Number(publicUsers?.[0]?.totalPublicUsers || 0)
  const formatUserNotesText = (count: number) => {
    return `${count} ${count <= 1 ? t('home.noteCountSingular') : t('home.noteCountPlural')}`
  }
  const formatFollowersText = (count: number) => {
    return `${count} ${count <= 1 ? t('home.topUsersFollowerSingular') : t('home.topUsersFollowerPlural')}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-10">
        <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm overflow-hidden">
          <h1 className="text-3xl md:text-4xl font-semibold text-gray-900">
            {t('home.title')}
          </h1>
          <p className="mt-3 text-gray-600 text-base md:text-lg max-w-3xl whitespace-pre-line">
            {t('home.heroCommunitySubtitle')}
          </p>
          {!isLoggedIn ? (
            <div className="mt-5">
              <SignupCtaLink
                href={`/${locale}/register`}
                sourceContext="home_hero"
                className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {t('home.ctaJoinCommunity')}
              </SignupCtaLink>
            </div>
          ) : null}
          <div className="mt-6 hidden lg:block -mx-8 -mb-8">
            <HomeHeroCarousel
              slides={[
                {
                  href: `/${locale}/catalogue`,
                  image: '/images/hero/home-hero-catalogue.webp',
                  title: t('home.actionCatalogueTitle'),
                  description: t('home.actionCatalogueDesc'),
                },
                {
                  href: `/${locale}/explorer`,
                  image: '/images/hero/home-hero-explorer.webp',
                  title: t('home.actionExploreTitle'),
                  description: t('home.actionExploreDesc'),
                },
              ]}
            />
          </div>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 lg:hidden">
            <Link
              href={`/${locale}/catalogue`}
              className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-900 p-5 min-h-[170px] flex items-end shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <img
                src="/images/hero/home-hero-catalogue.webp"
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="relative z-10 rounded-xl bg-black/35 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold text-white">{t('home.actionCatalogueTitle')}</div>
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white bg-white/20 border border-white/40 transition"
                >
                  →
                </span>
              </div>
              <div className="mt-2 text-sm text-white/90">{t('home.actionCatalogueDesc')}</div>
              </div>
            </Link>

            <Link
              href={`/${locale}/explorer`}
              className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-900 p-5 min-h-[170px] flex items-end shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <img
                src="/images/hero/home-hero-explorer.webp"
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="relative z-10 rounded-xl bg-black/35 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold text-white">{t('home.actionExploreTitle')}</div>
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white bg-white/20 border border-white/40 transition"
                >
                  →
                </span>
              </div>
              <div className="mt-2 text-sm text-white/90">{t('home.actionExploreDesc')}</div>
              </div>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{t('home.topUsersTitle')}</h2>
              <Link
                href={`/${safeLocale}/explorer`}
                className="text-sm font-medium"
                style={{ color: 'var(--color-primary)' }}
              >
                {t('home.topUsersCta')}
              </Link>
            </div>
            <div className="space-y-4">
              {topUsersWithLatest.map((user) => {
                const avatar = buildAvatar(user.pseudo)
                const flagUrl = getCountryFlagUrl(user.countryId)
                const isSelf = currentUserId && user.id === currentUserId
                const content = (
                  <div className="rounded-xl border border-gray-200 bg-white p-3 transition hover:shadow-sm hover:border-gray-300">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 shrink-0 rounded-full flex items-center justify-center text-white text-lg font-semibold" style={{ backgroundColor: avatar.color }}>
                        {avatar.initial}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-base font-semibold text-gray-900 truncate">{user.pseudo}</div>
                          {flagUrl ? <img src={flagUrl} alt="" className="h-4 w-4 rounded-full shrink-0" /> : null}
                        </div>
                        <div className="text-sm text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span>{formatUserNotesText(Number(user.notesCount || 0))}</span>
                          <span>·</span>
                          <span>{formatFollowersText(Number(user.followersCount || 0))}</span>
                        </div>
                      </div>
                    </div>
                    {user.lastWhiskyName ? (
                      <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          {user.lastWhiskyImageUrl ? (
                            <span className="h-9 w-9 rounded-md bg-white border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                              <img src={user.lastWhiskyImageUrl} alt="" className="h-full w-full object-contain" />
                            </span>
                          ) : null}
                          <div className="text-sm text-gray-700 truncate">
                            <span className="text-gray-500">{t('home.topUsersLastWhisky')}:</span>{' '}
                            <span className="font-medium">{user.lastWhiskyName}</span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
                return (
                  <div key={user.id}>
                    {isSelf ? (
                      <div>{content}</div>
                    ) : (
                      <Link
                        href={`/${safeLocale}/user/${encodeURIComponent(user.pseudo)}`}
                        className="block"
                      >
                        {content}
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{t('home.latestWhiskiesTitle')}</h2>
            </div>
            <div className="space-y-4">
              {latestWhiskies.map((whisky: LatestWhisky) => {
                const imageSrc =
                  typeof whisky.bottleImageUrl === 'string' && whisky.bottleImageUrl.trim() !== ''
                    ? whisky.bottleImageUrl.startsWith('http') || whisky.bottleImageUrl.startsWith('/')
                      ? whisky.bottleImageUrl
                      : `/${whisky.bottleImageUrl}`
                    : ''
                return (
                  <Link
                    key={whisky.id}
                    href={buildWhiskyPath(safeLocale, whisky.id, whisky.name)}
                    className="flex items-center gap-4"
                  >
                    <div
                      className="w-16 h-16 rounded-xl bg-white overflow-hidden flex items-center justify-center"
                      style={{ backgroundColor: '#fff' }}
                    >
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={whisky.name}
                          className="w-full h-full object-contain"
                          style={{ backgroundColor: '#fff' }}
                        />
                      ) : (
                        <span className="text-xs text-gray-400">No image</span>
                      )}
                    </div>
                    <div>
                      <div className="text-base font-semibold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>{whisky.name}</div>
                      <div className="text-sm text-gray-500">
                        {t('home.addedRecently')}
                        {whisky.createdAt ? ` · ${new Date(whisky.createdAt).toLocaleDateString(safeLocale === 'fr' ? 'fr-FR' : 'en-US')}` : ''}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">{t('home.recentStatsTitle')}</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-2xl font-semibold text-gray-900">{whiskiesRecentCount}</div>
              <div className="mt-2 inline-flex items-center text-[0.95rem] font-semibold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-primary-dark-light)' }}>
                {whiskiesRecentCount <= 1 ? t('home.statsWhiskiesSingular') : t('home.statsWhiskiesPlural')}
              </div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-gray-900">{notesRecentCount}</div>
              <div className="mt-2 inline-flex items-center text-[0.95rem] font-semibold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-primary-dark-light)' }}>
                {notesRecentCount <= 1 ? t('home.statsNotesSingular') : t('home.statsNotesPlural')}
              </div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-gray-900">{membersRecentCount}</div>
              <div className="mt-2 inline-flex items-center text-[0.95rem] font-semibold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-primary-dark-light)' }}>
                {membersRecentCount <= 1 ? t('home.statsContributorsSingular') : t('home.statsContributorsPlural')}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">{t('home.activityTitle')}</h2>
          </div>
          {isLoggedIn ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <HomeActivitiesFeed
                locale={safeLocale}
                activities={activitiesToDisplay}
                labels={{
                  noActivity: t('home.noActivity'),
                  activityNote: t('home.activityNote'),
                  activityWhiskyAdded: t('home.activityWhiskyAdded'),
                  activityShelfAdded: t('home.activityShelfAdded'),
                  activityShelfWishlist: t('home.activityShelfWishlist'),
                }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <HomeActivitiesFeed
                  locale={safeLocale}
                  activities={activitiesToDisplay}
                  labels={{
                    noActivity: t('home.noActivity'),
                    activityNote: t('home.activityNote'),
                    activityWhiskyAdded: t('home.activityWhiskyAdded'),
                    activityShelfAdded: t('home.activityShelfAdded'),
                    activityShelfWishlist: t('home.activityShelfWishlist'),
                  }}
                />
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-5 text-center">
                <div className="text-sm text-gray-600">{t('home.activityLoginSubtitle')}</div>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href={`/${safeLocale}/login`}
                    className="px-4 py-2 rounded-full text-white text-sm font-medium transition"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    {t('auth.loginButton')}
                  </Link>
                  <SignupCtaLink
                    href={`/${safeLocale}/register`}
                    sourceContext="home_activity_block"
                    className="px-4 py-2 rounded-full border text-sm font-medium transition"
                    style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                  >
                    {t('auth.register')}
                  </SignupCtaLink>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
