'use client'

import { useAuth } from '@/hooks/useAuth'
import AuthBlock from '@/components/AuthBlock'

export default function AccountPage() {
  const { isLoggedIn, isLoading } = useAuth()

  if (isLoading) return <div>Chargement...</div>
  if (!isLoggedIn) return <AuthBlock title="Votre map" />

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Ma map</h1>
      <p>En construction</p>
    </div>
  )
}