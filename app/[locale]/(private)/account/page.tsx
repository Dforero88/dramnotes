'use client'

import { useAuth } from '@/hooks/useAuth'
import AuthBlock from '@/components/AuthBlock'

export default function AccountPage() {
  const { isLoggedIn, isLoading } = useAuth()

  if (isLoading) return <div>Chargement...</div>
  if (!isLoggedIn) return <AuthBlock title="Gérer votre compte" />

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Mon Compte</h1>
      <p>Paramètres, profil, visibilité - En construction</p>
    </div>
  )
}