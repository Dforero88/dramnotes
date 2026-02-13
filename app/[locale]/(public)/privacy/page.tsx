import { getTranslations, type Locale } from '@/lib/i18n'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  const t = getTranslations(locale)
  return {
    title: `${t('privacy.title')} · DramNotes`,
  }
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const t = getTranslations(locale)
  const updated = new Date().toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-3xl text-gray-900">{t('privacy.title')}</h1>
      <p className="mt-2 text-sm text-gray-500">
        {t('privacy.updated')}: {updated}
      </p>

      <p className="mt-6 text-gray-700">{t('privacy.intro')}</p>

      <div className="mt-8 space-y-6">
        <section>
          <h2 className="font-display text-xl text-gray-900">{t('privacy.dataWeCollectTitle')}</h2>
          <p className="mt-2 text-gray-700">{t('privacy.dataWeCollectBody')}</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-gray-900">{t('privacy.usageTitle')}</h2>
          <p className="mt-2 text-gray-700">{t('privacy.usageBody')}</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-gray-900">{t('privacy.analyticsTitle')}</h2>
          <p className="mt-2 text-gray-700">{t('privacy.analyticsBody')}</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-gray-900">{t('privacy.contactTitle')}</h2>
          <p className="mt-2 text-gray-700">{t('privacy.contactBody')}</p>
        </section>
      </div>
    </div>
  )
}
