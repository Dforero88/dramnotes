import AccountPageClient from '@/components/AccountPageClient'
import type { Metadata } from 'next'
import { getTranslations, type Locale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const t = getTranslations(params.locale)
  return { title: t('account.pageTitle') }
}

export default function AccountPage() {
  return <AccountPageClient />
}
