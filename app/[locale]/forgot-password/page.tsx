// app/[locale]/forgot-password/page.tsx
'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, type Locale } from '@/lib/i18n'
import SignupCtaLink from '@/components/SignupCtaLink'

export default function ForgotPasswordPage() {
  const params = useParams()
  const locale = params.locale as Locale
  const t = getTranslations(locale)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale }),
      })

      const result = await response.json()
      
      if (response.ok) {
        setMessage(result.message)
        setEmail('')
      } else {
        setError(result.error || t('common.error'))
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
        <h1 className="text-3xl font-bold text-center text-primary mb-4">
          {t('auth.forgotPasswordTitle')}
        </h1>
        
        <p className="text-gray-600 text-center mb-8">
          {t('auth.forgotPasswordSubtitle')}
        </p>
        
        {message && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-full">
            {message}
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-full">
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
              className="w-full px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-primary focus:border-transparent"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-white rounded-full hover:bg-primary-dark-light disabled:opacity-50"
          >
            {loading ? t('auth.forgotPasswordSending') : t('auth.forgotPasswordButton')}
          </button>
        </form>
        
        <div className="mt-6 text-center space-y-2">
          <Link 
            href={`/${locale}/login`} 
            className="block text-primary hover:underline"
          >
            {t('auth.backToLogin')}
          </Link>
          
          <SignupCtaLink
            href={`/${locale}/register`} 
            sourceContext="forgot_password_page"
            className="block text-primary hover:underline"
          >
            {t('auth.noAccountCta')}
          </SignupCtaLink>
        </div>
      </div>
    </div>
  )
}
