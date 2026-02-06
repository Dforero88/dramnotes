// app/[locale]/confirmed/page.tsx
import Link from 'next/link'
import { getTranslations, type Locale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ConfirmedPage({
  params
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const t = getTranslations(locale)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="bg-green-50 border border-green-200 rounded-lg p-8">
          <div className="text-green-600 text-6xl mb-6">✓</div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {t('auth.confirmationSuccess')}
          </h1>
          
          <p className="text-gray-600 mb-6">
            {t('auth.accountActivated')}
          </p>
          
          <div className="space-y-4">
            <Link
              href={`/${locale}/login`}
              className="inline-block w-full py-3 px-4 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark-light transition-colors"
            >
              {t('auth.goToLogin')}
            </Link>
            
            <Link
              href={`/${locale}/catalogue`}
              className="inline-block w-full py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              {t('auth.browseCatalogue')}
            </Link>
          </div>
          
          <p className="mt-8 text-sm text-gray-500">
            {t('auth.thanksForConfirming')}
          </p>
        </div>
      </div>
    </div>
  )
}
'use client'

export const dynamic = 'force-dynamic'
export const revalidate = 0
