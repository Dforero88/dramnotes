// app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from '@/lib/auth/tokens'
import { buildRateLimitKey, rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(request, {
      key: buildRateLimitKey(request, null, 'auth-reset-password'),
      windowMs: 60_000,
      max: 5,
    })
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Trop de requêtes. Réessayez dans quelques instants.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      )
    }

    const { token, newPassword } = await request.json()
    
    if (!token || !newPassword) {
      return NextResponse.json(
        { error: 'Données manquantes' },
        { status: 400 }
      )
    }
    
    // Vérifier le token JWT
    const secret = getJwtSecret()
    if (!secret) {
      return NextResponse.json(
        { error: 'JWT_SECRET manquant dans les variables d\'environnement' },
        { status: 500 }
      )
    }
    let decoded: any
    try {
      decoded = jwt.verify(token, secret)
    } catch (jwtError) {
      return NextResponse.json(
        { error: 'Token expiré ou invalide' },
        { status: 400 }
      )
    }
    
    const { userId } = decoded
    
    // Chercher l'utilisateur
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    
    if (userResult.length === 0) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }
    
    const user = userResult[0]
    
    // Vérifier que le token correspond et n'est pas expiré
    if (user.resetPasswordToken !== token) {
      return NextResponse.json(
        { error: 'Token incorrect' },
        { status: 400 }
      )
    }
    
    const now = new Date()
    if (user.resetPasswordExpiry && user.resetPasswordExpiry < now) {
      return NextResponse.json(
        { error: 'Token expiré' },
        { status: 400 }
      )
    }
    
    // Hasher le nouveau mot de passe
    const salt = await bcrypt.genSalt(12)
    const passwordHash = await bcrypt.hash(newPassword, salt)
    
    // Mettre à jour l'utilisateur
    await db.update(users)
      .set({
        password: passwordHash,
        resetPasswordToken: null,
        resetPasswordExpiry: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
    
    return NextResponse.json({
      success: true,
      message: 'Mot de passe changé avec succès'
    })
    
  } catch (error) {
    console.error('❌ Erreur reset-password:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
