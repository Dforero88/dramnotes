import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTranslations, type Locale } from '@/lib/i18n'
import { isAdminEmail } from '@/lib/admin'
import AuthBlock from '@/components/AuthBlock'
import AdminProducersPageClient from '@/components/AdminProducersPageClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  const t = getTranslations(locale)
  return { title: t('adminProducers.title') }
}

export default async function AdminProducersPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return <AuthBlock title={getTranslations(locale)('adminProducers.title')} />
  }

  if (!isAdminEmail(session.user.email)) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-16">
        <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <p className="text-gray-700">{getTranslations(locale)('adminProducers.forbidden')}</p>
        </div>
      </div>
    )
  }

  return <AdminProducersPageClient />
}

