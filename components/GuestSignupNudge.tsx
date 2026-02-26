'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useSession } from 'next-auth/react'
import { getTranslations, type Locale } from '@/lib/i18n'
import { trackEvent } from '@/lib/analytics-client'

type NudgeContext = 'home' | 'catalogue' | 'whisky' | 'notebook' | 'explorer'
type TriggerType = 'actions' | 'time_on_page'

const IS_DEV = process.env.NODE_ENV !== 'production'
const ACTION_THRESHOLD = IS_DEV ? 1 : 3
const TIME_THRESHOLD_MS = IS_DEV ? 3000 : 12000
const AUTO_CLOSE_MS = 20000
const COOLDOWN_MS = IS_DEV ? 0 : 24 * 60 * 60 * 1000

const ACTION_KEY = 'guest_actions_count'
const DISMISSED_KEY = 'guest_nudge_dismissed_at'
const LAST_SHOWN_KEY = 'guest_nudge_last_shown_at'

function getNudgeContext(pathname: string | null): NudgeContext {
  if (!pathname) return 'home'
  if (pathname.includes('/whisky/')) return 'whisky'
  if (pathname.includes('/catalogue')) return 'catalogue'
  if (pathname.includes('/notebook')) return 'notebook'
  if (pathname.includes('/explorer')) return 'explorer'
  return 'home'
}

function readStorageNumber(key: string) {
  if (typeof window === 'undefined') return 0
  const value = Number(localStorage.getItem(key) || sessionStorage.getItem(key) || '0')
  return Number.isFinite(value) ? value : 0
}

