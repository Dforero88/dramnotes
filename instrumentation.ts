import * as Sentry from '@sentry/nextjs'

export function register() {
  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN || '',
      tracesSampleRate: 0.1,
      enabled: Boolean(process.env.SENTRY_DSN),
    })
    return
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN || '',
    tracesSampleRate: 0.1,
    enabled: Boolean(process.env.SENTRY_DSN),
  })
}
