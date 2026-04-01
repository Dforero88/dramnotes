import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'
import { isAdminJobKey, listAdminJobs, previewAdminJob, runAdminJob } from '@/lib/admin-jobs'
import { captureServerException } from '@/lib/sentry-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return null
  }
  return session
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const jobs = await listAdminJobs()
    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('❌ admin jobs list error:', error)
    await captureServerException(error, {
      route: '/api/admin/jobs',
      action: 'list_jobs',
      tags: { actorUserId: session.user.id },
    })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const action = String(body?.action || '')
    const jobKey = String(body?.jobKey || '')

    if (!isAdminJobKey(jobKey)) {
      return NextResponse.json({ error: 'Invalid job key' }, { status: 400 })
    }

    if (action === 'preview') {
      const count = await previewAdminJob(jobKey)
      return NextResponse.json({ count })
    }

    if (action === 'run') {
      const result = await runAdminJob(jobKey, session.user.id)
      return NextResponse.json({ success: true, processedCount: result.processedCount })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('❌ admin jobs action error:', error)
    await captureServerException(error, {
      route: '/api/admin/jobs',
      action: 'job_action',
      tags: { actorUserId: session.user.id },
    })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
