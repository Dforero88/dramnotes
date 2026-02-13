import { NextRequest, NextResponse } from 'next/server'
import { resolveBottlerName, resolveDistillerName } from '@/lib/producer-resolver'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const kind = String(body?.kind || '').trim()
    const value = String(body?.value || '').trim()

    if (!kind || !value) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }
    if (kind !== 'distiller' && kind !== 'bottler') {
      return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
    }

    const resolution =
      kind === 'distiller'
        ? await resolveDistillerName(value)
        : await resolveBottlerName(value)

    return NextResponse.json({ success: true, resolution })
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

