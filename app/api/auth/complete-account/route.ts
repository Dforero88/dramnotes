import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { and, eq, sql } from 'drizzle-orm'
import { db, users } from '@/lib/db'
import { completeAccountSchema } from '@/lib/validation/schemas'
import { verifyConfirmationToken } from '@/lib/auth/tokens'
import { validatePseudo } from '@/lib/moderation'
import { buildRateLimitKey, rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(request, {
      key: buildRateLimitKey(request, null, 'auth-complete-account'),
      windowMs: 60_000,
      max: 10,
    })
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Trop de requêtes. Réessayez dans quelques instants.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      )
    }

    const body = await request.json()
    const validation = completeAccountSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error.format() }, { status: 400 })
    }

    const { token, pseudo, password, visibility, shelfVisibility } = validation.data
    const decoded = verifyConfirmationToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 400 })
    }

    const userRows = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1)
    if (!userRows.length) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }

    const user = userRows[0]
    if (user.confirmedAt) {
      return NextResponse.json({ error: 'Compte déjà confirmé' }, { status: 409 })
    }
    if (!user.confirmationToken || user.confirmationToken !== token) {
      return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 400 })
    }
    if (user.tokenExpiry && user.tokenExpiry < new Date()) {
      return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 400 })
    }

    const pseudoCheck = await validatePseudo(pseudo)
    if (!pseudoCheck.ok) {
      return NextResponse.json({ error: pseudoCheck.message || 'Pseudo invalide' }, { status: 400 })
    }

    const pseudoInUse = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          sql`lower(${users.pseudo}) = ${pseudoCheck.value.toLowerCase()}`,
          sql`${users.id} <> ${user.id}`
        )
      )
      .limit(1)
    if (pseudoInUse.length > 0) {
      return NextResponse.json({ error: 'Ce pseudo est déjà utilisé' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    await db
      .update(users)
      .set({
        pseudo: pseudoCheck.value,
        password: passwordHash,
        visibility,
        shelfVisibility,
        confirmedAt: new Date(),
        confirmationToken: null,
        tokenExpiry: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ Erreur complete-account:', error)
    return NextResponse.json({ error: 'Erreur serveur interne' }, { status: 500 })
  }
}
