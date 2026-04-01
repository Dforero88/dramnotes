// lib/auth.ts
import NextAuth, { type AuthOptions, type SessionStrategy } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { db, users } from './db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { loginSchema } from '@/lib/validation/schemas'
import { captureBusinessEvent } from '@/lib/sentry-business'
import { captureServerException } from '@/lib/sentry-server'

export const authOptions: AuthOptions = {
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials: any) {
        try {
          const validated = loginSchema.safeParse(credentials)
          if (!validated.success) {
            console.log('❌ Validation échouée:', validated.error.format())
            return null
          }

          const { email, password } = validated.data
          const normalizedEmail = String(email || '').trim().toLowerCase()

          const userResult = await db
            .select()
            .from(users)
            .where(eq(users.email, normalizedEmail))
            .limit(1)

          if (userResult.length === 0) {
            console.log('❌ Utilisateur non trouvé:', normalizedEmail)
            return null
          }

          const user = userResult[0]

          if (!user.confirmedAt) {
            console.log('❌ Compte non confirmé:', normalizedEmail)
            throw new Error('EMAIL_NOT_CONFIRMED')
          }

          if (!user.password || !user.pseudo) {
            console.log('❌ Compte incomplet:', normalizedEmail)
            throw new Error('EMAIL_NOT_CONFIRMED')
          }

          const passwordValid = await bcrypt.compare(password, user.password)
          if (!passwordValid) {
            console.log('❌ Mot de passe invalide pour:', normalizedEmail)
            return null
          }

          await captureBusinessEvent('user_login', {
            level: 'info',
            tags: { userId: user.id },
            extra: { locale: user.preferredLocale === 'en' ? 'en' : 'fr', method: 'credentials' },
          })

          return {
            id: user.id,
            email: user.email,
            name: user.pseudo,
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : ''
          if (message === 'EMAIL_NOT_CONFIRMED') {
            throw error
          }

          await captureServerException(error, {
            route: 'nextauth.credentials.authorize',
            action: 'login_authorize',
          })
          throw error
        }
      }
    })
  ],
  
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`
      }

      if (url.startsWith(baseUrl)) {
        return url
      }

      return `${baseUrl}/catalogue`
    },
    
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    }
  },
  
  pages: {
    signIn: '/login',
  },
  
  session: {
    strategy: 'jwt' as SessionStrategy,
    maxAge: 30 * 24 * 60 * 60, // 30 jours
  },
  
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
}

// Export pour les Server Components
const handler = NextAuth(authOptions)
export const handlers = handler.handlers
export const auth = handler.auth
export const signIn = handler.signIn
export const signOut = handler.signOut
