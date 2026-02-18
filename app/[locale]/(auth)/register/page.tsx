// app/[locale]/(auth)/register/page.tsx
'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { trackEvent } from '@/lib/analytics-client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getTranslations, type Locale } from '@/lib/i18n'

// Schéma de validation
const registerSchema = z.object({
  pseudo: z.string()
    .min(3, 'validation.pseudoMin')
    .max(30, 'validation.pseudoMax')
    .regex(/^[a-zA-Z0-9_]+$/, 'validation.pseudoRegex')
    .regex(/^[a-zA-Z]/, 'validation.pseudoStartLetter'),
  
  email: z.string()
    .email('validation.invalidEmail')
    .max(100, 'validation.emailMax'),
  
  password: z.string()
    .min(8, 'validation.passwordMin')
    .regex(/[A-Z]/, 'validation.passwordUppercase')
    .regex(/[a-z]/, 'validation.passwordLowercase')
    .regex(/[0-9]/, 'validation.passwordNumber')
    .regex(/[^A-Za-z0-9]/, 'validation.passwordSpecial'),
  acceptedTerms: z.boolean().refine((value) => value === true, {
    message: 'validation.acceptTerms',
  }),
  acceptedAge: z.boolean().refine((value) => value === true, {
    message: 'validation.acceptAge',
  }),
  visibility: z.enum(['private', 'public']),
  shelfVisibility: z.enum(['private', 'public']),
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  const routeParams = useParams<{ locale?: string }>()
  const locale = (routeParams?.locale === 'en' ? 'en' : 'fr') as Locale
  const t = getTranslations(locale)
  
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    watch,
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      pseudo: '',
      email: '',
      password: '',
      acceptedTerms: false,
      acceptedAge: false,
      visibility: 'private',
      shelfVisibility: 'private',
    }
  })
  
  const password = watch('password')
  const visibility = watch('visibility')
  const shelfVisibility = watch('shelfVisibility')
  
  const onSubmit = async (data: RegisterForm) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, locale }),
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de l\'inscription')
      }
      
      setSuccess(true)
      if (result?.userId) {
        trackEvent('account_created', { user_id: result.userId })
        trackEvent('onboarding_started', {
          user_id: result.userId,
          source_context: 'register_success',
          locale,
          entry_point: 'register',
        })
      } else {
        trackEvent('account_created')
        trackEvent('onboarding_started', {
          source_context: 'register_success',
          locale,
          entry_point: 'register',
        })
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }
  
  const checkPasswordRules = () => {
    const rules = [
      { test: password?.length >= 8, key: 'validation.passwordMin' },
      { test: /[A-Z]/.test(password || ''), key: 'validation.passwordUppercase' },
      { test: /[a-z]/.test(password || ''), key: 'validation.passwordLowercase' },
      { test: /[0-9]/.test(password || ''), key: 'validation.passwordNumber' },
      { test: /[^A-Za-z0-9]/.test(password || ''), key: 'validation.passwordSpecial' },
    ]
    return rules
  }
  
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="text-green-600 text-5xl mb-4">✓</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {t('auth.registerSuccess')}
            </h2>
            <p className="text-gray-600 mb-4">
              {t('auth.checkEmail')}
            </p>
            <p className="text-sm text-gray-500">
              {t('auth.redirectLogin')}
            </p>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full rounded-2xl border border-gray-200 bg-white shadow-sm p-6 sm:p-8">
        <div className="mb-8">
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            {t('auth.register')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t('auth.alreadyHaveAccount')}{' '}
            <Link 
              href={`/${locale}/login`} 
              className="font-medium text-primary hover:text-primary-dark-light"
            >
              {t('auth.signInHere')}
            </Link>
          </p>
        </div>
        
        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            {/* Pseudo */}
            <div>
              <label htmlFor="pseudo" className="block text-sm font-medium text-gray-700">
                {t('form.pseudo')}
              </label>
              <input
                id="pseudo"
                type="text"
                autoComplete="username"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                placeholder={t('form.pseudoPlaceholder')}
                {...register('pseudo')}
              />
              {errors.pseudo && (
                <p className="mt-1 text-sm text-red-600">{t(errors.pseudo.message as any)}</p>
              )}
            </div>
            
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                {t('form.email')}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                placeholder={t('form.emailPlaceholder')}
                {...register('email')}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{t(errors.email.message as any)}</p>
              )}
            </div>
            
            {/* Mot de passe */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                {t('form.password')}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
                placeholder={t('form.passwordPlaceholder')}
                {...register('password')}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{t(errors.password.message as any)}</p>
              )}
              
              {/* Règles du mot de passe */}
              {password && (
                <div className="mt-2 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    {t('validation.passwordRules')}:
                  </p>
                  <ul className="text-sm space-y-1">
                    {checkPasswordRules().map((rule, index) => (
                      <li key={index} className="flex items-center">
                        <span className={`inline-block w-4 h-4 mr-2 rounded-full ${rule.test ? 'bg-green-500' : 'bg-gray-300'}`}>
                          {rule.test && '✓'}
                        </span>
                        <span className={rule.test ? 'text-green-600' : 'text-gray-500'}>
                          {t(rule.key as any)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Visibilité */}
            <div className="rounded-md border border-gray-200 p-3 bg-white">
              <p className="text-sm font-medium text-gray-800">{t('auth.registerVisibilityTitle')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('auth.registerVisibilityHelp')}</p>
              <div className="mt-3 space-y-4">
                <input type="hidden" {...register('visibility')} />
                <input type="hidden" {...register('shelfVisibility')} />
                <div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setValue('visibility', visibility === 'public' ? 'private' : 'public', { shouldDirty: true })}
                      className={`w-12 h-6 rounded-full p-1 transition-colors overflow-hidden shrink-0 inline-flex items-center ${visibility === 'public' ? 'bg-green-500' : 'bg-gray-300'}`}
                      aria-label="toggle-register-visibility"
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full transform transition-transform ${visibility === 'public' ? 'translate-x-6' : 'translate-x-0'}`}
                      />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-800">{t('account.visibilityProfileLabel')}</div>
                        <span className="text-xs text-gray-700">
                          ({visibility === 'public' ? t('account.visibilityPublic') : t('account.visibilityPrivate')})
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">{t('account.visibilityProfileHint')}</div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setValue('shelfVisibility', shelfVisibility === 'public' ? 'private' : 'public', { shouldDirty: true })}
                      className={`w-12 h-6 rounded-full p-1 transition-colors overflow-hidden shrink-0 inline-flex items-center ${shelfVisibility === 'public' ? 'bg-green-500' : 'bg-gray-300'}`}
                      aria-label="toggle-register-shelf-visibility"
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full transform transition-transform ${shelfVisibility === 'public' ? 'translate-x-6' : 'translate-x-0'}`}
                      />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-800">{t('account.shelfVisibilityLabel')}</div>
                        <span className="text-xs text-gray-700">
                          ({shelfVisibility === 'public' ? t('account.shelfVisibilityPublic') : t('account.shelfVisibilityPrivate')})
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">{t('account.shelfVisibilityHint')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('form.submitting') : t('auth.createAccount')}
            </button>
          </div>
          
          <div className="space-y-1">
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                {...register('acceptedAge')}
              />
              <span>{t('auth.ageAgreement')}</span>
            </label>
            {errors.acceptedAge && (
              <p className="text-xs text-red-600">{t(errors.acceptedAge.message as any)}</p>
            )}
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                {...register('acceptedTerms')}
              />
              <span>
                {t('auth.termsAgreement')}{' '}
                <Link
                  href={`/${locale}/terms`}
                  className="font-medium text-primary hover:text-primary-dark-light underline"
                >
                  {t('auth.termsOfUse')}
                </Link>
                {' '}{t('common.and')}{' '}
                <Link
                  href={`/${locale}/privacy`}
                  className="font-medium text-primary hover:text-primary-dark-light underline"
                >
                  {t('auth.privacyPolicy')}
                </Link>
              </span>
            </label>
            {errors.acceptedTerms && (
              <p className="text-xs text-red-600">{t(errors.acceptedTerms.message as any)}</p>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
