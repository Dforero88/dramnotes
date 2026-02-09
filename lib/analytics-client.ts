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
