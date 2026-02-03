// app/api/auth/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { verifyConfirmationToken } from '@/lib/auth/tokens'

export const dynamic = 'force-dynamic'

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
    
    // 1. Vérifier et décoder le token JWT
    const decoded = verifyConfirmationToken(token)
    if (!decoded) {
      return NextResponse.json(
        { error: 'Token invalide ou expiré' },
        { status: 400 }
      )
    }
    
    const { userId, email } = decoded
    
    // 2. Chercher l'utilisateur
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
    
    // 3. Vérifier que le token correspond
    if (user.confirmationToken !== token) {
      return NextResponse.json(
        { error: 'Token incorrect' },
        { status: 400 }
      )
    }
    
    // 4. Vérifier l'expiration - CORRECTION : convertir en Date
    const now = new Date()
    if (user.tokenExpiry && user.tokenExpiry < now) {
      return NextResponse.json(
        { error: 'Token expiré' },
        { status: 400 }
      )
    }
    
    // 5. Vérifier si déjà confirmé
    if (user.confirmedAt) {
      return NextResponse.redirect(`${process.env.APP_URL}/fr/already-confirmed`)
    }
    
    // 6. Confirmer le compte - CORRECTION : utiliser Date
    await db.update(users)
      .set({ 
        confirmedAt: new Date(),
        confirmationToken: null,
        tokenExpiry: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
    
    // 7. Rediriger
    const locale = 'fr'
    return NextResponse.redirect(`${process.env.APP_URL}/${locale}/confirmed`)
    
  } catch (error: any) {
    if (error?.digest === 'DYNAMIC_SERVER_USAGE') {
      return NextResponse.json({ ok: false }, { status: 200 })
    }
    console.error('❌ Erreur confirmation:', error)
    return NextResponse.json(
      { error: 'Erreur serveur interne' },
      { status: 500 }
    )
  }
}
