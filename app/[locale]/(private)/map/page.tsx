import MapPage from '@/components/MapPage'
import type { Metadata } from 'next'
import { getTranslations, type Locale } from '@/lib/i18n'

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const t = getTranslations(params.locale)
  return { title: t('map.pageTitle') }
}

export default function MapRoute() {
  return <MapPage />
}
