// app/[locale]/(auth)/login/page.tsx
'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getTranslations, type Locale } from '@/lib/i18n'

export default function LoginPage() {
  const params = useParams()
  const locale = params.locale as Locale
  const t = getTranslations(locale)
  
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: `/${locale}/catalogue`,
      })

      if (result?.error) {
        setError(t('auth.invalidCredentials'))
      } else {
        const redirectUrl = result?.url?.includes('callbackUrl=') 
          ? result.url 
          : `/${locale}/catalogue`
        
        router.push(redirectUrl)
        router.refresh()
      }
    } catch (err) {
      setError(t('common.errorOccurred'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold text-center text-primary mb-8">
          {t('auth.loginTitle')}
        </h1>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('form.email')}
            </label>
            <input
              type="email"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="test@test.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('form.password')}
            </label>
            <input
              type="password"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="test"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-white rounded-lg hover:bg-primary-dark-light disabled:opacity-50"
          >
            {loading ? t('auth.loginLoading') : t('auth.loginButton')}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <Link href={`/${locale}/register`} className="text-primary hover:underline">
            {t('auth.noAccountCta')}
          </Link>
        </div>
        
        <div className="mt-4 text-center">
          <Link 
            href={`/${locale}/forgot-password`} 
            className="text-sm text-primary hover:underline"
          >
            {t('auth.forgotPassword')}
          </Link>
        </div>
      </div>
    </div>
  )
}
