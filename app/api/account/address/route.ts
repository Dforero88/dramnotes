import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { validateDisplayName } from '@/lib/moderation'

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const townRaw = body?.town ? String(body.town) : ''
  const countryId = body?.countryId ? String(body.countryId).trim() : null

  let town: string | null = null
  if (townRaw.trim()) {
    const check = await validateDisplayName(townRaw, 80)
    if (!check.ok) {
      return NextResponse.json({ error: check.message || 'Ville invalide' }, { status: 400 })
    }
    town = check.value
  }

  await db.update(users).set({
    town,
    countryId,
    updatedAt: new Date(),
  }).where(eq(users.id, userId))

  return NextResponse.json({ success: true })
}
