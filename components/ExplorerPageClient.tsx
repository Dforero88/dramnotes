'use client'

import { useAuth } from '@/hooks/useAuth'
import { useParams } from 'next/navigation'
import { getTranslations, type Locale } from '@/lib/i18n'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { trackEvent } from '@/lib/analytics-client'
import SignupCtaLink from '@/components/SignupCtaLink'

type ExplorerUser = {
  id: string
  pseudo: string
  notesCount: number
  isFollowing?: boolean
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

function FollowActionIcon({ following }: { following?: boolean }) {
  if (following) {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 19a4 4 0 0 0-8 0" />
        <circle cx="12" cy="8" r="3.5" />
        <path d="M18.5 10.5 20 12l3-3" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 19a4 4 0 0 0-8 0" />
      <circle cx="12" cy="8" r="3.5" />
      <path d="M21 12h-5M18.5 9.5v5" />
    </svg>
  )
}

export default function ExplorerPageClient() {
  const params = useParams()
  const locale = params.locale as Locale
  const t = getTranslations(locale)
  const { isLoggedIn, isLoading, user: viewer } = useAuth()

  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [users, setUsers] = useState<ExplorerUser[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isTop, setIsTop] = useState(false)
  const [loading, setLoading] = useState(false)
  const [followLoadingId, setFollowLoadingId] = useState<string | null>(null)
  const pendingSearchRef = useRef<{ queryLength: number } | null>(null)
  const noteCountText = (count: number) => {
    return `${count} ${count <= 1 ? t('explorer.noteCountSingular') : t('explorer.noteCountPlural')}`
  }

  const trimmedQuery = useMemo(() => query.trim(), [query])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('q', isLoggedIn ? appliedQuery : '')
      params.set('page', String(page))
      params.set('pageSize', '12')
      const res = await fetch(`/api/explorer/users?${params.toString()}`, { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        setUsers(json.items || [])
        setTotalPages(json.totalPages || 1)
        setIsTop(Boolean(json.isTop))
        if (pendingSearchRef.current && page === 1) {
          trackEvent('search_performed', {
            query_length: pendingSearchRef.current.queryLength,
            filters_count: 0,
            filter_types: '',
            results_count: Number(json?.total ?? (json?.items || []).length),
            source_context: 'explorer',
          })
          pendingSearchRef.current = null
        }
      }
      setLoading(false)
    }
    run()
  }, [appliedQuery, page, isLoggedIn])

  const handleToggleFollow = async (targetId: string) => {
    if (followLoadingId) return
    setFollowLoadingId(targetId)
    try {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: targetId }),
      })
      if (res.ok) {
        const json = await res.json()
        setUsers((prev) =>
          prev.map((u) => (u.id === targetId ? { ...u, isFollowing: Boolean(json.following) } : u))
        )
        if (json.following) {
          trackEvent('follow_user', { target_user_id: targetId })
        } else {
          trackEvent('unfollow_user', { target_user_id: targetId })
        }
      }
    } finally {
      setFollowLoadingId(null)
    }
  }

  if (isLoading) return <div className="p-8">{t('common.loading')}</div>

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
            disabled={!isLoggedIn}
            className="w-full outline-none text-sm disabled:text-gray-400 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={() => {
              if (!isLoggedIn) return
              pendingSearchRef.current = { queryLength: trimmedQuery.length }
              setAppliedQuery(trimmedQuery)
              setPage(1)
            }}
            disabled={!isLoggedIn}
            className="px-4 py-2 rounded-lg text-white text-sm"
            style={{ backgroundColor: !isLoggedIn ? '#9ca3af' : 'var(--color-primary)' }}
          >
            {t('explorer.searchButton')}
          </button>
        </div>
      </div>

      {isTop && (
        <div className="mb-4 text-sm text-gray-600">
          <span className="font-medium text-gray-800">{t('explorer.topTitle')}</span>
        </div>
      )}

      {loading && <div className="text-sm text-gray-500 mb-4">{t('common.loading')}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((user) => {
          const avatar = buildAvatar(user.pseudo)
          const isSelf = viewer?.id === user.id
          return (
            <div
              key={user.id}
              className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {isSelf || !isLoggedIn ? (
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold"
                      style={{ backgroundColor: avatar.color }}
                    >
                      {avatar.initial}
                    </div>
                  ) : (
                    <Link
                      href={`/${locale}/user/${encodeURIComponent(user.pseudo)}`}
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold"
                      style={{ backgroundColor: avatar.color }}
                    >
                      {avatar.initial}
                    </Link>
                  )}
                  <div className="space-y-0.5">
                    {isSelf || !isLoggedIn ? (
                      <div className="text-base font-semibold text-gray-900">{user.pseudo}</div>
                    ) : (
                      <Link
                        href={`/${locale}/user/${encodeURIComponent(user.pseudo)}`}
                        className="text-base font-semibold text-gray-900 hover:text-[var(--color-primary)] transition-colors"
                      >
                        {user.pseudo}
                      </Link>
                    )}
                    <div className="text-sm text-gray-500">
                      {noteCountText(user.notesCount)}
                    </div>
                  </div>
                </div>

                {!isSelf && isLoggedIn && (
                  <button
                    type="button"
                    onClick={() => handleToggleFollow(user.id)}
                    disabled={followLoadingId === user.id}
                    aria-label={user.isFollowing ? t('notebook.followActionFollowing') : t('notebook.followActionFollow')}
                    title={user.isFollowing ? t('notebook.followActionFollowing') : t('notebook.followActionFollow')}
                    className={`h-10 w-10 inline-flex items-center justify-center rounded-full transition ${followLoadingId === user.id ? 'opacity-70' : ''}`}
                    style={{
                      backgroundColor: user.isFollowing ? 'var(--color-primary-light)' : 'var(--color-primary)',
                      color: user.isFollowing ? 'var(--color-primary)' : '#fff',
                    }}
                  >
                    <FollowActionIcon following={user.isFollowing} />
                  </button>
                )}
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

      {!isLoggedIn && (
        <div className="mt-10 max-w-md mx-auto w-full p-8 bg-white rounded-2xl shadow-sm text-center border border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-800 mb-3">{t('explorer.loginTitle')}</h2>
          <p className="text-gray-600 mb-6">{t('explorer.loginSubtitle')}</p>
          <div className="flex flex-col gap-3">
            <Link
              href={`/${locale}/login`}
              className="block w-full py-3 rounded-xl text-center text-white text-sm font-medium transition"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {t('navigation.signIn')}
            </Link>
            <SignupCtaLink
              href={`/${locale}/register`}
              sourceContext="explorer_guest_block"
              className="block w-full py-3 rounded-xl text-center border text-sm font-medium transition"
              style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
            >
              {t('navigation.signUp')}
            </SignupCtaLink>
          </div>
        </div>
      )}
    </div>
  )
}
