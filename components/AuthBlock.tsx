 'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getTranslations, type Locale } from '@/lib/i18n'

export default function AuthBlock({ 
  title,
  message
}: {
  title?: string
  message?: string
}) {
  const pathname = usePathname()
  const locale: Locale = pathname.startsWith('/en') ? 'en' : 'fr'
  const t = getTranslations(locale)

  const resolvedTitle = title || t('auth.restrictedTitle')
  const resolvedMessage = message || t('auth.restrictedMessage')

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg text-center">
        <div className="text-6xl mb-6">🔒</div>
        <h2 className="text-2xl font-bold text-amber-900 mb-4">{resolvedTitle}</h2>
        <p className="text-gray-600 mb-8">{resolvedMessage}</p>
        
        <div className="space-y-4">
          <Link 
            href={`/${locale}/login`} 
            className="block w-full py-3 bg-amber-900 text-white rounded-lg hover:bg-amber-800"
          >
            {t('auth.loginButton')}
          </Link>
          <Link 
            href={`/${locale}/register`} 
            className="block w-full py-3 border-2 border-amber-900 text-amber-900 rounded-lg hover:bg-amber-50"
          >
            {t('auth.signUp')}
          </Link>
        </div>
        
        <p className="mt-8 text-sm text-gray-500">
          {t('auth.communityCta')}
        </p>
      </div>
    </div>
  )
}
