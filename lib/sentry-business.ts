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
  const payload = {
    ts: new Date().toISOString(),
    event: message,
    level,
    ...(tags ? { tags } : {}),
    ...(extra ? { extra } : {}),
  }
  console.info(`[business] ${JSON.stringify(payload)}`)

  const enabled = process.env.ENABLE_SENTRY_BUSINESS_LOGS === '1'
  if (!enabled) {
    return
  }

  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || ''
  if (!dsn) {
    console.warn(`[sentry-business] skipped "${message}" (dsn missing)`)
    return
  }

  try {
    const normalizedTags: Record<string, string> = {
      business_event: message,
      ...(tags || {}),
    }

    // Avoid SDK de-duplication dropping repeated business messages
    // by adding a deterministic fingerprint including business IDs when available.
    const fingerprint = [message]
    if (normalizedTags.userId) fingerprint.push(`user:${normalizedTags.userId}`)
    if (normalizedTags.whiskyId) fingerprint.push(`whisky:${normalizedTags.whiskyId}`)
    if (normalizedTags.noteId) fingerprint.push(`note:${normalizedTags.noteId}`)

    const eventId = Sentry.captureMessage(message, {
      level,
      tags: normalizedTags,
      extra,
      fingerprint,
    })
    const flushed = await Sentry.flush(flushTimeoutMs)
    if (!flushed) {
      console.warn(`[sentry-business] flush timeout for "${message}" (eventId: ${eventId || 'n/a'})`)
    } else {
      console.info(`[sentry-business] sent "${message}" (eventId: ${eventId || 'n/a'})`)
    }
  } catch (error) {
    // Keep business flow resilient if Sentry transport fails, but log for diagnostics.
    console.error(`[sentry-business] failed "${message}"`, error)
  }
}
