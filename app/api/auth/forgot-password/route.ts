// app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import jwt from 'jsonwebtoken'
import { getResetPasswordEmailTemplate, sendEmail } from '@/lib/email/sender'
import { getJwtSecret } from '@/lib/auth/tokens'
import { buildRateLimitKey, rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(request, {
      key: buildRateLimitKey(request, null, 'auth-forgot-password'),
      windowMs: 60_000,
      max: 5,
    })
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Trop de requêtes. Réessayez dans quelques instants.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      )
    }

    const { email, locale: requestedLocale } = await request.json()
    const locale = requestedLocale === 'en' ? 'en' : 'fr'
    
    if (!email) {
      return NextResponse.json(
        { error: locale === 'en' ? 'Email required' : 'Email requis' },
        { status: 400 }
      )
    }
    
    // Chercher l'utilisateur
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    
    if (userResult.length === 0) {
      // Pour la sécurité, on ne révèle pas si l'email existe
      return NextResponse.json(
        { success: true, message: locale === 'en' ? 'If this email exists, you will receive a link' : 'Si cet email existe, vous recevrez un lien' }
      )
    }
    
    const user = userResult[0]
    
    // Générer token (30 minutes)
    const secret = getJwtSecret()
    if (!secret) {
      return NextResponse.json(
        { error: 'JWT_SECRET manquant dans les variables d\'environnement' },
        { status: 500 }
      )
    }
    const resetToken = jwt.sign(
      { userId: user.id, email: user.email },
      secret,
      { expiresIn: 30 * 60 }
    )
    
    const expiry = new Date(Date.now() + 30 * 60 * 1000)
    
    // Sauvegarder token en base
    await db.update(users)
      .set({
        resetPasswordToken: resetToken,
        resetPasswordExpiry: expiry,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
    
    // Envoyer email
    const resetUrl = `${process.env.APP_URL}/${locale}/reset-password?token=${resetToken}`

    await sendEmail({
      to: email,
      subject: locale === 'en' ? 'Reset your DramNotes password' : 'Réinitialiser votre mot de passe DramNotes',
      html: getResetPasswordEmailTemplate(user.pseudo || 'there', resetUrl, locale),
    })
    
    return NextResponse.json({
      success: true,
      message: locale === 'en' ? 'If this email exists, you will receive a link' : 'Si cet email existe, vous recevrez un lien'
    })
    
  } catch (error) {
    console.error('❌ Erreur forgot-password:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
