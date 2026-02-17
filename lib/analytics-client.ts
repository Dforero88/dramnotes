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
