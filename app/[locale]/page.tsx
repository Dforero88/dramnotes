import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTranslations, type Locale } from '@/lib/i18n'
import { db, tastingNotes, users, whiskies, follows, activities, countries, distillers, bottlers, isMysql } from '@/lib/db'
import { eq, inArray, sql } from 'drizzle-orm'
import type { Metadata } from 'next'
import HomeHeroCarousel from '@/components/HomeHeroCarousel'
import { buildWhiskyPath } from '@/lib/whisky-url'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  const t = getTranslations(locale)
  return { title: t('home.pageTitle') }
}

type TopUser = {
  id: string
  pseudo: string
  notesCount: number
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
  rating: number | null
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

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const t = getTranslations(locale)
  const session = await getServerSession(authOptions)
  const isLoggedIn = Boolean(session?.user?.id)
  const currentUserId = session?.user?.id || null

  const topUsers = (await db
    .select({
      id: users.id,
      pseudo: users.pseudo,
      notesCount: sql<number>`count(${tastingNotes.id})`,
    })
    .from(users)
    .leftJoin(
      tastingNotes,
      isMysql ? sql`binary ${tastingNotes.userId} = binary ${users.id}` : eq(tastingNotes.userId, users.id)
    )
    .where(isMysql ? sql`binary ${users.visibility} = 'public'` : eq(users.visibility, 'public'))
    .groupBy(users.id)
    .orderBy(sql`count(${tastingNotes.id}) desc`)
    .limit(3)) as TopUser[]

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

  const stats = await db
    .select({
      totalWhiskies: sql<number>`count(${whiskies.id})`,
    })
    .from(whiskies)

  const noteStats = await db
    .select({
      totalNotes: sql<number>`count(${tastingNotes.id})`,
    })
    .from(tastingNotes)

  const publicUsers = await db
    .select({
      totalPublicUsers: sql<number>`count(${users.id})`,
    })
    .from(users)
    .where(isMysql ? sql`binary ${users.visibility} = 'public'` : eq(users.visibility, 'public'))

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
          rating: tastingNotes.rating,
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
            ? sql`binary ${tastingNotes.userId} = binary ${activities.userId} and binary ${tastingNotes.whiskyId} = binary ${activities.targetId}`
            : sql`${tastingNotes.userId} = ${activities.userId} and ${tastingNotes.whiskyId} = ${activities.targetId}`
        )
        .where(inArray(activities.userId, followedIds))
        .orderBy(sql`${activities.createdAt} desc`)
        .limit(8)
    : []) as ActivityItem[]

  const activityUserIds = recentActivities.map((row: ActivityItem) => row.actorId)
  type ActivityUserRow = { id: string; pseudo: string | null; visibility: string | null }
  const activityUsers = activityUserIds.length
    ? await db
        .select({ id: users.id, pseudo: users.pseudo, visibility: users.visibility })
        .from(users)
        .where(inArray(users.id, activityUserIds))
    : [] as ActivityUserRow[]
  const activityUsersMap = (activityUsers as ActivityUserRow[]).reduce((acc, row: ActivityUserRow) => {
    acc[row.id] = row
    return acc
  }, {} as Record<string, { id: string; pseudo: string | null; visibility: string | null }>)

  const activitiesVisible = recentActivities
    .filter((row) => row.type === 'new_note' || row.type === 'new_whisky')
    .filter((row) => (row.type === 'new_note' ? row.rating !== null : true))
    .filter((row) => activityUsersMap[row.actorId]?.visibility === 'public')
    .sort((a, b) => {
      const aDate = normalizeActivityDate(a.createdAt)
      const bDate = normalizeActivityDate(b.createdAt)
      const aTime = aDate ? aDate.getTime() : 0
      const bTime = bDate ? bDate.getTime() : 0
      return bTime - aTime
    })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-10">
        <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm overflow-hidden">
          <h1 className="text-3xl md:text-4xl font-semibold text-gray-900">
            {t('home.title')}
          </h1>
          <div className="mt-6 hidden lg:block -mx-8 -mb-8">
            <HomeHeroCarousel
              slides={[
                {
                  href: `/${locale}/catalogue`,
                  image: '/images/hero/home-hero-catalogue.png',
                  title: t('home.actionCatalogueTitle'),
                  description: t('home.actionCatalogueDesc'),
                },
                {
                  href: `/${locale}/explorer`,
                  image: '/images/hero/home-hero-explorer.png',
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
                src="/images/hero/home-hero-catalogue.png"
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/25" />
              <div className="relative z-10">
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
                src="/images/hero/home-hero-explorer.png"
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/25" />
              <div className="relative z-10">
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
            </div>
            <div className="space-y-4">
              {topUsers.map((user) => {
                const avatar = buildAvatar(user.pseudo)
                const isSelf = currentUserId && user.id === currentUserId
                const content = (
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold" style={{ backgroundColor: avatar.color }}>
                      {avatar.initial}
                    </div>
                    <div>
                      <div className="text-base font-semibold text-gray-900">{user.pseudo}</div>
                      <div className="text-sm text-gray-500">
                        {Number(user.notesCount || 0)} {t('home.notesCount')}
                      </div>
                    </div>
                  </div>
                )
                return (
                  <div key={user.id}>
                    {isSelf ? (
                      <div>{content}</div>
                    ) : (
                      <Link
                        href={`/${locale}/user/${encodeURIComponent(user.pseudo)}`}
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
                    href={buildWhiskyPath(locale, whisky.id, whisky.name)}
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
                        {whisky.createdAt ? ` · ${new Date(whisky.createdAt).toLocaleDateString(locale)}` : ''}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="text-2xl font-semibold text-gray-900">{Number(stats?.[0]?.totalWhiskies || 0)}</div>
            <div className="mt-2 inline-flex items-center text-[0.95rem] font-semibold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-primary-dark-light)' }}>
              {t('home.statsWhiskies')}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="text-2xl font-semibold text-gray-900">{Number(noteStats?.[0]?.totalNotes || 0)}</div>
            <div className="mt-2 inline-flex items-center text-[0.95rem] font-semibold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-primary-dark-light)' }}>
              {t('home.statsNotes')}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="text-2xl font-semibold text-gray-900">{Number(publicUsers?.[0]?.totalPublicUsers || 0)}</div>
            <div className="mt-2 inline-flex items-center text-[0.95rem] font-semibold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-primary-dark-light)' }}>
              {t('home.statsContributors')}
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">{t('home.activityTitle')}</h2>
          </div>
          {isLoggedIn ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {activitiesVisible.map((activity) => {
                const pseudo = activity.actorPseudo || 'User'
                const avatar = buildAvatar(pseudo)
                const isNewWhisky = activity.type === 'new_whisky'
                const title = isNewWhisky
                  ? `${t('home.activityWhiskyAdded')}`
                  : `${t('home.activityNote')}`
                const createdAt = normalizeActivityDate(activity.createdAt)
                const activityDate = createdAt ? formatRelativeDate(createdAt, locale) : ''
                const href = `${buildWhiskyPath(locale, activity.targetId, activity.whiskyName || undefined)}?user=${encodeURIComponent(pseudo)}`
                const whiskyImage = normalizeImage(activity.whiskyImageUrl)
                const rawProducerName = activity.bottlingType === 'DB'
                  ? activity.distillerName
                  : activity.bottlerName
                const producerName = (() => {
                  const cleaned = rawProducerName?.trim()
                  if (cleaned && cleaned !== '-') return cleaned
                  const fallback = (activity.distillerName || activity.bottlerName || '').trim()
                  return fallback && fallback !== '-' ? fallback : ''
                })()
                const noteLocation = (() => {
                  const cleaned = (activity.location || '').trim()
                  return cleaned && cleaned !== '-' ? cleaned : ''
                })()
                const rowContent = (
                  <>
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                        style={{ backgroundColor: avatar.color }}
                      >
                        {avatar.initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <span className="font-medium text-gray-700">{pseudo}</span>
                          <span>{title}</span>
                        </div>
                        <div className="mt-2 flex items-stretch gap-3 min-w-0">
                          <div className="w-14 h-20 sm:w-20 sm:min-h-[96px] rounded-lg border border-gray-200 bg-white overflow-hidden flex items-center justify-center shrink-0">
                            {whiskyImage ? (
                              <img
                                src={whiskyImage}
                                alt={activity.whiskyName || ''}
                                className="w-full h-full object-contain"
                                style={{ backgroundColor: '#fff' }}
                              />
                            ) : (
                              <span className="text-[10px] text-gray-400">—</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 flex flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                              <div className="text-base font-semibold text-gray-900 min-w-0 flex-1 leading-tight break-words" style={{ fontFamily: 'var(--font-heading)' }}>
                                {activity.whiskyName || '—'}
                              </div>
                              {!isNewWhisky && activity.rating ? (
                                <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-2 py-1 text-xs leading-none font-semibold shrink-0">
                                  ★ {activity.rating}/10
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                              {activity.whiskyType ? <span>{activity.whiskyType}</span> : null}
                              {activity.countryName ? <span>· {activity.countryName}</span> : null}
                            </div>
                            {isNewWhisky ? (
                              producerName ? (
                                <div className="text-xs text-gray-500 break-words">{producerName}</div>
                              ) : null
                            ) : noteLocation ? (
                              <div className="text-xs text-gray-500 break-words">{noteLocation}</div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 leading-none whitespace-nowrap shrink-0 self-end sm:self-start">
                      {activityDate}
                    </div>
                  </>
                )

                return (
                  <Link
                    key={activity.id}
                    href={href}
                    className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 hover:border-gray-200 hover:shadow-sm transition"
                  >
                    {rowContent}
                  </Link>
                )
              })}
              {activitiesVisible.length === 0 && (
                <div className="text-sm text-gray-500">{t('home.noActivity')}</div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-5 text-center">
              <div className="text-sm text-gray-600">{t('home.activityLoginSubtitle')}</div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={`/${locale}/login`}
                  className="px-4 py-2 rounded-full text-white text-sm font-medium transition"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {t('auth.loginButton')}
                </Link>
                <Link
                  href={`/${locale}/register`}
                  className="px-4 py-2 rounded-full border text-sm font-medium transition"
                  style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                >
                  {t('auth.register')}
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
