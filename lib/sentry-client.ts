type SentryLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug'

type CaptureClientOptions = {
  component: string
  action?: string
  tags?: Record<string, string | number | boolean | null | undefined>
  extra?: Record<string, unknown>
  level?: SentryLevel
}

function normalizeTags(input?: CaptureClientOptions['tags']): Record<string, string> {
  const tags: Record<string, string> = {}
  for (const [key, value] of Object.entries(input || {})) {
    if (value === null || value === undefined) continue
    tags[key] = String(value)
  }
  return tags
}

export async function captureClientException(error: unknown, options: CaptureClientOptions) {
  if (process.env.NODE_ENV !== 'production') return

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || ''
  if (!dsn) return

  try {
    const Sentry = await import('@sentry/nextjs')
    Sentry.withScope((scope) => {
      scope.setLevel(options.level || 'error')
      scope.setTag('monitoring', 'client')
      scope.setTag('component', options.component)
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
  } catch (captureError) {
    console.error('[sentry-client] failed to capture exception', captureError)
  }
}
