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
    const localeFromQuery = searchParams.get('locale') === 'en' ? 'en' : 'fr'
    
    if (!token) {
      return NextResponse.redirect(`${process.env.APP_URL}/${localeFromQuery}/register?status=invalid_link`)
    }
    
    // 1. Vérifier et décoder le token JWT
    const decoded = verifyConfirmationToken(token)
    if (!decoded) {
      return NextResponse.redirect(`${process.env.APP_URL}/${localeFromQuery}/register?status=invalid_link`)
    }
    
    const { userId } = decoded
    const locale = decoded.locale === 'en' ? 'en' : 'fr'
    
    // 2. Chercher l'utilisateur
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    
    if (userResult.length === 0) {
      return NextResponse.redirect(`${process.env.APP_URL}/${locale}/register?status=invalid_link`)
    }
    
    const user = userResult[0]
    
    // 3. Vérifier que le token correspond
    if (user.confirmationToken !== token) {
      return NextResponse.redirect(`${process.env.APP_URL}/${locale}/register?status=invalid_link`)
    }
    
    // 4. Vérifier l'expiration - CORRECTION : convertir en Date
    const now = new Date()
    if (user.tokenExpiry && user.tokenExpiry < now) {
      return NextResponse.redirect(`${process.env.APP_URL}/${locale}/register?status=expired_link`)
    }
    
    // 5. Vérifier si déjà confirmé
    if (user.confirmedAt) {
      return NextResponse.redirect(`${process.env.APP_URL}/${locale}/confirmed`)
    }

    return NextResponse.redirect(`${process.env.APP_URL}/${locale}/complete-account?token=${encodeURIComponent(token)}`)
    
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
