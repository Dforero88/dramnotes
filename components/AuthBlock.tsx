 'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getTranslations, type Locale } from '@/lib/i18n'
import SignupCtaLink from '@/components/SignupCtaLink'

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
      <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-sm text-center border border-gray-200">
        <h2 className="text-2xl font-semibold text-gray-800 mb-3">{resolvedTitle}</h2>
        <p className="text-gray-600 mb-6">{resolvedMessage}</p>

        <div className="flex flex-col gap-3">
          <Link
            href={`/${locale}/login`}
            className="block w-full py-3 text-white rounded-xl transition"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {t('auth.loginButton')}
          </Link>
          <SignupCtaLink
            href={`/${locale}/register`}
            sourceContext="auth_block"
            className="block w-full py-3 border rounded-xl hover:bg-gray-50 transition"
            style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
          >
            {t('auth.signUp')}
          </SignupCtaLink>
        </div>

        <p className="mt-6 text-sm text-gray-500">
          {t('auth.communityCta')}
        </p>
      </div>
    </div>
  )
}
