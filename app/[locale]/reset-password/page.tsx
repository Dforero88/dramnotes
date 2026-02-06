// app/[locale]/reset-password/page.tsx
'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, type Locale } from '@/lib/i18n'

export default function ResetPasswordPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const locale = params.locale as Locale
  const t = getTranslations(locale)
  const token = searchParams.get('token')
  
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [tokenValid, setTokenValid] = useState(false)
  const [checkingToken, setCheckingToken] = useState(true)

  // Vérifier si le token est valide au chargement
  useEffect(() => {
    if (!token) {
      setError(t('auth.invalidLink'))
      setCheckingToken(false)
      return
    }

    const checkToken = async () => {
      try {
        const response = await fetch(`/api/auth/validate-reset-token?token=${token}`)
        const result = await response.json()
        
        if (response.ok) {
          setTokenValid(true)
        } else {
          setError(result.error || t('auth.linkExpiredOrInvalid'))
        }
      } catch (err) {
        setError(t('auth.tokenCheckError'))
      } finally {
        setCheckingToken(false)
      }
    }

    checkToken()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'))
      return
    }
    
    // Validation simple du mot de passe
    if (newPassword.length < 8) {
      setError(t('auth.passwordMin'))
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      })

      const result = await response.json()
      
      if (response.ok) {
        setMessage(result.message)
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setError(result.error || t('common.error'))
      }
    } catch (err) {
      setError(t('common.errorOccurred'))
    } finally {
      setLoading(false)
    }
  }

  if (checkingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('auth.checkingLink')}</p>
        </div>
      </div>
    )
  }

  if (!tokenValid && error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg text-center">
          <div className="text-red-600 text-5xl mb-6">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('auth.invalidLink')}</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link 
            href={`/${locale}/forgot-password`}
            className="inline-block py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary-dark-light"
          >
            {t('auth.requestNewLink')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold text-center text-primary mb-4">
          {t('auth.newPasswordTitle')}
        </h1>
        
        <p className="text-gray-600 text-center mb-8">
          {t('auth.newPasswordSubtitle')}
        </p>
        
        {message && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg">
            {message}
            <div className="mt-2">
              <Link 
                href={`/${locale}/login`}
                className="underline font-medium"
              >
                {t('auth.goToLogin')}
              </Link>
            </div>
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('auth.newPassword')}
            </label>
            <input
              type="password"
              required
              minLength={8}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 caractères"
              disabled={!!message}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('auth.confirmPassword')}
            </label>
            <input
              type="password"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Retapez le mot de passe"
              disabled={!!message}
            />
          </div>
          
          <button
            type="submit"
            disabled={loading || !!message}
            className="w-full py-3 bg-primary text-white rounded-lg hover:bg-primary-dark-light disabled:opacity-50"
          >
            {loading ? t('auth.saving') : t('auth.changePassword')}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <Link 
            href={`/${locale}/login`} 
            className="text-primary hover:underline"
          >
            {t('auth.backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  )
}
