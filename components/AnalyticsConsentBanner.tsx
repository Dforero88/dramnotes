'use client'

import { getTranslations, type Locale } from '@/lib/i18n'
import {
  ANALYTICS_CONSENT_COOKIE,
  ANALYTICS_CONSENT_MAX_AGE,
  type AnalyticsConsent,
} from '@/lib/analytics-consent'

type Props = {
  locale: Locale
}

function setConsent(value: AnalyticsConsent) {
  document.cookie = `${ANALYTICS_CONSENT_COOKIE}=${value}; Path=/; Max-Age=${ANALYTICS_CONSENT_MAX_AGE}; SameSite=Lax`
  window.location.reload()
}

export default function AnalyticsConsentBanner({ locale }: Props) {
  const t = getTranslations(locale)

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-6 md:right-6">
      <div className="mx-auto max-w-4xl rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="pr-0 md:pr-6">
            <div className="text-sm font-semibold text-gray-900">{t('common.analyticsConsentTitle')}</div>
            <p className="mt-1 text-sm text-gray-600">{t('common.analyticsConsentText')}</p>
          </div>
          <div className="flex flex-row flex-wrap gap-2 md:shrink-0">
            <button
              type="button"
              onClick={() => setConsent('rejected')}
              className="inline-flex items-center justify-center rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('common.analyticsConsentReject')}
            </button>
            <button
              type="button"
              onClick={() => setConsent('accepted')}
              className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {t('common.analyticsConsentAccept')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
