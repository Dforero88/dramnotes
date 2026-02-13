import ExplorerPageClient from '@/components/ExplorerPageClient'
import type { Metadata } from 'next'
import { getTranslations, type Locale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  const t = getTranslations(locale)
  return { title: t('explorer.pageTitle') }
}

export default function ExplorerPage() {
  return <ExplorerPageClient />
}
