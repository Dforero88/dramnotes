'use client'

import { useAuth } from '@/hooks/useAuth'
import AuthBlock from '@/components/AuthBlock'
import { useParams } from 'next/navigation'
import { getTranslations, type Locale } from '@/lib/i18n'

export default function AccountPage() {
  const params = useParams()
  const locale = params.locale as Locale
  const t = getTranslations(locale)
  const { isLoggedIn, isLoading } = useAuth()

  if (isLoading) return <div>Chargement...</div>
  if (!isLoggedIn) return <AuthBlock title={t('aromatic.title')} />

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Ma roue</h1>
      <p>En construction</p>
    </div>
  )
}
