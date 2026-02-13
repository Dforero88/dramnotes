import NotebookPage from '@/components/NotebookPage'
import type { Metadata } from 'next'
import { getTranslations, type Locale } from '@/lib/i18n'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; pseudo: string }>
}): Promise<Metadata> {
  const { locale, pseudo } = await params
  const t = getTranslations(locale)
  const baseUrl = process.env.APP_URL || 'https://dramnotes.com'
  const title = `${pseudo} — ${t('notebook.pageTitle')}`
  const url = `${baseUrl}/${locale}/user/${pseudo}`
  const description = `${pseudo} — ${t('notebook.pageTitle')}`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
    },
    alternates: { canonical: url },
  }
}

export default async function UserNotebookPage({ params }: { params: Promise<{ locale: Locale; pseudo: string }> }) {
  const { pseudo } = await params
  return <NotebookPage mode="public" pseudo={pseudo} />
}
