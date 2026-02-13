'use client'

import { useEffect, useState } from 'react'
import { trackEvent } from '@/lib/analytics-client'
import { getTranslations, type Locale } from '@/lib/i18n'

type ShelfStatus = 'wishlist' | 'owned_unopened' | 'owned_opened' | 'finished' | 'none'

const OPTIONS: { status: Exclude<ShelfStatus, 'none'>; key: string }[] = [
  { status: 'wishlist', key: 'notebook.shelfWishlist' },
  { status: 'owned_unopened', key: 'notebook.shelfOwnedNew' },
  { status: 'owned_opened', key: 'notebook.shelfOwnedOpen' },
  { status: 'finished', key: 'notebook.shelfFinished' },
]

export default function WhiskyShelfControl({
  locale,
  whiskyId,
  isLoggedIn,
}: {
  locale: Locale
  whiskyId: string
  isLoggedIn: boolean
}) {
  const t = getTranslations(locale)
  const [status, setStatus] = useState<ShelfStatus>('none')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isLoggedIn) return
    const load = async () => {
      try {
        const res = await fetch(`/api/shelf/status?whiskyId=${encodeURIComponent(whiskyId)}`, { cache: 'no-store' })
        const json = await res.json()
        if (res.ok) setStatus((json?.status || 'none') as ShelfStatus)
      } catch {
        // noop
      }
    }
    load()
  }, [isLoggedIn, whiskyId])

  const updateStatus = async (next: ShelfStatus) => {
    if (!isLoggedIn || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/shelf/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whiskyId, status: next }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Error')
      setStatus(next)
      trackEvent('shelf_status_set', { whisky_id: whiskyId, status: next })
    } catch {
      // keep previous state silently
    } finally {
      setLoading(false)
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
        <h2 className="text-lg font-semibold text-gray-900">{t('notebook.shelfTitle')}</h2>
        <div className="text-sm text-gray-600 mt-1">{t('notebook.shelfLogin')}</div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900">{t('notebook.shelfTitle')}:</h2>
        {OPTIONS.map((opt) => {
          const active = status === opt.status
          return (
            <button
              key={opt.status}
              onClick={() => updateStatus(active ? 'none' : opt.status)}
              disabled={loading}
              aria-pressed={active}
              className={`px-2.5 py-1 rounded-full text-xs border transition ${active ? 'text-white border-transparent' : 'bg-white text-gray-700 border-gray-200 hover:bg-[var(--color-primary-light)] hover:border-[var(--color-primary)]'} disabled:opacity-60`}
              style={active ? { backgroundColor: 'var(--color-primary)' } : {}}
            >
              {t(opt.key)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
