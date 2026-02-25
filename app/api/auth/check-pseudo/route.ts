import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db, users } from '@/lib/db'
import { validatePseudo } from '@/lib/moderation'
import { verifyConfirmationToken } from '@/lib/auth/tokens'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const pseudo = (request.nextUrl.searchParams.get('pseudo') || '').trim()
    const token = (request.nextUrl.searchParams.get('token') || '').trim()

    if (!pseudo) {
      return NextResponse.json({ ok: false, available: false, reason: 'EMPTY' }, { status: 200 })
    }

    const pseudoCheck = await validatePseudo(pseudo)
    if (!pseudoCheck.ok) {
      return NextResponse.json({ ok: false, available: false, reason: 'INVALID' }, { status: 200 })
    }

    let currentUserId: string | null = null
    if (token) {
      const decoded = verifyConfirmationToken(token)
      if (decoded?.userId) currentUserId = decoded.userId
    }

    const whereClause = currentUserId
      ? sql`lower(${users.pseudo}) = ${pseudoCheck.value.toLowerCase()} and ${users.id} <> ${currentUserId}`
      : sql`lower(${users.pseudo}) = ${pseudoCheck.value.toLowerCase()}`

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(whereClause)
      .limit(1)

    return NextResponse.json({
      ok: true,
      available: existing.length === 0,
    })
  } catch (error) {
    console.error('❌ check-pseudo error:', error)
    return NextResponse.json({ ok: false, available: false, reason: 'SERVER' }, { status: 500 })
  }
}
