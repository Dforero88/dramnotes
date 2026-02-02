'use client'

import { useAuth } from '@/hooks/useAuth'
import AuthBlock from '@/components/AuthBlock'

export default function ExplorerPage() {
  const { isLoggedIn, isLoading } = useAuth()

  if (isLoading) return <div>Chargement...</div>
  if (!isLoggedIn) return <AuthBlock title="Explorer la communauté" />

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Explorer</h1>
      <p>Recherche de comptes, follow/unfollow - En construction</p>
    </div>
  )
}