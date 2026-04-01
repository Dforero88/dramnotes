type SentryLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug'

type CaptureOptions = {
  route: string
  action?: string
  tags?: Record<string, string | number | boolean | null | undefined>
  extra?: Record<string, unknown>
  level?: SentryLevel
  flushTimeoutMs?: number
}

function normalizeTags(input?: CaptureOptions['tags']): Record<string, string> {
  const tags: Record<string, string> = {}
  for (const [key, value] of Object.entries(input || {})) {
    if (value === null || value === undefined) continue
    tags[key] = String(value)
  }
  return tags
}

export async function captureServerException(error: unknown, options: CaptureOptions) {
  if (process.env.NODE_ENV !== 'production') return

  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || ''
  if (!dsn) return

  try {
    const Sentry = await import('@sentry/nextjs')
    Sentry.withScope((scope) => {
      scope.setLevel(options.level || 'error')
      scope.setTag('monitoring', 'server')
      scope.setTag('route', options.route)
      if (options.action) scope.setTag('action', options.action)
      for (const [key, value] of Object.entries(normalizeTags(options.tags))) {
        scope.setTag(key, value)
      }
      if (options.extra) {
        for (const [key, value] of Object.entries(options.extra)) {
          scope.setExtra(key, value)
        }
      }
      Sentry.captureException(error)
    })
    await Sentry.flush(options.flushTimeoutMs ?? 1200)
  } catch (captureError) {
    console.error('[sentry-server] failed to capture exception', captureError)
  }
}

export async function captureServerMessage(message: string, options: CaptureOptions) {
  if (process.env.NODE_ENV !== 'production') return

  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || ''
  if (!dsn) return

  try {
    const Sentry = await import('@sentry/nextjs')
    const level = options.level || 'error'
    const tags = {
      monitoring: 'server',
      route: options.route,
      ...(options.action ? { action: options.action } : {}),
      ...normalizeTags(options.tags),
    }
    Sentry.captureMessage(message, {
      level,
      tags,
      extra: options.extra,
      fingerprint: [message, options.route, options.action || 'none'],
    })
    await Sentry.flush(options.flushTimeoutMs ?? 1200)
  } catch (captureError) {
    console.error('[sentry-server] failed to capture message', captureError)
  }
}
