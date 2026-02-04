import Link from 'next/link'
import { getTranslations, type Locale } from '@/lib/i18n'

export default function HomePage({
  params,
}: {
  params: { locale: Locale }
}) {
  const { locale } = params
  const t = getTranslations(locale)
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h1 className="text-5xl font-bold text-amber-900 mb-6">
          {t('home.heroTitle')}
        </h1>
        <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
          {t('home.heroSubtitle')}
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="p-6 bg-white rounded-xl shadow-lg">
            <div className="text-4xl mb-4">📸</div>
            <h3 className="text-xl font-bold mb-2">{t('home.featureScanTitle')}</h3>
            <p className="text-gray-600">{t('home.featureScanDesc')}</p>
          </div>
          
          <div className="p-6 bg-white rounded-xl shadow-lg">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-bold mb-2">{t('home.featureAnalyticsTitle')}</h3>
            <p className="text-gray-600">{t('home.featureAnalyticsDesc')}</p>
          </div>
          
          <div className="p-6 bg-white rounded-xl shadow-lg">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-xl font-bold mb-2">{t('home.featureExploreTitle')}</h3>
            <p className="text-gray-600">{t('home.featureExploreDesc')}</p>
          </div>
        </div>

        {/* CTA */}
        <div className="space-x-4">
          <Link 
            href={`/${locale}/explorer`} 
            className="inline-block px-8 py-3 bg-amber-900 text-white rounded-lg hover:bg-amber-800 text-lg"
          >
            {t('home.ctaExplore')}
          </Link>
          <Link 
            href={`/${locale}/register`} 
            className="inline-block px-8 py-3 border-2 border-amber-900 text-amber-900 rounded-lg hover:bg-amber-50 text-lg"
          >
            {t('home.ctaRegister')}
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 p-6 text-center text-gray-500 border-t">
        <p>{t('home.footer')}</p>
      </footer>
    </div>
  )
}
