import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

export async function GET() {
  const enabled = Boolean(process.env.SENTRY_DSN)
  let eventId: string | undefined
  if (enabled) {
    const error = new Error('Sentry test (api/debug/sentry)')
    eventId = Sentry.captureException(error) as string | undefined
    await Sentry.flush(2000)
  }
  return NextResponse.json({ ok: true, sentryEnabled: enabled, eventId })
}
