// app/[locale]/(public)/catalogue/page.tsx
import { getTranslations, type Locale } from '@/lib/i18n'
import CatalogueBrowser from '@/components/CatalogueBrowser'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  const baseUrl = process.env.APP_URL || 'https://dramnotes.com'
  const title = 'Catalogue des whiskies'
  const url = `${baseUrl}/${locale}/catalogue`
  return {
    title,
    description: 'Explorez et recherchez des whiskies par nom, type, pays et notes.',
    openGraph: {
      title,
      description: 'Explorez et recherchez des whiskies par nom, type, pays et notes.',
      url,
    },
    alternates: { canonical: url },
  }
}

export default async function CataloguePage({
  params
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const t = getTranslations(locale)
  if (process.env.DRAMNOTES_BUILD === '1') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
            <h1 className="text-3xl font-semibold text-gray-900">{t('catalogue.title')}</h1>
            <p className="text-gray-600 mt-2">{t('catalogue.subtitle')}</p>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        <CatalogueBrowser locale={locale} />
      </div>
    </div>
  )
}
