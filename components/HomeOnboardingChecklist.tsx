'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getTranslations, type Locale } from '@/lib/i18n'
import { trackEvent } from '@/lib/analytics-client'
import { CheckCircle, HourglassLow, LockSimple } from '@phosphor-icons/react'

type Step = {
  id: 'account' | 'add_whisky' | 'publish_note' | 'add_shelf'
  title: string
  description: string
  href: string
  done: boolean
}

const COMPLETED_VISIBILITY_MS = 3 * 24 * 60 * 60 * 1000

function storageKey(userId: string) {
  return `home_onboarding_v1:${userId}`
}

type PersistedState = {
  completedAt?: number
  dismissedAt?: number
}

export default function HomeOnboardingChecklist({
  locale,
  userId,
  isLoggedIn,
  hasAddedWhisky,
  hasPublishedNote,
  hasShelfItem,
}: {
  locale: Locale
  userId?: string | null
  isLoggedIn: boolean
  hasAddedWhisky: boolean
  hasPublishedNote: boolean
  hasShelfItem: boolean
}) {
  const t = getTranslations(locale)
  const [hidden, setHidden] = useState(false)

  const steps: Step[] = useMemo(
    () => [
      {
        id: 'account',
        title: t('home.onboardingStepAccountTitle'),
        description: t('home.onboardingStepAccountDesc'),
        href: isLoggedIn ? `/${locale}/account` : `/${locale}/register`,
        done: isLoggedIn,
      },
      {
        id: 'add_whisky',
        title: t('home.onboardingStepAddWhiskyTitle'),
        description: t('home.onboardingStepAddWhiskyDesc'),
        href: isLoggedIn ? `/${locale}/add-whisky` : `/${locale}/register`,
        done: isLoggedIn ? hasAddedWhisky : false,
      },
      {
        id: 'publish_note',
        title: t('home.onboardingStepPublishNoteTitle'),
        description: t('home.onboardingStepPublishNoteDesc'),
        href: isLoggedIn ? `/${locale}/catalogue` : `/${locale}/register`,
        done: isLoggedIn ? hasPublishedNote : false,
      },
      {
        id: 'add_shelf',
        title: t('home.onboardingStepShelfTitle'),
        description: t('home.onboardingStepShelfDesc'),
        href: isLoggedIn ? `/${locale}/catalogue` : `/${locale}/register`,
        done: isLoggedIn ? hasShelfItem : false,
      },
    ],
    [locale, t, isLoggedIn, hasAddedWhisky, hasPublishedNote, hasShelfItem]
  )

  const completedCount = steps.filter((s) => s.done).length
  const isComplete = completedCount === steps.length
  const progressPercent = Math.round((completedCount / steps.length) * 100)

  const getStepState = (step: Step): 'done' | 'pending' | 'locked' => {
    if (step.done) return 'done'
    if (!isLoggedIn && step.id !== 'account') return 'locked'
    return 'pending'
  }

  useEffect(() => {
    if (!isComplete || !isLoggedIn || !userId) return
    try {
      const key = storageKey(userId)
      const raw = localStorage.getItem(key)
      const state: PersistedState = raw ? JSON.parse(raw) : {}
      const now = Date.now()

      if (state.dismissedAt) {
        setHidden(true)
        return
      }
      if (state.completedAt && now - state.completedAt > COMPLETED_VISIBILITY_MS) {
        setHidden(true)
        return
      }
      if (!state.completedAt) {
        localStorage.setItem(key, JSON.stringify({ ...state, completedAt: now }))
        trackEvent('onboarding_completed', { source: 'home_checklist' })
      }
    } catch {
      // ignore localStorage issues
    }
  }, [isComplete, isLoggedIn, userId])

  if (hidden) return null

  if (isComplete) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t('home.onboardingDoneTitle')}</h2>
            <p className="mt-1 text-sm text-gray-600">{t('home.onboardingDoneText')}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-gray-400 hover:text-gray-600"
            onClick={() => {
              setHidden(true)
              if (!userId) return
              try {
                const key = storageKey(userId)
                const raw = localStorage.getItem(key)
                const state: PersistedState = raw ? JSON.parse(raw) : {}
                localStorage.setItem(key, JSON.stringify({ ...state, dismissedAt: Date.now() }))
              } catch {
                // ignore
              }
              trackEvent('onboarding_done_dismiss', { source: 'home_checklist' })
            }}
          >
            ×
          </button>
        </div>
        <div className="mt-4">
          <Link
            href={`/${locale}/catalogue`}
            className="inline-flex items-center rounded-full px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
            onClick={() => trackEvent('onboarding_done_cta_click', { source: 'home_checklist' })}
          >
            {t('home.onboardingDoneCta')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">{t('home.onboardingTitle')}</h2>
      </div>
      <p className="mt-1 text-sm text-gray-600">{t('home.onboardingSubtitle')}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('home.onboardingProgressLabel')}</div>
        <div className="text-sm font-semibold text-gray-700">{progressPercent}%</div>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${progressPercent}%`, backgroundColor: 'var(--color-primary)' }}
        />
      </div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {steps.map((step) => {
          const state = getStepState(step)
          return (
            <Link
              key={step.id}
              href={step.href}
              onClick={() => trackEvent('onboarding_step_click', { step_id: step.id, source: 'home_checklist' })}
              className={`rounded-xl border p-3 transition ${
                state === 'done'
                  ? 'border-transparent bg-[var(--color-primary-light)]'
                  : state === 'locked'
                    ? 'border-gray-200 bg-gray-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
              } ${state === 'pending' ? 'onboarding-card-pulse' : ''}`}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center">
                  {state === 'done' ? (
                    <CheckCircle size={20} weight="duotone" style={{ color: 'var(--color-primary)' }} />
                  ) : state === 'locked' ? (
                    <LockSimple size={20} weight="duotone" className="text-gray-500" />
                  ) : (
                    <HourglassLow size={20} weight="duotone" className="text-gray-600" />
                  )}
                </span>
                <div className="min-w-0">
                  <div className={`text-sm font-semibold ${state === 'done' ? 'text-[var(--color-primary)]' : 'text-gray-900'}`}>
                    {step.title}
                  </div>
                  <div className={`text-xs mt-1 ${state === 'locked' ? 'text-gray-500' : 'text-gray-600'}`}>{step.description}</div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
      <style jsx global>{`
        .onboarding-card-pulse {
          animation: onboardingCardPulse 7s ease-in-out infinite;
        }
        @keyframes onboardingCardPulse {
          0%, 78%, 100% {
            transform: translateY(0) scale(1);
            box-shadow: 0 0 0 rgba(0, 0, 0, 0);
            border-color: #e5e7eb;
          }
          84% {
            transform: translateY(-1px) scale(1.01);
            box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08);
            border-color: rgba(0, 0, 0, 0.22);
          }
          90% {
            transform: translateY(0) scale(1);
            box-shadow: 0 0 0 rgba(0, 0, 0, 0);
            border-color: #e5e7eb;
          }
        }
      `}</style>
    </div>
  )
}
