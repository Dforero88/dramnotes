import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

export async function GET() {
  const error = new Error('Sentry test (api/debug/sentry)')
  Sentry.captureException(error)
  await Sentry.flush(2000)
  return NextResponse.json({ ok: true })
}
