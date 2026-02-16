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
  try {
    Sentry.captureMessage(message, { level, tags, extra })
    await Sentry.flush(flushTimeoutMs)
  } catch {
    // Keep business flow resilient if Sentry transport fails.
  }
}

