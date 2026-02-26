'use client'

export const dynamic = 'force-dynamic'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { getTranslations, type Locale } from '@/lib/i18n'

const registerSchema = z.object({
  email: z.string().email('validation.invalidEmail').max(100, 'validation.emailMax'),
  acceptedTerms: z.boolean().refine((value) => value === true, {
    message: 'validation.acceptTerms',
  }),
  acceptedAge: z.boolean().refine((value) => value === true, {
    message: 'validation.acceptAge',
  }),
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const routeParams = useParams<{ locale?: string }>()
  const searchParams = useSearchParams()
  const locale = (routeParams?.locale === 'en' ? 'en' : 'fr') as Locale
  const t = getTranslations(locale)
  const status = searchParams?.get('status') || ''

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      acceptedTerms: false,
      acceptedAge: false,
    },
  })

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-start justify-center bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 md:pt-14">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="text-green-600 text-5xl mb-4">✓</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.registerSuccess')}</h2>
            <p className="text-gray-600 mb-2">{t('auth.checkEmail')}</p>
            <p className="text-gray-600 mb-4">{t('auth.registerSuccessNext')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-start justify-center bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 md:pt-14">
      <div className="max-w-md w-full rounded-2xl border border-gray-200 bg-white shadow-sm p-6 sm:p-8">
        <div className="mb-8">
          <h2 className="text-center text-3xl font-extrabold text-gray-900">{t('auth.register')}</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t('auth.alreadyHaveAccount')}{' '}
            <Link href={`/${locale}/login`} className="font-medium text-primary hover:text-primary-dark-light">
              {t('auth.signInHere')}
            </Link>
          </p>
        </div>

        {status === 'expired_link' && (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded">
            {t('auth.linkExpiredOrInvalid')}
          </div>
        )}
        {status === 'invalid_link' && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {t('auth.invalidLink')}
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}

          <div className="space-y-4">
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
              {errors.email && <p className="mt-1 text-sm text-red-600">{t(errors.email.message as any)}</p>}
            </div>
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
            {errors.acceptedAge && <p className="text-xs text-red-600">{t(errors.acceptedAge.message as any)}</p>}
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                {...register('acceptedTerms')}
              />
              <span>
                {t('auth.termsAgreement')}{' '}
                <Link href={`/${locale}/terms`} className="font-medium text-primary hover:text-primary-dark-light underline">
                  {t('auth.termsOfUse')}
                </Link>{' '}
                {t('common.and')}{' '}
                <Link href={`/${locale}/privacy`} className="font-medium text-primary hover:text-primary-dark-light underline">
                  {t('auth.privacyPolicy')}
                </Link>
              </span>
            </label>
            {errors.acceptedTerms && <p className="text-xs text-red-600">{t(errors.acceptedTerms.message as any)}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-full text-white bg-primary hover:bg-primary-dark-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('form.submitting') : t('auth.createAccount')}
          </button>
        </form>
      </div>
    </div>
  )
}
