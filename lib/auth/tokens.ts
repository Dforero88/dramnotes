// lib/auth/tokens.ts
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

export function getJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET
  return secret || null
}

const TOKEN_EXPIRY = 30 * 60 // 30 minutes en secondes

export interface ConfirmationTokenPayload {
  userId: string
  email: string
  pseudo: string
  locale?: 'fr' | 'en'
}

export function generateConfirmationToken(
  userId: string,
  email: string,
  pseudo: string,
  locale: 'fr' | 'en' = 'fr'
): string {
  const secret = getJwtSecret()
  if (!secret) return ''
  return jwt.sign(
    { userId, email, pseudo, locale },
    secret,
    { expiresIn: TOKEN_EXPIRY }
  )
}

export function verifyConfirmationToken(token: string): ConfirmationTokenPayload | null {
  try {
    const secret = getJwtSecret()
    if (!secret) return null
    const decoded = jwt.verify(token, secret) as ConfirmationTokenPayload
    return decoded
  } catch (error) {
    console.error('❌ Token JWT invalide:', error)
    return null
  }
}

// Fonction utilitaire pour générer un ID (déjà dans db.ts mais au cas où)
export function generateUserId(): string {
  return crypto.randomUUID()
}