export default function GuestSignupNudge() {
  const pathname = usePathname()
  const { status } = useSession()
  const [open, setOpen] = useState(false)
  const [triggerType, setTriggerType] = useState<TriggerType>('actions')
  const [email, setEmail] = useState('')
  const [acceptedAge, setAcceptedAge] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const lastActionAtRef = useRef(0)
  const pageEnteredAtRef = useRef(Date.now())

  const locale: Locale = useMemo(() => {
    if (pathname?.startsWith('/en')) return 'en'
    return 'fr'
  }, [pathname])
  const t = getTranslations(locale)
  const context = useMemo(() => getNudgeContext(pathname), [pathname])

  const copy = useMemo(() => {
    if (context === 'catalogue') {
      return {
        title: t('navigation.guestNudgeCatalogueTitle'),
        points: [t('navigation.guestNudgeCataloguePoint1'), t('navigation.guestNudgeCataloguePoint2')],
      }
    }
    if (context === 'whisky') {
      return {
        title: t('navigation.guestNudgeWhiskyTitle'),
        points: [t('navigation.guestNudgeWhiskyPoint1'), t('navigation.guestNudgeWhiskyPoint2')],
      }
    }
    if (context === 'notebook') {
      return {
        title: t('navigation.guestNudgeNotebookTitle'),
        points: [t('navigation.guestNudgeNotebookPoint1'), t('navigation.guestNudgeNotebookPoint2')],
      }
    }
    if (context === 'explorer') {
      return {
        title: t('navigation.guestNudgeExplorerTitle'),
        points: [t('navigation.guestNudgeExplorerPoint1'), t('navigation.guestNudgeExplorerPoint2')],
      }
    }
    return {
      title: t('navigation.guestNudgeHomeTitle'),
      points: [t('navigation.guestNudgeHomePoint1'), t('navigation.guestNudgeHomePoint2')],
    }
  }, [context, t])

  useEffect(() => {
    pageEnteredAtRef.current = Date.now()
  }, [pathname])

  const tryOpenNudge = (reason: TriggerType) => {
    if (status !== 'unauthenticated') return
    if (typeof window === 'undefined') return
    if (open) return

    const now = Date.now()
    const lastShownAt = readStorageNumber(LAST_SHOWN_KEY)
    const dismissedAt = readStorageNumber(DISMISSED_KEY)
    const inCooldown =
      COOLDOWN_MS > 0 &&
      (now - lastShownAt < COOLDOWN_MS || now - dismissedAt < COOLDOWN_MS)

    if (inCooldown) return

    setTriggerType(reason)
    setOpen(true)
    localStorage.setItem(LAST_SHOWN_KEY, String(now))
    trackEvent('guest_nudge_shown', {
      source_context: context,
      trigger_type: reason,
      actions_count: Number(sessionStorage.getItem(ACTION_KEY) || '0'),
      seconds_on_page: Math.floor((now - pageEnteredAtRef.current) / 1000),
    })
  }

  useEffect(() => {
    if (status !== 'unauthenticated') return
    if (typeof window === 'undefined') return

    const count = Number(sessionStorage.getItem(ACTION_KEY) || '0')
    if (count >= ACTION_THRESHOLD) {
      tryOpenNudge('actions')
    }
  }, [status, pathname]) // re-evaluate per page

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

      if (next >= ACTION_THRESHOLD) {
        tryOpenNudge('actions')
      }
    }

    document.addEventListener('click', trackInteraction, true)
    return () => document.removeEventListener('click', trackInteraction, true)
  }, [status, context, open])

  useEffect(() => {
    if (status !== 'unauthenticated') return
    if (open) return
    const timer = setTimeout(() => {
      tryOpenNudge('time_on_page')
    }, TIME_THRESHOLD_MS)
    return () => clearTimeout(timer)
  }, [status, context, open])

  useEffect(() => {
    if (!open) return
    const timeout = setTimeout(() => {
      setOpen(false)
      trackEvent('guest_nudge_close', { source_context: context, reason: 'timeout', trigger_type: triggerType })
    }, AUTO_CLOSE_MS)
    return () => clearTimeout(timeout)
  }, [open, context, triggerType])

  if (status !== 'unauthenticated' || !open) return null

  const canSubmit =
    email.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    acceptedAge &&
    acceptedTerms &&
    !submitting

  const submitInlineRegister = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          acceptedAge,
          acceptedTerms,
          locale,
        }),
      })
      const json = await response.json()
      if (!response.ok) {
        setSubmitError(json?.error || t('common.errorOccurred'))
        return
      }

      setSubmitSuccess(true)
      trackEvent('cta_signup_click', { source_context: 'nudge_floating_inline_form' })
      trackEvent('guest_nudge_signup_click', { source_context: context, trigger_type: triggerType })
    } catch (_error) {
      setSubmitError(t('common.errorOccurred'))
    } finally {
      setSubmitting(false)
    }
  }

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
            if (typeof window !== 'undefined') localStorage.setItem(DISMISSED_KEY, String(Date.now()))
            setOpen(false)
            trackEvent('guest_nudge_close', { source_context: context, reason: 'manual', trigger_type: triggerType })
          }}
          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          ×
        </button>
        <div className="pr-6">
          <div className="text-sm font-semibold text-gray-900">{copy.title}</div>
          <div className="mt-2 space-y-1.5">
            {copy.points.map((point) => (
              <div key={point} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="mt-0.5 text-green-600">✓</span>
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
        {submitSuccess ? (
          <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {t('auth.checkEmail')}
          </div>
        ) : (
          <form className="mt-3 space-y-2" onSubmit={submitInlineRegister}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('form.emailPlaceholder')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={acceptedAge}
                onChange={(e) => setAcceptedAge(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span>{t('auth.ageAgreement')}</span>
            </label>
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span>
                {t('auth.termsAgreement')}{' '}
                <Link href={`/${locale}/terms`} className="underline hover:text-gray-900">
                  {t('auth.termsOfUse')}
                </Link>{' '}
                {t('common.and')}{' '}
                <Link href={`/${locale}/privacy`} className="underline hover:text-gray-900">
                  {t('auth.privacyPolicy')}
                </Link>
              </span>
            </label>
            {submitError ? <p className="text-xs text-red-600">{submitError}</p> : null}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center rounded-full px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {submitting ? t('form.submitting') : t('auth.createAccount')}
              </button>
              <Link
                href={`/${locale}/login`}
                onClick={() => trackEvent('guest_nudge_login_click', { source_context: context, trigger_type: triggerType })}
                className="text-sm text-gray-600 hover:text-gray-900 underline"
              >
                {t('auth.alreadyHaveAccount')} {t('navigation.signIn')}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
