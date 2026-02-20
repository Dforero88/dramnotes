'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { getTranslations, type Locale } from '@/lib/i18n'
import { trackEvent } from '@/lib/analytics-client'

const ACTION_THRESHOLD = 3
const ACTION_KEY = 'guest_actions_count'
const DISMISSED_KEY = 'guest_nudge_dismissed'
const SEEN_KEY = 'guest_nudge_seen'

export default function GuestSignupNudge() {
  const pathname = usePathname()
  const { status } = useSession()
  const [open, setOpen] = useState(false)
  const lastActionAtRef = useRef(0)

  const locale: Locale = useMemo(() => {
    if (pathname?.startsWith('/en')) return 'en'
    return 'fr'
  }, [pathname])
  const t = getTranslations(locale)

  useEffect(() => {
    if (status !== 'unauthenticated') return
    if (typeof window === 'undefined') return

    const isDismissed = sessionStorage.getItem(DISMISSED_KEY) === '1'
    const seen = sessionStorage.getItem(SEEN_KEY) === '1'
    const count = Number(sessionStorage.getItem(ACTION_KEY) || '0')
    if (!isDismissed && !seen && count >= ACTION_THRESHOLD) {
      setOpen(true)
      sessionStorage.setItem(SEEN_KEY, '1')
    }
  }, [status])

  useEffect(() => {
    if (status !== 'unauthenticated') return
    if (typeof window === 'undefined') return

    const trackInteraction = (event: Event) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (target.closest('[data-nudge-ignore="1"]')) return
      if (!target.closest('a,button,[role="button"],input,select,textarea')) return

      const now = Date.now()
      if (now - lastActionAtRef.current < 900) return
      lastActionAtRef.current = now

      const current = Number(sessionStorage.getItem(ACTION_KEY) || '0')
      const next = current + 1
      sessionStorage.setItem(ACTION_KEY, String(next))

      const isDismissed = sessionStorage.getItem(DISMISSED_KEY) === '1'
      const seen = sessionStorage.getItem(SEEN_KEY) === '1'
      if (!isDismissed && !seen && next >= ACTION_THRESHOLD) {
        setOpen(true)
        sessionStorage.setItem(SEEN_KEY, '1')
      }
    }

    document.addEventListener('click', trackInteraction, true)
    return () => document.removeEventListener('click', trackInteraction, true)
  }, [status])

  useEffect(() => {
    if (!open) return
    const timeout = setTimeout(() => setOpen(false), 10000)
    return () => clearTimeout(timeout)
  }, [open])

  if (status !== 'unauthenticated' || !open) return null

  return (
    <div
      data-nudge-ignore="1"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-[420px] z-50"
    >
      <div className="rounded-2xl border border-gray-200 bg-white/95 backdrop-blur shadow-lg p-4">
        <button
          type="button"
          data-nudge-ignore="1"
          onClick={() => {
            if (typeof window !== 'undefined') sessionStorage.setItem(DISMISSED_KEY, '1')
            setOpen(false)
          }}
          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          ×
        </button>
        <div className="pr-6">
          <div className="text-sm font-semibold text-gray-900">{t('navigation.guestNudgeTitle')}</div>
          <div className="mt-1 text-sm text-gray-600">{t('navigation.guestNudgeText')}</div>
        </div>
        <div className="mt-3">
          <Link
            href={`/${locale}/register`}
            onClick={() => trackEvent('cta_signup_click', { source_context: 'nudge_floating' })}
            className="inline-flex items-center rounded-full px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {t('navigation.signUp')}
          </Link>
        </div>
      </div>
    </div>
  )
}

