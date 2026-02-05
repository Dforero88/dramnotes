'use client'

import { useAuth } from '@/hooks/useAuth'
import { useParams } from 'next/navigation'
import { getTranslations, type Locale } from '@/lib/i18n'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type ExplorerUser = {
  id: string
  pseudo: string
  notesCount: number
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
  const index = Math.abs(hash) % colors.length
  const color = colors[index]
  const initial = pseudo.charAt(0).toUpperCase()
  return { color, initial }
}

export default function ExplorerPage() {
  const params = useParams()
  const locale = params.locale as Locale
  const t = getTranslations(locale)
  const { isLoggedIn, isLoading } = useAuth()

  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [users, setUsers] = useState<ExplorerUser[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isTop, setIsTop] = useState(false)
  const [loading, setLoading] = useState(false)

  const trimmedQuery = useMemo(() => query.trim(), [query])

  useEffect(() => {
    if (!isLoggedIn) return
    const run = async () => {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('q', appliedQuery)
      params.set('page', String(page))
      params.set('pageSize', '12')
      const res = await fetch(`/api/explorer/users?${params.toString()}`, { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        setUsers(json.items || [])
        setTotalPages(json.totalPages || 1)
        setIsTop(Boolean(json.isTop))
      }
      setLoading(false)
    }
    run()
  }, [appliedQuery, page, isLoggedIn])

  if (isLoading) return <div className="p-8">{t('common.loading')}</div>
  if (!isLoggedIn) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-sm text-center border border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-800 mb-3">{t('explorer.loginTitle')}</h2>
          <p className="text-gray-600 mb-6">{t('explorer.loginSubtitle')}</p>
          <div className="flex gap-4 justify-center">
            <Link
              href={`/${locale}/login`}
              className="py-2 px-6 text-white rounded-lg"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {t('navigation.signIn')}
            </Link>
            <Link
              href={`/${locale}/register`}
              className="py-2 px-6 bg-white rounded-lg border"
              style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
            >
              {t('navigation.signUp')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">{t('explorer.title')}</h1>
        <p className="text-gray-600 mt-2">{t('explorer.subtitle')}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('explorer.searchPlaceholder')}
            className="w-full outline-none text-sm"
          />
          <button
            type="button"
            onClick={() => {
              setAppliedQuery(trimmedQuery)
              setPage(1)
            }}
            className="px-4 py-2 rounded-lg text-white text-sm"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {t('explorer.searchButton')}
          </button>
        </div>
      </div>

      {isTop && (
        <div className="mb-4 text-sm text-gray-600">
          <span className="font-medium text-gray-800">{t('explorer.topTitle')}</span>
          <span className="ml-2">{t('explorer.topSubtitle')}</span>
        </div>
      )}

      {loading && <div className="text-sm text-gray-500 mb-4">{t('common.loading')}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((user) => {
          const avatar = buildAvatar(user.pseudo)
          return (
            <div
              key={user.id}
              className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold"
                  style={{ backgroundColor: avatar.color }}
                >
                  {avatar.initial}
                </div>
                <div>
                  <div className="text-base font-semibold text-gray-900">{user.pseudo}</div>
                  <div className="text-sm text-gray-500">
                    {t('explorer.notesCount')} {user.notesCount}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {!loading && users.length === 0 && (
        <div className="text-sm text-gray-600 mt-6">{t('explorer.noResults')}</div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-10">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
          >
            {t('catalogue.prev')}
          </button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
          >
            {t('catalogue.next')}
          </button>
        </div>
      )}
    </div>
  )
}
