import NotebookPage from '@/components/NotebookPage'
import type { Metadata } from 'next'
import { getTranslations, type Locale } from '@/lib/i18n'

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale; pseudo: string }
}): Promise<Metadata> {
  const t = getTranslations(params.locale)
  const baseUrl = process.env.APP_URL || 'https://dramnotes.com'
  const title = `${params.pseudo} — ${t('notebook.pageTitle')}`
  const url = `${baseUrl}/${params.locale}/user/${params.pseudo}`
  const description = `${params.pseudo} — ${t('notebook.pageTitle')}`
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

export default function UserNotebookPage({ params }: { params: { pseudo: string } }) {
  return <NotebookPage mode="public" pseudo={params.pseudo} />
}
