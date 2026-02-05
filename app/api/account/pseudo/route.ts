import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, users } from '@/lib/db'
import { and, eq, sql } from 'drizzle-orm'

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const pseudo = String(body?.pseudo || '').trim()
  if (!pseudo) {
    return NextResponse.json({ error: 'Pseudo requis' }, { status: 400 })
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.pseudo, pseudo), sql`${users.id} <> ${userId}`))
    .limit(1)

  if (existing.length > 0) {
    return NextResponse.json({ error: 'Ce pseudo est déjà utilisé' }, { status: 409 })
  }

  await db.update(users).set({ pseudo, updatedAt: new Date() }).where(eq(users.id, userId))
  return NextResponse.json({ success: true })
}
