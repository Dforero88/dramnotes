'use client'

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
  }
}

export function trackEvent(action: string, params: Record<string, any> = {}) {
  if (typeof window === 'undefined') return
  if (!window.gtag) return
  window.gtag('event', action, params)
}

export function trackAdsConversion() {
  if (typeof window === 'undefined') return
  if (!window.gtag) return

  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
  const conversionLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL
  if (!adsId || !conversionLabel) return

  window.gtag('event', 'conversion', {
    send_to: `${adsId}/${conversionLabel}`,
  })
}

export function trackEventOnce(action: string, onceKey: string, params: Record<string, any> = {}) {
  if (typeof window === 'undefined') return
  try {
    const key = `ga_once:${onceKey}`
    if (window.localStorage.getItem(key)) return
    trackEvent(action, params)
    window.localStorage.setItem(key, '1')
  } catch {
    trackEvent(action, params)
  }
}
