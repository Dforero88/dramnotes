import type { Metadata } from 'next'
import { getTranslations, type Locale } from '@/lib/i18n'
import ContactPageClient from '@/components/ContactPageClient'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  const t = getTranslations(locale)
  const baseUrl = process.env.APP_URL || 'https://dramnotes.com'
  const url = `${baseUrl}/${locale}/contact`
  return {
    title: `${t('contact.pageTitle')} · DramNotes`,
    description: t('contact.subtitle'),
    openGraph: { title: `${t('contact.pageTitle')} · DramNotes`, description: t('contact.subtitle'), url },
    alternates: { canonical: url },
  }
}

export default function ContactPage() {
  return <ContactPageClient />
}
