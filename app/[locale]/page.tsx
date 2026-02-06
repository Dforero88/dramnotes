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

export default async function HomePage({
  params,
}: {
  params: { locale: Locale }
}) {
  const { locale } = params
  const t = getTranslations(locale)
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
          <h1 className="text-3xl md:text-4xl font-semibold text-gray-900">
            {t('home.title')}
          </h1>
          <p className="text-gray-600 mt-3 max-w-2xl">
            {t('home.subtitle')}
          </p>
        </div>
      </div>
    </div>
  )

  /*
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-10">
        <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
          <h1 className="text-3xl md:text-4xl font-semibold text-gray-900">
            {t('home.title')}
          </h1>
          <p className="text-gray-600 mt-3 max-w-2xl">
            {t('home.subtitle')}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/${locale}/explorer`}
              className="px-5 py-2 rounded-lg text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {t('home.ctaExplore')}
            </Link>
            {isLoggedIn ? (
              <Link
                href={`/${locale}/add-whisky`}
                className="px-5 py-2 rounded-lg border"
                style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
              >
                {t('home.ctaAddWhisky')}
              </Link>
            ) : (
              <Link
                href={`/${locale}/register`}
                className="px-5 py-2 rounded-lg border"
                style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
              >
                {t('home.ctaRegister')}
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{t('home.topUsersTitle')}</h2>
              <span className="text-sm text-gray-500">{t('home.topUsersSubtitle')}</span>
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
              <span className="text-sm text-gray-500">{t('home.latestWhiskiesSubtitle')}</span>
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
                    <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center">
                      {imageSrc ? (
                        <img src={imageSrc} alt={whisky.name} className="w-full h-full object-contain" />
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
              <span className="text-sm text-gray-500">{t('home.activitySubtitle')}</span>
            </div>
            <div className="space-y-4">
              {activitiesVisible.map((activity) => {
                const pseudo = activity.actorPseudo || 'User'
                const avatar = buildAvatar(pseudo)
                const isFollow = activity.type === 'new_follow'
                const title = isFollow
                  ? `${t('home.activityFollow')} ${activity.targetPseudo || '—'}`
                  : `${t('home.activityNote')} ${activity.whiskyName || '—'}`
                return (
                  <Link
                    key={activity.id}
                    href={
                      isFollow
                        ? `/${locale}/user/${encodeURIComponent(activity.targetPseudo || '')}`
                        : `/${locale}/whisky/${activity.targetId}?user=${encodeURIComponent(pseudo)}`
                    }
                    className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                        style={{ backgroundColor: avatar.color }}
                      >
                        {avatar.initial}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-gray-500">{pseudo}</div>
                        <div className="text-base font-semibold text-gray-900 truncate">{title}</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 whitespace-nowrap">
                      {!isFollow && activity.rating ? `${activity.rating}/10` : ''}
                    </div>
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
  */
}
