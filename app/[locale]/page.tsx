import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTranslations, type Locale } from '@/lib/i18n'
import { db, tastingNotes, users, whiskies, follows, activities, isMysql } from '@/lib/db'
import { eq, inArray, sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
  rating: number | null
  targetPseudo: string | null
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

export default async function HomePage({
  params,
}: {
  params: { locale: Locale }
}) {
  const { locale } = params
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
        .leftJoin(
          tastingNotes,
          isMysql
            ? sql`binary ${tastingNotes.userId} = binary ${activities.userId} and binary ${tastingNotes.whiskyId} = binary ${activities.targetId}`
            : sql`${tastingNotes.userId} = ${activities.userId} and ${tastingNotes.whiskyId} = ${activities.targetId}`
        )
        .where(inArray(activities.userId, followedIds))
        .orderBy(sql`${activities.createdAt} desc`)
        .limit(5)
    : []) as ActivityItem[]

  const activityUserIds = recentActivities.flatMap((row: ActivityItem) => [row.actorId, row.targetId])
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
    .filter((row) => activityUsersMap[row.actorId]?.visibility === 'public')
    .filter((row) => row.type !== 'new_follow' || activityUsersMap[row.targetId]?.visibility === 'public')
    .map((row) => ({
      ...row,
      targetPseudo: activityUsersMap[row.targetId]?.pseudo || null,
    }))
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
        <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
          <h1 className="text-3xl md:text-4xl font-semibold text-gray-900">
            {t('home.title')}
          </h1>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href={`/${locale}/catalogue`}
              className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold text-gray-900">{t('home.actionCatalogueTitle')}</div>
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  →
                </span>
              </div>
              <div className="mt-2 text-sm text-gray-600">{t('home.actionCatalogueDesc')}</div>
            </Link>

            <Link
              href={`/${locale}/explorer`}
              className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold text-gray-900">{t('home.actionExploreTitle')}</div>
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  →
                </span>
              </div>
              <div className="mt-2 text-sm text-gray-600">{t('home.actionExploreDesc')}</div>
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
                    href={`/${locale}/whisky/${whisky.id}`}
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
                      <div className="text-base font-semibold text-gray-900">{whisky.name}</div>
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
            <div className="text-sm text-gray-500 mt-1">{t('home.statsWhiskies')}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="text-2xl font-semibold text-gray-900">{Number(noteStats?.[0]?.totalNotes || 0)}</div>
            <div className="text-sm text-gray-500 mt-1">{t('home.statsNotes')}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="text-2xl font-semibold text-gray-900">{Number(publicUsers?.[0]?.totalPublicUsers || 0)}</div>
            <div className="text-sm text-gray-500 mt-1">{t('home.statsContributors')}</div>
          </div>
        </div>

        {isLoggedIn && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{t('home.activityTitle')}</h2>
            </div>
            <div className="space-y-4">
              {activitiesVisible.map((activity) => {
                const pseudo = activity.actorPseudo || 'User'
                const avatar = buildAvatar(pseudo)
                const isFollow = activity.type === 'new_follow'
                const isSelfTarget = isFollow && activity.targetId === currentUserId
                const title = isFollow
                  ? `${t('home.activityFollow')} ${activity.targetPseudo || '—'}`
                  : `${t('home.activityNote')} ${activity.whiskyName || '—'}`
                const createdAt = normalizeActivityDate(activity.createdAt)
                const activityDate = createdAt ? formatRelativeDate(createdAt, locale) : ''
                const href = isFollow
                  ? `/${locale}/user/${encodeURIComponent(activity.targetPseudo || '')}`
                  : `/${locale}/whisky/${activity.targetId}?user=${encodeURIComponent(pseudo)}`
                const rowContent = (
                  <>
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                        style={{ backgroundColor: avatar.color }}
                      >
                        {avatar.initial}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-gray-500">
                          <span className="font-medium text-gray-700">{pseudo}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-base font-semibold text-gray-900">
                          <span className="truncate">{title}</span>
                          {!isFollow && activity.rating ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-xs font-semibold">
                              ★ {activity.rating}/10
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 whitespace-nowrap">
                      {activityDate ? <div className="text-xs text-gray-400 mb-1">{activityDate}</div> : null}
                    </div>
                  </>
                )

                if (isSelfTarget) {
                  return (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                    >
                      {rowContent}
                    </div>
                  )
                }

                return (
                  <Link
                    key={activity.id}
                    href={href}
                    className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 hover:border-gray-200 hover:shadow-sm transition"
                  >
                    {rowContent}
                  </Link>
                )
              })}
              {activitiesVisible.length === 0 && (
                <div className="text-sm text-gray-500">{t('home.noActivity')}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
