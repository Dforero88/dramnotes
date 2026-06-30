import { NextResponse } from 'next/server'
import { db, users } from '@/lib/db'
import { captureServerException } from '@/lib/sentry-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isTransientDbError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  return (
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('PROTOCOL_CONNECTION_LOST')
  )
}

async function runHealthQuery() {
  await db.select({ id: users.id }).from(users).limit(1)
}

export async function GET() {
  try {
    try {
      await runHealthQuery()
    } catch (error) {
      if (!isTransientDbError(error)) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, 200))
      await runHealthQuery()
    }
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
