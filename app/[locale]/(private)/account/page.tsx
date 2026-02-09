'use client'

export const dynamic = 'force-dynamic'

import { useAuth } from '@/hooks/useAuth'
import AuthBlock from '@/components/AuthBlock'
import { useParams } from 'next/navigation'
import { getTranslations, type Locale } from '@/lib/i18n'
import { useEffect, useState } from 'react'

type AccountData = {
  pseudo: string
  visibility: 'private' | 'public'
  address: string
  zipCode: string
  town: string
  countryId: string
}

type Country = {
  id: string
  name: string
  nameFr?: string | null
  displayName?: string | null
}

export default function AccountPage() {
  const params = useParams()
  const locale = params.locale as Locale
  const t = getTranslations(locale)
  const { isLoggedIn, isLoading } = useAuth()
  const [data, setData] = useState<AccountData | null>(null)
  const [countries, setCountries] = useState<Country[]>([])

  const [pseudo, setPseudo] = useState('')
  const [newPseudo, setNewPseudo] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'public'>('private')
  const [address, setAddress] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [town, setTown] = useState('')
  const [countryId, setCountryId] = useState('')

  const [loadingPseudo, setLoadingPseudo] = useState(false)
  const [loadingVisibility, setLoadingVisibility] = useState(false)
  const [loadingAddress, setLoadingAddress] = useState(false)

  const [pseudoMessage, setPseudoMessage] = useState('')
  const [visibilityMessage, setVisibilityMessage] = useState('')
  const [addressMessage, setAddressMessage] = useState('')

  useEffect(() => {
    if (!isLoggedIn) return
    const load = async () => {
      try {
        const res = await fetch('/api/account', { cache: 'no-store', credentials: 'include' })
        const json = await res.json()
        if (!res.ok) {
          throw new Error(json?.error || 'Erreur')
        }
        setData(json)
        setPseudo(json.pseudo || '')
        setNewPseudo('')
        setVisibility(json.visibility || 'private')
        setAddress(json.address || '')
        setZipCode(json.zipCode || '')
        setTown(json.town || '')
        setCountryId(json.countryId || '')
      } catch (e) {
        console.error('Erreur chargement compte', e)
      }
    }
    load()
  }, [isLoggedIn])

  useEffect(() => {
    const loadCountries = async () => {
      try {
        const res = await fetch(`/api/countries?lang=${locale}`)
        const json = await res.json()
        setCountries(json?.countries || [])
      } catch (e) {
        console.error('Erreur countries', e)
      }
    }
    loadCountries()
  }, [])

  const savePseudo = async () => {
    setPseudoMessage('')
    setLoadingPseudo(true)
    try {
      const res = await fetch('/api/account/pseudo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: newPseudo }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Erreur')
        setPseudoMessage(t('account.pseudoSaved'))
        setPseudo(newPseudo)
        setNewPseudo('')
    } catch (e: any) {
      setPseudoMessage(e?.message || t('common.error'))
    } finally {
      setLoadingPseudo(false)
    }
  }

  const saveVisibility = async () => {
    setVisibilityMessage('')
    setLoadingVisibility(true)
    try {
      const res = await fetch('/api/account/visibility', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Erreur')
      setVisibilityMessage(t('account.visibilitySaved'))
    } catch (e: any) {
      setVisibilityMessage(e?.message || t('common.error'))
    } finally {
      setLoadingVisibility(false)
    }
  }

  const saveAddress = async () => {
    setAddressMessage('')
    setLoadingAddress(true)
    try {
      const res = await fetch('/api/account/address', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, zipCode, town, countryId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Erreur')
      setAddressMessage(t('account.addressSaved'))
    } catch (e: any) {
      setAddressMessage(e?.message || t('common.error'))
    } finally {
      setLoadingAddress(false)
    }
  }

  if (isLoading) return <div>{t('common.loading')}</div>
  if (!isLoggedIn) return <AuthBlock title={t('account.title')} />

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">{t('account.title')}</h1>
          <p className="text-gray-600 mt-2">{t('account.subtitle')}</p>
        </div>

        {/* Section Pseudo */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-xl font-semibold">{t('account.pseudoTitle')}</h2>
          <p className="text-sm text-gray-600 mt-1">{t('account.pseudoHelp')}</p>
          <div className="mt-4 space-y-4">
            <div>
              <div
                className="inline-flex items-center gap-3 rounded-full px-4 py-2 border"
                style={{ backgroundColor: 'var(--color-primary-light)', borderColor: 'var(--color-primary)' }}
              >
                <span className="text-xs uppercase tracking-wide text-gray-600">
                  {t('account.currentPseudo')}
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {pseudo || '-'}
                </span>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <input
                value={newPseudo}
                onChange={(e) => setNewPseudo(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2"
                placeholder={t('account.pseudoPlaceholder')}
                style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
              />
              <button
                onClick={savePseudo}
                disabled={loadingPseudo || !newPseudo.trim()}
                className="px-5 py-2 rounded-xl text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {loadingPseudo ? t('common.saving') : t('account.save')}
              </button>
            </div>
          </div>
          {pseudoMessage && (
            <p className="text-sm mt-2 text-gray-700">{pseudoMessage}</p>
          )}
        </div>

        {/* Section Visibilité */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-xl font-semibold">{t('account.visibilityTitle')}</h2>
          <p className="text-sm text-gray-600 mt-1">{t('account.visibilityHelp')}</p>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700">
                {visibility === 'public' ? t('account.visibilityPublic') : t('account.visibilityPrivate')}
              </span>
              <button
                onClick={() => setVisibility(visibility === 'public' ? 'private' : 'public')}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${visibility === 'public' ? 'bg-green-500' : 'bg-gray-300'}`}
                aria-label="toggle-visibility"
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full transition-transform ${visibility === 'public' ? 'translate-x-6' : 'translate-x-0'}`}
                />
              </button>
            </div>
            <button
              onClick={saveVisibility}
              disabled={loadingVisibility}
              className="px-5 py-2 rounded-xl text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {loadingVisibility ? t('common.saving') : t('account.save')}
            </button>
          </div>
          {visibilityMessage && (
            <p className="text-sm mt-2 text-gray-700">{visibilityMessage}</p>
          )}
        </div>

        {/* Section Adresse */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-xl font-semibold">{t('account.addressTitle')}</h2>
          <p className="text-sm text-gray-600 mt-1">{t('account.addressHelp')}</p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2 md:col-span-2 focus:outline-none focus:ring-2"
              placeholder={t('account.addressPlaceholder')}
              style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
            />
            <input
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2"
              placeholder={t('account.zipPlaceholder')}
              style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
            />
            <input
              value={town}
              onChange={(e) => setTown(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2"
              placeholder={t('account.townPlaceholder')}
              style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
            />
            <select
              value={countryId}
              onChange={(e) => setCountryId(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
            >
              <option value="">{t('common.selectEmpty')}</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>{c.displayName || c.nameFr || c.name}</option>
              ))}
            </select>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={saveAddress}
              disabled={loadingAddress}
              className="px-5 py-2 rounded-xl text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {loadingAddress ? t('common.saving') : t('account.save')}
            </button>
          </div>
          {addressMessage && (
            <p className="text-sm mt-2 text-gray-700">{addressMessage}</p>
          )}
        </div>
      </div>
    </div>
  )
}
