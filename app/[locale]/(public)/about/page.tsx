import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations, type Locale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  const t = getTranslations(locale)
  const baseUrl = process.env.APP_URL || 'https://dramnotes.com'
  const url = `${baseUrl}/${locale}/about`
  return {
    title: `${t('about.pageTitle')} · DramNotes`,
    description: t('about.hero'),
    openGraph: { title: `${t('about.pageTitle')} · DramNotes`, description: t('about.hero'), url },
    alternates: { canonical: url },
  }
}

export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const t = getTranslations(locale)
  const sections = [
    { title: t('about.historyTitle'), body: t('about.historyBody') },
    { title: t('about.labTitle'), body: t('about.labBody') },
    { title: t('about.opennessTitle'), body: t('about.opennessBody') },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-12 space-y-8">
      <div>
        <h1 className="font-display text-3xl text-gray-900">{t('about.title')}</h1>
        <p className="mt-3 text-gray-700">{t('about.hero')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {sections.map((section) => (
          <div key={section.title} className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-semibold text-gray-900">{section.title}</h2>
            <p className="mt-2 text-sm text-gray-600">{section.body}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href={`/${locale}/catalogue`} className="px-4 py-2 rounded-full text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
          {t('about.ctaCatalogue')}
        </Link>
        <Link href={`/${locale}/explorer`} className="px-4 py-2 rounded-full border" style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
          {t('about.ctaExplorer')}
        </Link>
        <Link href={`/${locale}/contact`} className="px-4 py-2 rounded-full border" style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
          {t('about.ctaContact')}
        </Link>
      </div>
    </div>
  )
}
