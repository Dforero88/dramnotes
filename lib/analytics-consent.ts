export type AnalyticsConsent = 'accepted' | 'rejected'

export const ANALYTICS_CONSENT_COOKIE = 'dramnotes_analytics_consent'
export const ANALYTICS_CONSENT_MAX_AGE = 60 * 60 * 24 * 365

export function isAnalyticsConsent(value: string | undefined): value is AnalyticsConsent {
  return value === 'accepted' || value === 'rejected'
}
