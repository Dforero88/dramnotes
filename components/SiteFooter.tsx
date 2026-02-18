'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getTranslations, type Locale } from '@/lib/i18n'

export default function SiteFooter({ buildLabel }: { buildLabel: string }) {
  const params = useParams()
  const locale = ((params?.locale as string) || 'fr') as Locale
  const t = getTranslations(locale)

  return (
    <footer className="border-t" style={{ backgroundColor: 'var(--color-primary-light)' }}>
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 text-sm text-gray-600">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href={`/${locale}/about`} className="hover:underline">{t('site.footerAbout')}</Link>
          <Link href={`/${locale}/contact`} className="hover:underline">{t('site.footerContact')}</Link>
          <Link href={`/${locale}/privacy`} className="hover:underline">{t('site.footerPrivacy')}</Link>
          <Link href={`/${locale}/terms`} className="hover:underline">{t('site.footerTerms')}</Link>
        </div>
        <div className="mt-2 text-center text-xs text-gray-600">{t('site.footerAdults')}</div>
        <div className="mt-3 text-center">DramNotes © 2026 · {buildLabel}</div>
      </div>
    </footer>
  )
}
