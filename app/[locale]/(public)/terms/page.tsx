import { getTranslations, type Locale } from '@/lib/i18n'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  const t = getTranslations(locale)
  return {
    title: `${t('terms.title')} · DramNotes`,
  }
}

export default async function TermsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const t = getTranslations(locale)
  const updated = new Date().toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-3xl text-gray-900">{t('terms.title')}</h1>
      <p className="mt-2 text-sm text-gray-500">
        {t('terms.updated')}: {updated}
      </p>

      <p className="mt-6 text-gray-700">{t('terms.intro')}</p>

      <div className="mt-8 space-y-6">
        <section>
          <h2 className="font-display text-xl text-gray-900">{t('terms.eligibilityTitle')}</h2>
          <p className="mt-2 text-gray-700">{t('terms.eligibilityBody')}</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-gray-900">{t('terms.accountTitle')}</h2>
          <p className="mt-2 text-gray-700">{t('terms.accountBody')}</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-gray-900">{t('terms.contentTitle')}</h2>
          <p className="mt-2 text-gray-700">{t('terms.contentBody')}</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-gray-900">{t('terms.photosTitle')}</h2>
          <p className="mt-2 text-gray-700">{t('terms.photosBody')}</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-gray-900">{t('terms.licenseTitle')}</h2>
          <p className="mt-2 text-gray-700">{t('terms.licenseBody')}</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-gray-900">{t('terms.moderationTitle')}</h2>
          <p className="mt-2 text-gray-700">{t('terms.moderationBody')}</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-gray-900">{t('terms.liabilityTitle')}</h2>
          <p className="mt-2 text-gray-700">{t('terms.liabilityBody')}</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-gray-900">{t('terms.changesTitle')}</h2>
          <p className="mt-2 text-gray-700">{t('terms.changesBody')}</p>
        </section>

        <section>
          <h2 className="font-display text-xl text-gray-900">{t('terms.contactTitle')}</h2>
          <p className="mt-2 text-gray-700">{t('terms.contactBody')}</p>
        </section>
      </div>
    </div>
  )
}
