'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getTranslations, type Locale } from '@/lib/i18n'

const completeAccountSchema = z.object({
  pseudo: z.string()
    .min(3, 'validation.pseudoMin')
    .max(30, 'validation.pseudoMax')
    .regex(/^[a-zA-Z0-9_]+$/, 'validation.pseudoRegex')
    .regex(/^[a-zA-Z]/, 'validation.pseudoStartLetter'),
  password: z.string()
    .min(8, 'validation.passwordMin')
    .regex(/[A-Z]/, 'validation.passwordUppercase')
    .regex(/[a-z]/, 'validation.passwordLowercase')
    .regex(/[0-9]/, 'validation.passwordNumber')
    .regex(/[^A-Za-z0-9]/, 'validation.passwordSpecial'),
  visibility: z.enum(['private', 'public']),
  shelfVisibility: z.enum(['private', 'public']),
})

type CompleteAccountForm = z.infer<typeof completeAccountSchema>
type PseudoStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

export default function CompleteAccountPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pseudoStatus, setPseudoStatus] = useState<PseudoStatus>('idle')

  const routeParams = useParams<{ locale?: string }>()
  const searchParams = useSearchParams()
  const locale = (routeParams?.locale === 'en' ? 'en' : 'fr') as Locale
  const t = getTranslations(locale)
  const token = searchParams?.get('token') || ''

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CompleteAccountForm>({
    resolver: zodResolver(completeAccountSchema),
    defaultValues: {
      pseudo: '',
      password: '',
      visibility: 'private',
      shelfVisibility: 'private',
    },
    mode: 'onChange',
  })

  const password = watch('password')
  const pseudo = watch('pseudo')
  const visibility = watch('visibility')
  const shelfVisibility = watch('shelfVisibility')

  const passwordRules = useMemo(
    () => [
      { test: password?.length >= 8, key: 'validation.passwordMin' },
      { test: /[A-Z]/.test(password || ''), key: 'validation.passwordUppercase' },
      { test: /[a-z]/.test(password || ''), key: 'validation.passwordLowercase' },
      { test: /[0-9]/.test(password || ''), key: 'validation.passwordNumber' },
      { test: /[^A-Za-z0-9]/.test(password || ''), key: 'validation.passwordSpecial' },
    ],
    [password]
  )

  useEffect(() => {
    if (!pseudo || pseudo.length < 3) {
      setPseudoStatus('idle')
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(pseudo) || !/^[a-zA-Z]/.test(pseudo)) {
      setPseudoStatus('invalid')
      return
    }

    setPseudoStatus('checking')
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/auth/check-pseudo?pseudo=${encodeURIComponent(pseudo)}&token=${encodeURIComponent(token)}`,
          { signal: controller.signal }
        )
        const json = await res.json()
        if (!json?.ok) {
          setPseudoStatus('invalid')
          return
        }
        setPseudoStatus(json.available ? 'available' : 'taken')
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          setPseudoStatus('invalid')
        }
      }
    }, 350)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [pseudo, token])

  const onSubmit = async (data: CompleteAccountForm) => {
    if (!token) {
      setError(t('auth.linkExpiredOrInvalid'))
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/complete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, token }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || t('common.errorOccurred'))
      }
      setSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.errorOccurred'))
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full rounded-2xl border border-gray-200 bg-white shadow-sm p-6 sm:p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.invalidLink')}</h1>
          <p className="text-gray-600 mb-4">{t('auth.linkExpiredOrInvalid')}</p>
          <Link href={`/${locale}/register`} className="inline-flex py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary-dark-light">
            {t('auth.requestNewLink')}
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full rounded-2xl border border-gray-200 bg-white shadow-sm p-6 sm:p-8 text-center">
          <div className="text-green-600 text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.confirmationSuccess')}</h1>
          <p className="text-gray-600 mb-4">{t('auth.accountActivated')}</p>
          <Link href={`/${locale}/login`} className="inline-flex py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary-dark-light">
            {t('auth.goToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full rounded-2xl border border-gray-200 bg-white shadow-sm p-6 sm:p-8">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">{t('auth.completeAccountTitle')}</h2>
          <p className="mt-2 text-sm text-gray-600">{t('auth.completeAccountSubtitle')}</p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>}

          <div>
            <label htmlFor="pseudo" className="block text-sm font-medium text-gray-700">{t('form.pseudo')}</label>
            <input
              id="pseudo"
              type="text"
              autoComplete="username"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              placeholder={t('form.pseudoPlaceholder')}
              {...register('pseudo')}
            />
            {errors.pseudo && <p className="mt-1 text-sm text-red-600">{t(errors.pseudo.message as any)}</p>}
            {!errors.pseudo && pseudoStatus === 'checking' && (
              <p className="mt-1 text-sm text-gray-500">{t('auth.pseudoChecking')}</p>
            )}
            {!errors.pseudo && pseudoStatus === 'available' && (
              <p className="mt-1 text-sm text-green-600">{t('auth.pseudoAvailable')}</p>
            )}
            {!errors.pseudo && pseudoStatus === 'taken' && (
              <p className="mt-1 text-sm text-red-600">{t('auth.pseudoTaken')}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">{t('form.password')}</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 text-gray-900 rounded-md focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              placeholder={t('form.passwordPlaceholder')}
              {...register('password')}
            />
            {errors.password && <p className="mt-1 text-sm text-red-600">{t(errors.password.message as any)}</p>}

            {password && (
              <div className="mt-2 p-3 bg-gray-50 rounded-md">
                <p className="text-sm font-medium text-gray-700 mb-2">{t('validation.passwordRules')}:</p>
                <ul className="text-sm space-y-1">
                  {passwordRules.map((rule, index) => (
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

          <div className="rounded-md border border-gray-200 p-3 bg-white">
            <p className="text-sm font-medium text-gray-800">{t('auth.registerVisibilityTitle')}</p>
            <p className="text-xs text-gray-500 mt-1">{t('auth.registerVisibilityHelp')}</p>
            <div className="mt-3 space-y-4">
              <input type="hidden" {...register('visibility')} />
              <input type="hidden" {...register('shelfVisibility')} />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setValue('visibility', visibility === 'public' ? 'private' : 'public', { shouldDirty: true })}
                  className={`w-12 h-6 rounded-full p-1 transition-colors overflow-hidden shrink-0 inline-flex items-center ${visibility === 'public' ? 'bg-green-500' : 'bg-gray-300'}`}
                  aria-label="toggle-complete-visibility"
                >
                  <div className={`w-4 h-4 bg-white rounded-full transform transition-transform ${visibility === 'public' ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
                <div>
                  <div className="text-sm font-medium text-gray-800">{t('account.visibilityProfileLabel')}</div>
                  <div className="text-xs text-gray-500">{t('account.visibilityProfileHint')}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setValue('shelfVisibility', shelfVisibility === 'public' ? 'private' : 'public', { shouldDirty: true })}
                  className={`w-12 h-6 rounded-full p-1 transition-colors overflow-hidden shrink-0 inline-flex items-center ${shelfVisibility === 'public' ? 'bg-green-500' : 'bg-gray-300'}`}
                  aria-label="toggle-complete-shelf-visibility"
                >
                  <div className={`w-4 h-4 bg-white rounded-full transform transition-transform ${shelfVisibility === 'public' ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
                <div>
                  <div className="text-sm font-medium text-gray-800">{t('account.shelfVisibilityLabel')}</div>
                  <div className="text-xs text-gray-500">{t('account.shelfVisibilityHint')}</div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || pseudoStatus === 'taken' || pseudoStatus === 'checking'}
            className="w-full py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('auth.saving') : t('auth.completeAccountSubmit')}
          </button>
        </form>
      </div>
    </div>
  )
}
