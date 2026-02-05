import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTranslations, type Locale } from '@/lib/i18n'
import { db, tastingNotes, users, whiskies } from '@/lib/db'
import { eq, sql } from 'drizzle-orm'

type TopUser = {
  id: string
  pseudo: string
  notesCount: number
}

type RecentNote = {
  id: string
  tastingDate: string
  rating: number | null
  whiskyId: string
  whiskyName: string | null
  pseudo: string | null
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
  const session = await getServerSession(authOptions)
  const isLoggedIn = Boolean(session?.user?.id)

  const topUsers = (await db
    .select({
      id: users.id,
      pseudo: users.pseudo,
      notesCount: sql<number>`count(${tastingNotes.id})`,
    })
    .from(users)
    .leftJoin(tastingNotes, eq(tastingNotes.userId, users.id))
    .where(eq(users.visibility, 'public'))
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
    .where(eq(users.visibility, 'public'))

  const recentNotes = (isLoggedIn
    ? await db
        .select({
          id: tastingNotes.id,
          tastingDate: tastingNotes.tastingDate,
          rating: tastingNotes.rating,
          whiskyId: tastingNotes.whiskyId,
          whiskyName: whiskies.name,
          pseudo: users.pseudo,
        })
        .from(tastingNotes)
        .leftJoin(users, eq(users.id, tastingNotes.userId))
        .leftJoin(whiskies, eq(whiskies.id, tastingNotes.whiskyId))
        .where(eq(users.visibility, 'public'))
        .orderBy(sql`${tastingNotes.createdAt} desc`)
        .limit(5)
    : []) as RecentNote[]

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
                return (
                  <div key={user.id} className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold" style={{ backgroundColor: avatar.color }}>
                      {avatar.initial}
                    </div>
                    <div>
                      <div className="text-base font-semibold text-gray-900">{user.pseudo}</div>
                      <div className="text-sm text-gray-500">
                        {t('home.notesCount')} {Number(user.notesCount || 0)}
                      </div>
                    </div>
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
                      <div className="text-sm text-gray-500">{t('home.addedRecently')}</div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="text-sm text-gray-500">{t('home.statsWhiskies')}</div>
            <div className="text-2xl font-semibold text-gray-900">{Number(stats?.[0]?.totalWhiskies || 0)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="text-sm text-gray-500">{t('home.statsNotes')}</div>
            <div className="text-2xl font-semibold text-gray-900">{Number(noteStats?.[0]?.totalNotes || 0)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="text-sm text-gray-500">{t('home.statsContributors')}</div>
            <div className="text-2xl font-semibold text-gray-900">{Number(publicUsers?.[0]?.totalPublicUsers || 0)}</div>
          </div>
        </div>

        {isLoggedIn && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{t('home.recentNotesTitle')}</h2>
              <span className="text-sm text-gray-500">{t('home.recentNotesSubtitle')}</span>
            </div>
            <div className="space-y-4">
              {recentNotes.map((note) => {
                const pseudo = note.pseudo || 'User'
                const avatar = buildAvatar(pseudo)
                return (
                  <Link
                    key={note.id}
                    href={`/${locale}/whisky/${note.whiskyId}?user=${encodeURIComponent(pseudo)}`}
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
                        <div className="text-base font-semibold text-gray-900 truncate">{note.whiskyName}</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 whitespace-nowrap">
                      {note.rating || 0}/10
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
