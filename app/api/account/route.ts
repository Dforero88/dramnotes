import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await db
    .select({
      pseudo: users.pseudo,
      visibility: users.visibility,
      address: users.address,
      zipCode: users.zipCode,
      town: users.town,
      countryId: users.countryId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!result[0]) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json(result[0])
}
