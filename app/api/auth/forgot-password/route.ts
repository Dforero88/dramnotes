// app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import jwt from 'jsonwebtoken'
import { sendEmail } from '@/lib/email/sender'
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

    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email requis' },
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
        { success: true, message: 'Si cet email existe, vous recevrez un lien' }
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
      const resetUrl = `${process.env.APP_URL}/fr/reset-password?token=${resetToken}`

    await sendEmail({
      to: email,
      subject: 'Réinitialiser votre mot de passe DramNotes',
      html: `
        <h2>Réinitialisation de mot de passe</h2>
        <p>Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe :</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>Ce lien expire dans 30 minutes.</p>
      `
    })
    
    return NextResponse.json({
      success: true,
      message: 'Si cet email existe, vous recevrez un lien'
    })
    
  } catch (error) {
    console.error('❌ Erreur forgot-password:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
