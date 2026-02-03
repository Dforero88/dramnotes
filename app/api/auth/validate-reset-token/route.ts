// app/api/auth/validate-reset-token/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from '@/lib/auth/tokens'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    
    if (!token) {
      return NextResponse.json(
        { error: 'Token manquant' },
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
    
    // Chercher l'utilisateur et vérifier le token
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
    
    return NextResponse.json({ valid: true })
    
  } catch (error) {
    console.error('❌ Erreur validate-reset-token:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
