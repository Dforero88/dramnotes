// app/[locale]/(public)/catalogue/page.tsx
import { getTranslations, type Locale } from '@/lib/i18n'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import CatalogueBrowser from '@/components/CatalogueBrowser'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CataloguePage({
  params
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const t = getTranslations(locale)
  const session = await getServerSession(authOptions) // <-- Passe authOptions
  
  return (
    <div>
      <CatalogueBrowser locale={locale} />
      
      <div className="mt-12 pt-8 border-t">
        <div className="max-w-4xl mx-auto">
          {session?.user ? (
            <div className="bg-primary-light p-8 rounded-xl text-center">
              <h3 className="text-2xl font-bold text-primary mb-4">
                {t('catalogue.missingWhisky')}
              </h3>
              <p className="text-gray-700 mb-6">
                {t('catalogue.addWhiskyDescription')}
              </p>
              <Link
                href={`/${locale}/add-whisky`}
                className="inline-flex items-center gap-2 py-3 px-6 bg-primary text-white rounded-lg hover:bg-primary-dark-light transition-colors"
              >
                <span>+</span>
                <span>{t('catalogue.addWhiskyButton')}</span>
              </Link>
            </div>
          ) : (
            <div className="bg-gray-50 p-8 rounded-xl text-center">
              <h3 className="text-2xl font-bold text-gray-700 mb-4">
                {t('catalogue.loginToAdd')}
              </h3>
              <p className="text-gray-600 mb-2">
                {t('catalogue.loginRequired')}
              </p>
              <div className="flex gap-4 justify-center mt-4">
                <Link
                  href={`/${locale}/login`}
                  className="py-2 px-6 bg-primary text-white rounded-lg hover:bg-primary-dark-light transition-colors"
                >
                  {t('navigation.signIn')}
                </Link>
                <Link
                  href={`/${locale}/register`}
                  className="py-2 px-6 bg-white text-primary border border-primary rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t('navigation.signUp')}
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
