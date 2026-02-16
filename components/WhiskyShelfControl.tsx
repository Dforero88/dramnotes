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

function ShelfStatusIcon({ status }: { status: Exclude<ShelfStatus, 'none'> }) {
  if (status === 'wishlist') {
    return (
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20s-6.5-4.2-8.5-7A5.2 5.2 0 0 1 12 6.4 5.2 5.2 0 0 1 20.5 13c-2 2.8-8.5 7-8.5 7z" />
      </svg>
    )
  }
  if (status === 'owned_unopened') {
    return (
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.5 4.5C8.2 7.6 7 9.7 7 12a3.5 3.5 0 0 0 7 0c0-2.3-1.2-4.4-3.5-7.5z" />
        <path d="M17.2 8.2c-1.6 2.1-2.4 3.6-2.4 5a2.4 2.4 0 0 0 4.8 0c0-1.4-.8-2.9-2.4-5z" />
      </svg>
    )
  }
  if (status === 'owned_opened') {
    return (
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 4.5C9.2 8.2 7.5 10.7 7.5 13.3a4.5 4.5 0 0 0 9 0c0-2.6-1.7-5.1-4.5-8.8z" />
        <path d="M8.8 14h6.4" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4.5C9.2 8.2 7.5 10.7 7.5 13.3a4.5 4.5 0 0 0 9 0c0-2.6-1.7-5.1-4.5-8.8z" />
      <path d="M5 19 19 5" />
    </svg>
  )
}

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
              className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs leading-none border transition ${active ? 'text-white border-transparent' : 'bg-white text-gray-700 border-gray-200 hover:bg-[var(--color-primary-light)] hover:border-[var(--color-primary)]'} disabled:opacity-60`}
              style={active ? { backgroundColor: 'var(--color-primary)' } : {}}
            >
              <span className="inline-flex items-center gap-1.5">
                <ShelfStatusIcon status={opt.status} />
                <span className="leading-none">{t(opt.key)}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
