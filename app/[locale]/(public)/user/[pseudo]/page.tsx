import NotebookPage from '@/components/NotebookPage'
import type { Metadata } from 'next'
import { getTranslations, type Locale } from '@/lib/i18n'

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale; pseudo: string }
}): Promise<Metadata> {
  const t = getTranslations(params.locale)
  const title = `${params.pseudo} — ${t('notebook.title')}`
  return { title }
}

export default function UserNotebookPage({ params }: { params: { pseudo: string } }) {
  return <NotebookPage mode="public" pseudo={params.pseudo} />
}
