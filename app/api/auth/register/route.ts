// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { registerSchema } from '@/lib/validation/schemas'
import { generateConfirmationToken } from '@/lib/auth/tokens'
import { sendEmail, getConfirmationEmailTemplate } from '@/lib/email/sender'
import { generateId } from '@/lib/db'
import { validatePseudo, sanitizeText } from '@/lib/moderation'
import * as Sentry from '@sentry/nextjs'
import { buildRateLimitKey, rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(request, {
      key: buildRateLimitKey(request, null, 'auth-register'),
      windowMs: 60_000,
      max: 5,
    })
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Trop de requêtes. Réessayez dans quelques instants.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      )
    }

    const body = await request.json()
    
    // 1. Validation avec Zod
    const validationResult = registerSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.format() },
        { status: 400 }
      )
    }
    
    const { pseudo, email, password, acceptedTerms } = validationResult.data
    if (!acceptedTerms) {
      return NextResponse.json({ error: 'Veuillez accepter la politique de confidentialité.' }, { status: 400 })
    }
    const pseudoCheck = await validatePseudo(pseudo)
    if (!pseudoCheck.ok) {
      return NextResponse.json({ error: pseudoCheck.message || 'Pseudo invalide' }, { status: 400 })
    }
    const safePseudo = pseudoCheck.value
    const safeEmail = sanitizeText(email, 255)
    
    // 2. Vérifier si l'email existe déjà
    const existingEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, safeEmail))
      .limit(1)
    
    if (existingEmail.length > 0) {
      return NextResponse.json(
        { error: 'Un compte avec cet email existe déjà' },
        { status: 409 }
      )
    }
    
    // 3. Vérifier si le pseudo existe déjà
    const existingPseudo = await db
      .select()
      .from(users)
      .where(eq(users.pseudo, safePseudo))
      .limit(1)
    
    if (existingPseudo.length > 0) {
      return NextResponse.json(
        { error: 'Ce pseudo est déjà utilisé' },
        { status: 409 }
      )
    }
    
    // 4. Hasher le mot de passe
    const salt = await bcrypt.genSalt(12)
    const passwordHash = await bcrypt.hash(password, salt)
    
    // 5. Générer ID et token
    const userId = generateId()
    const confirmationToken = generateConfirmationToken(userId, safeEmail, safePseudo)
    if (!confirmationToken) {
      return NextResponse.json(
        { error: 'JWT_SECRET manquant dans les variables d\'environnement' },
        { status: 500 }
      )
    }
    
    // 6. Calculer l'expiration (30 minutes)
    const tokenExpiry = new Date(Date.now() + (30 * 60 * 1000))
    const now = new Date()
    
    // 7. Créer l'utilisateur en base - CORRECTION : utiliser Date
    await db.insert(users).values({
      id: userId,
      email: safeEmail,
      password: passwordHash,
      pseudo: safePseudo,
      confirmationToken,
      tokenExpiry,
      confirmedAt: null, // Pas encore confirmé
      createdAt: now,
      updatedAt: now,
    })

    Sentry.captureMessage('account_created', {
      level: 'info',
      tags: { userId },
    })
    
    // 8. Envoyer l'email de confirmation
    const confirmationUrl = `${process.env.APP_URL}/api/auth/confirm?token=${confirmationToken}`
    const emailSent = await sendEmail({
      to: email,
      subject: 'Confirmez votre compte DramNotes',
      html: getConfirmationEmailTemplate(pseudo, confirmationUrl),
    })
    
    if (!emailSent) {
      console.error('⚠️ Email non envoyé pour', email)
    }
    
    // 9. Réponse succès
    return NextResponse.json(
      { 
        success: true, 
        message: 'Compte créé. Vérifiez vos emails pour confirmer.',
        emailSent,
        userId
      },
      { status: 201 }
    )
    
  } catch (error) {
    console.error('❌ Erreur inscription:', error)
    return NextResponse.json(
      { error: 'Erreur serveur interne' },
      { status: 500 }
    )
  }
}
