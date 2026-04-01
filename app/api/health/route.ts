import { NextResponse } from 'next/server'
import { db, users } from '@/lib/db'
import { captureServerException } from '@/lib/sentry-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await db.select({ id: users.id }).from(users).limit(1)
    return NextResponse.json({ ok: true })
  } catch (error) {
    await captureServerException(error, {
      route: '/api/health',
      action: 'health_check',
      level: 'warning',
    })
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
