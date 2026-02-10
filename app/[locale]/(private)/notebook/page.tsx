import NotebookPage from '@/components/NotebookPage'
import type { Metadata } from 'next'
import { getTranslations, type Locale } from '@/lib/i18n'

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const t = getTranslations(params.locale)
  return {
    title: t('notebook.pageTitle'),
  }
}

export default function Page() {
  return <NotebookPage mode="self" />
}
