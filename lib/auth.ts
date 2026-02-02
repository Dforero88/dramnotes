// lib/auth.ts
import NextAuth, { type AuthOptions, type SessionStrategy } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { db, users } from './db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { loginSchema } from '@/lib/validation/schemas'

export const authOptions: AuthOptions = {
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials: any) {
        try {
          // Validation
          const validated = loginSchema.safeParse(credentials)
          if (!validated.success) {
            console.log('❌ Validation échouée:', validated.error.format())
            return null
          }
          
          const { email, password } = validated.data
          
          // Chercher l'utilisateur
          const userResult = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1)
          
          if (userResult.length === 0) {
            console.log('❌ Utilisateur non trouvé:', email)
            return null
          }
          
          const user = userResult[0]
          
          // Vérifier si le compte est confirmé
          if (!user.confirmedAt) {
            console.log('❌ Compte non confirmé:', email)
            throw new Error('Veuillez confirmer votre email avant de vous connecter')
          }
          
          // Vérifier le mot de passe
          const passwordValid = await bcrypt.compare(password, user.password)
          if (!passwordValid) {
            console.log('❌ Mot de passe invalide pour:', email)
            return null
          }
          
          // Retourner l'utilisateur (sans le mot de passe)
          return {
            id: user.id,
            email: user.email,
            name: user.pseudo,
          }
          
        } catch (error) {
          console.error('❌ Erreur authorize:', error)
          return null
        }
      }
    })
  ],
  
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Si l'URL contient un callbackUrl, l'utiliser
      if (url.includes('callbackUrl=')) {
        const callbackUrl = new URL(url, baseUrl).searchParams.get('callbackUrl')
        if (callbackUrl && callbackUrl.startsWith(baseUrl)) {
          return callbackUrl
        }
      }
      
      // Redirection par défaut vers la page catalogue en français
      return `${baseUrl}/fr/catalogue`
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
    error: '/auth/error',
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