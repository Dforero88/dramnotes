'use client'

import * as Sentry from '@sentry/nextjs'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  Sentry.captureException(error)

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
