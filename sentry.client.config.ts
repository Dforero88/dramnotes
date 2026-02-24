if (process.env.NODE_ENV === 'production') {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || ''
  if (dsn) {
    void import('@sentry/nextjs').then((Sentry) => {
      Sentry.init({
        dsn,
        tracesSampleRate: 0.1,
        enabled: true,
      })
    })
  }
}
