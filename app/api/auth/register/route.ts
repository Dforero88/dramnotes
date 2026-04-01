// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { registerSchema } from '@/lib/validation/schemas'
import { generateConfirmationToken } from '@/lib/auth/tokens'
import { sendEmail, getConfirmationEmailTemplate, getExistingAccountEmailTemplate } from '@/lib/email/sender'
import { generateId } from '@/lib/db'
import { sanitizeText } from '@/lib/moderation'
import { captureBusinessEvent } from '@/lib/sentry-business'
import { buildRateLimitKey, rateLimit } from '@/lib/rate-limit'
import { captureServerException, captureServerMessage } from '@/lib/sentry-server'

export const runtime = 'nodejs'

function getGenericRegisterResponse(locale: 'fr' | 'en') {
  return {
    success: true,
    message:
      locale === 'en'
        ? 'You will receive an email with the next steps.'
        : 'Vous allez recevoir un email avec la suite des étapes.',
  }
}

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
    
    const { email, acceptedTerms, acceptedAge } = validationResult.data
    const locale = body?.locale === 'en' ? 'en' : 'fr'
    const source = body?.source === 'guest_nudge' ? 'guest_nudge' : 'register_page'
    if (!acceptedTerms) {
      return NextResponse.json({ error: 'Veuillez accepter la politique de confidentialité.' }, { status: 400 })
    }
    if (!acceptedAge) {
      return NextResponse.json({ error: 'Vous devez confirmer avoir 18 ans ou plus.' }, { status: 400 })
    }
    const safeEmail = sanitizeText(email, 255).toLowerCase()
    if (!safeEmail) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }
    
    // 2. Vérifier si l'email existe déjà
    const existingEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, safeEmail))
      .limit(1)
    
    if (existingEmail.length > 0) {
      const existingUser = existingEmail[0]
      if (existingUser.confirmedAt) {
        const loginUrl = `${process.env.APP_URL}/${locale}/login`
        const resetUrl = `${process.env.APP_URL}/${locale}/forgot-password`
        await sendEmail({
          to: safeEmail,
          subject: locale === 'en' ? 'Your DramNotes account already exists' : 'Votre compte DramNotes existe déjà',
          html: getExistingAccountEmailTemplate(loginUrl, resetUrl, locale),
        })
        return NextResponse.json(getGenericRegisterResponse(locale), { status: 200 })
      }

      const confirmationToken = generateConfirmationToken(
        existingUser.id,
        safeEmail,
        existingUser.pseudo || `pending_${existingUser.id.replace(/-/g, '').slice(0, 12)}`,
        locale
      )
      if (!confirmationToken) {
        return NextResponse.json(
          { error: 'JWT_SECRET manquant dans les variables d\'environnement' },
          { status: 500 }
        )
      }

      const tokenExpiry = new Date(Date.now() + (30 * 60 * 1000))
      await db
        .update(users)
        .set({
          preferredLocale: locale,
          confirmationToken,
          tokenExpiry,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))

      const confirmationUrl = `${process.env.APP_URL}/api/auth/confirm?token=${confirmationToken}&locale=${locale}`
      await sendEmail({
        to: safeEmail,
        subject: locale === 'en' ? 'Confirm your DramNotes account' : 'Confirmez votre compte DramNotes',
        html: getConfirmationEmailTemplate(locale === 'en' ? 'there' : 'ami', confirmationUrl, locale),
      })

      return NextResponse.json(getGenericRegisterResponse(locale), { status: 200 })
    }

    // 3. Générer ID et token
    const userId = generateId()
    const pendingPseudo = `pending_${userId.replace(/-/g, '').slice(0, 12)}`
    const pendingPassword = await bcrypt.hash(generateId(), 12)
    const confirmationToken = generateConfirmationToken(userId, safeEmail, pendingPseudo, locale)
    if (!confirmationToken) {
      return NextResponse.json(
        { error: 'JWT_SECRET manquant dans les variables d\'environnement' },
        { status: 500 }
      )
    }
    
    // 4. Calculer l'expiration (30 minutes)
    const tokenExpiry = new Date(Date.now() + (30 * 60 * 1000))
    const now = new Date()
    
    // 5. Créer l'utilisateur en base (profil finalisé plus tard)
    await db.insert(users).values({
      id: userId,
      email: safeEmail,
      password: pendingPassword,
      pseudo: pendingPseudo,
      visibility: 'private',
      shelfVisibility: 'private',
      preferredLocale: locale,
      confirmationToken,
      tokenExpiry,
      confirmedAt: null,
      createdAt: now,
      updatedAt: now,
    })

    await captureBusinessEvent('account_created', {
      level: 'info',
      tags: { userId },
      extra: {
        locale,
        source,
      },
    })
    
    // 6. Envoyer l'email de confirmation
    const confirmationUrl = `${process.env.APP_URL}/api/auth/confirm?token=${confirmationToken}&locale=${locale}`
    const emailSent = await sendEmail({
      to: safeEmail,
      subject: locale === 'en' ? 'Confirm your DramNotes account' : 'Confirmez votre compte DramNotes',
      html: getConfirmationEmailTemplate(locale === 'en' ? 'there' : 'ami', confirmationUrl, locale),
    })
    
    if (!emailSent) {
      console.error('⚠️ Email non envoyé pour', email)
      await captureServerMessage('register_confirmation_email_not_sent', {
        route: '/api/auth/register',
        action: 'send_confirmation_email',
        level: 'warning',
        tags: { userId, locale, source },
      })
    }
    
    // 7. Réponse succès
    return NextResponse.json(getGenericRegisterResponse(locale), { status: 201 })
    
  } catch (error) {
    console.error('❌ Erreur inscription:', error)
    await captureServerException(error, {
      route: '/api/auth/register',
      action: 'register',
    })
    return NextResponse.json(
      { error: 'Erreur serveur interne' },
      { status: 500 }
    )
  }
}
