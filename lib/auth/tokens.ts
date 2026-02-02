// lib/auth/tokens.ts
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET!
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET manquant dans les variables d\'environnement')
}

const TOKEN_EXPIRY = 30 * 60 // 30 minutes en secondes

export interface ConfirmationTokenPayload {
  userId: string
  email: string
  pseudo: string
}

export function generateConfirmationToken(userId: string, email: string, pseudo: string): string {
  return jwt.sign(
    { userId, email, pseudo },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  )
}

export function verifyConfirmationToken(token: string): ConfirmationTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as ConfirmationTokenPayload
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