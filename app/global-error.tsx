'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    void import('@sentry/nextjs').then((Sentry) => {
      Sentry.captureException(error)
    })
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen bg-white flex items-center justify-center px-6">
          <div className="max-w-md w-full text-center space-y-4">
            <h1 className="text-2xl font-semibold text-gray-900">Something went wrong</h1>
            <p className="text-gray-600">Please try again.</p>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center rounded-full bg-black text-white px-5 py-2 text-sm font-medium hover:bg-gray-900 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
