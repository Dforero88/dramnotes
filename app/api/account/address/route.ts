import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const address = body?.address ? String(body.address).trim() : null
  const zipCode = body?.zipCode ? String(body.zipCode).trim() : null
  const town = body?.town ? String(body.town).trim() : null
  const countryId = body?.countryId ? String(body.countryId).trim() : null

  await db.update(users).set({
    address,
    zipCode,
    town,
    countryId,
    updatedAt: new Date(),
  }).where(eq(users.id, userId))

  return NextResponse.json({ success: true })
}
