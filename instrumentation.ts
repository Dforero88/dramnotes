export async function register() {
  // Keep local/dev as light as possible and avoid OpenTelemetry warning noise.
  if (process.env.NODE_ENV !== 'production') return

  const dsn = process.env.SENTRY_DSN || ''
  if (!dsn) return

  const Sentry = await import('@sentry/nextjs')
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    enabled: true,
  })
}
