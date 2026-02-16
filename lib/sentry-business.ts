import * as Sentry from '@sentry/nextjs'

type BusinessLevel = 'debug' | 'info' | 'warning' | 'error' | 'fatal' | 'log'

type BusinessEventOptions = {
  level?: BusinessLevel
  tags?: Record<string, string>
  extra?: Record<string, unknown>
  flushTimeoutMs?: number
}

export async function captureBusinessEvent(
  message: string,
  { level = 'info', tags, extra, flushTimeoutMs = 1200 }: BusinessEventOptions = {}
) {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || ''
  if (!dsn) {
    console.warn(`[sentry-business] skipped "${message}" (dsn missing)`)
    return
  }

  try {
    const eventId = Sentry.captureMessage(message, { level, tags, extra })
    const flushed = await Sentry.flush(flushTimeoutMs)
    if (!flushed) {
      console.warn(`[sentry-business] flush timeout for "${message}" (eventId: ${eventId || 'n/a'})`)
    }
  } catch (error) {
    // Keep business flow resilient if Sentry transport fails, but log for diagnostics.
    console.error(`[sentry-business] failed "${message}"`, error)
  }
}
