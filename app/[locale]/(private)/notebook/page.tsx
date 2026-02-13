import NotebookPage from '@/components/NotebookPage'
import type { Metadata } from 'next'
import { getTranslations, type Locale } from '@/lib/i18n'

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params
  const t = getTranslations(locale)
  return {
    title: t('notebook.pageTitle'),
  }
}

export default function Page() {
  return <NotebookPage mode="self" />
}
