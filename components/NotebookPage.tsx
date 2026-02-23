'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getTranslations, type Locale } from '@/lib/i18n'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { trackEvent } from '@/lib/analytics-client'
import NotebookNotesMap from '@/components/NotebookNotesMap'
import { buildWhiskyPath } from '@/lib/whisky-url'
import { Notepad, Sparkle, BeerBottle, PencilSimple } from '@phosphor-icons/react'
import SignupCtaLink from '@/components/SignupCtaLink'

type Summary = {
  user: { id: string; pseudo: string; countryId?: string | null; visibility: 'public' | 'private'; shelfVisibility?: 'public' | 'private' }
  counts: { notes: number; drafts?: number; shelf?: number; followers: number; following: number }
  isOwner: boolean
  isFollowing: boolean
  private?: boolean
}

type NoteCard = {
  id: string
  tastingDate: string
  rating: number | null
  location: string | null
  locationVisibility: string | null
  whiskyId: string
  whiskyName: string | null
  distillerName: string | null
  bottlerName: string | null
  bottlingType: string | null
  type: string | null
  countryName: string | null
  bottleImageUrl: string | null
  latitude: number | null
  longitude: number | null
  tags: string[]
  extraTagsCount: number
}

type ShelfCard = {
  id: string
  status: 'wishlist' | 'owned_unopened' | 'owned_opened' | 'finished'
  updatedAt: string | number | Date | null
  whiskyId: string
  whiskySlug: string | null
  whiskyName: string | null
  distillerName: string | null
  bottlerName: string | null
  bottlingType: string | null
  type: string | null
  countryName: string | null
  bottleImageUrl: string | null
}

type DraftCard = {
  id: string
  tastingDate: string
  rating: number | null
  location: string | null
  overall: string | null
  completionPercent: number
  updatedAt: string | number | Date | null
  whiskyId: string
  whiskySlug: string | null
  whiskyName: string | null
  distillerName: string | null
  bottlerName: string | null
  bottlingType: string | null
  type: string | null
  countryName: string | null
  bottleImageUrl: string | null
}

type NotebookPreview = {
  user: { id: string; pseudo: string; countryId?: string | null }
  counts: { notes: number; shelf: number; followers: number; following: number }
  notes: NoteCard[]
  shelf: ShelfCard[]
  followers: Array<{ id: string; pseudo: string; countryId?: string | null; notesCount: number }>
  following: Array<{ id: string; pseudo: string; countryId?: string | null; notesCount: number }>
  aroma: {
    hasProfile: boolean
    totalNotes: number
    avgRating: number
    top: Record<string, { name: string; score: number; count: number }[]>
  }
}

type UserCard = {
  id: string
  pseudo: string
  notesCount: number
  isFollowing: boolean
}

function avatarForPseudo(pseudo: string) {
  const colors = [
    '#3498db', '#2ecc71', '#e74c3c', '#f39c12',
    '#9b59b6', '#1abc9c', '#d35400', '#c0392b',
    '#8e44ad', '#27ae60', '#2980b9', '#f1c40f',
  ]
  let hash = 0
  for (let i = 0; i < pseudo.length; i += 1) {
    hash = ((hash << 5) - hash) + pseudo.charCodeAt(i)
    hash |= 0
  }
  const color = colors[Math.abs(hash) % colors.length]
  const initial = pseudo.charAt(0).toUpperCase()
  return { color, initial }
}

function normalizeImage(url?: string | null) {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('/')) return url
  return `/${url}`
}

function FollowActionIcon({ following }: { following?: boolean }) {
  if (following) {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 19a4 4 0 0 0-8 0" />
        <circle cx="12" cy="8" r="3.5" />
        <path d="M18.5 10.5 20 12l3-3" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 19a4 4 0 0 0-8 0" />
      <circle cx="12" cy="8" r="3.5" />
      <path d="M21 12h-5M18.5 9.5v5" />
    </svg>
  )
}

function getCountryFlagUrl(countryId?: string | null) {
  if (!countryId) return ''
  const code = countryId.trim().toLowerCase()
  if (!code) return ''
  if (code === 'sct') return '/flags/scotland.svg'
  return `https://hatscripts.github.io/circle-flags/flags/${code}.svg`
}

type NotebookProps = {
  mode: 'self' | 'public'
  pseudo?: string
}

export default function NotebookPage({ mode, pseudo }: NotebookProps) {
  const params = useParams()
  const locale = params.locale as Locale
  const t = getTranslations(locale)
  const { isLoggedIn, isLoading, user: viewer } = useAuth()

  const [summary, setSummary] = useState<Summary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [activeTab, setActiveTab] = useState<'notes' | 'drafts' | 'followers' | 'following' | 'aroma' | 'shelf'>('notes')
  const [notesView, setNotesView] = useState<'list' | 'map'>('list')
  const [notesSort, setNotesSort] = useState<'created_desc' | 'created_asc' | 'rating_desc' | 'rating_asc'>('created_desc')
  const [shareNotice, setShareNotice] = useState<string | null>(null)

  const [notes, setNotes] = useState<NoteCard[]>([])
  const [notesPage, setNotesPage] = useState(1)
  const [notesPages, setNotesPages] = useState(1)
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [mapNotes, setMapNotes] = useState<NoteCard[]>([])
  const [loadingMapNotes, setLoadingMapNotes] = useState(false)

  const [followers, setFollowers] = useState<UserCard[]>([])
  const [followersPage, setFollowersPage] = useState(1)
  const [followersPages, setFollowersPages] = useState(1)
  const [loadingFollowers, setLoadingFollowers] = useState(false)

  const [following, setFollowing] = useState<UserCard[]>([])
  const [followingPage, setFollowingPage] = useState(1)
  const [followingPages, setFollowingPages] = useState(1)
  const [loadingFollowing, setLoadingFollowing] = useState(false)

  const [aromaData, setAromaData] = useState<{
    hasProfile: boolean
    totalNotes: number
    avgRating: number
    top: Record<string, { name: string; score: number; count: number }[]>
    worst: Record<string, { name: string; score: number; count: number }[]>
  } | null>(null)
  const [loadingAroma, setLoadingAroma] = useState(false)
  const [shelfItems, setShelfItems] = useState<ShelfCard[]>([])
  const [shelfPage, setShelfPage] = useState(1)
  const [shelfPages, setShelfPages] = useState(1)
  const [shelfSort, setShelfSort] = useState<'updated_desc' | 'updated_asc' | 'name_asc' | 'name_desc'>('updated_desc')
  const [loadingShelf, setLoadingShelf] = useState(false)
  const [draftItems, setDraftItems] = useState<DraftCard[]>([])
  const [draftPage, setDraftPage] = useState(1)
  const [draftPages, setDraftPages] = useState(1)
  const [draftSort, setDraftSort] = useState<'updated_desc' | 'updated_asc' | 'name_asc' | 'name_desc'>('updated_desc')
  const [loadingDrafts, setLoadingDrafts] = useState(false)
  const [preview, setPreview] = useState<NotebookPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewTab, setPreviewTab] = useState<'notes' | 'aroma' | 'shelf' | 'followers' | 'following'>('notes')
  const [previewNotesView, setPreviewNotesView] = useState<'list' | 'map'>('list')
  const noteCountLabel = (count: number) => (count <= 1 ? t('notebook.noteCountSingular') : t('notebook.noteCountPlural'))
  const shelfCountLabel = (count: number) => (count <= 1 ? t('notebook.shelfCountSingular') : t('notebook.shelfCountPlural'))
  const followersCountLabel = (count: number) => (count <= 1 ? t('notebook.followerCountSingular') : t('notebook.followerCountPlural'))
  const followingCountLabel = (count: number) => (count <= 1 ? t('notebook.followingCountSingular') : t('notebook.followingCountPlural'))
  const noteCountText = (count: number) => `${count} ${count <= 1 ? t('notebook.noteCountSingular') : t('notebook.noteCountPlural')}`

  const hideSocialTabs = useMemo(() => {
    if (!summary) return false
    return summary.isOwner && summary.user.visibility !== 'public'
  }, [summary])

  const canShare = Boolean(summary && summary.user.visibility === 'public')

  const isShelfVisible = useMemo(() => {
    if (!summary) return false
    if (summary.isOwner) return true
    return summary.user.visibility === 'public' && summary.user.shelfVisibility === 'public'
  }, [summary])
  const hasDraftsTab = Boolean(summary?.isOwner && (summary?.counts?.drafts || 0) > 0)
  const kpiCardsCount = 2 + (hasDraftsTab ? 1 : 0) + (isShelfVisible ? 1 : 0)
  const kpiGridLgClass =
    kpiCardsCount >= 4 ? 'lg:grid-cols-4' : kpiCardsCount === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'

  const statusLabel = (status: ShelfCard['status']) => {
    if (status === 'wishlist') return t('notebook.shelfWishlist')
    if (status === 'owned_unopened') return t('notebook.shelfOwnedNew')
    if (status === 'owned_opened') return t('notebook.shelfOwnedOpen')
    return t('notebook.shelfFinished')
  }

  const statusIcon = (status: ShelfCard['status']) => {
    if (status === 'wishlist') {
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20s-6.5-4.2-8.5-7A5.2 5.2 0 0 1 12 6.4 5.2 5.2 0 0 1 20.5 13c-2 2.8-8.5 7-8.5 7z" />
        </svg>
      )
    }
    if (status === 'owned_unopened') {
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.5 4.5C8.2 7.6 7 9.7 7 12a3.5 3.5 0 0 0 7 0c0-2.3-1.2-4.4-3.5-7.5z" />
          <path d="M17.2 8.2c-1.6 2.1-2.4 3.6-2.4 5a2.4 2.4 0 0 0 4.8 0c0-1.4-.8-2.9-2.4-5z" />
        </svg>
      )
    }
    if (status === 'owned_opened') {
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 4.5C9.2 8.2 7.5 10.7 7.5 13.3a4.5 4.5 0 0 0 9 0c0-2.6-1.7-5.1-4.5-8.8z" />
          <path d="M8.8 14h6.4" />
        </svg>
      )
    }
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 4.5C9.2 8.2 7.5 10.7 7.5 13.3a4.5 4.5 0 0 0 9 0c0-2.6-1.7-5.1-4.5-8.8z" />
        <path d="M5 19 19 5" />
      </svg>
    )
  }

  const handleShare = async () => {
    if (!summary) return
    const url = `${window.location.origin}/${locale}/user/${summary.user.pseudo}`
    try {
      if (navigator.share) {
        await navigator.share({ title: `${summary.user.pseudo} — ${t('notebook.pageTitle')}`, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setShareNotice(t('notebook.shareCopied'))
      setTimeout(() => setShareNotice(null), 2000)
    } catch {
      // ignore
    }
  }

  const loadSummary = async () => {
    if (!isLoggedIn) return
    setLoadingSummary(true)
    const params = new URLSearchParams()
    if (mode === 'public' && pseudo) params.set('pseudo', pseudo)
    const res = await fetch(`/api/notebook/summary?${params.toString()}`, { cache: 'no-store' })
    const json = await res.json()
    setSummary(json)
    setLoadingSummary(false)
  }

  const loadNotes = async (
    page = notesPage,
    sort: 'created_desc' | 'created_asc' | 'rating_desc' | 'rating_asc' = notesSort
  ) => {
    if (!summary?.user?.id) return
    setLoadingNotes(true)
    const params = new URLSearchParams()
    params.set('userId', summary.user.id)
    params.set('page', String(page))
    params.set('pageSize', '12')
    params.set('lang', locale)
    params.set('sort', sort)
    const res = await fetch(`/api/notebook/notes?${params.toString()}`, { cache: 'no-store' })
    const json = await res.json()
    setNotes(json.items || [])
    setNotesPages(json.totalPages || 1)
    setLoadingNotes(false)
  }

  const loadMapNotes = async () => {
    if (!summary?.user?.id) return
    setLoadingMapNotes(true)
    const params = new URLSearchParams()
    params.set('userId', summary.user.id)
    params.set('page', '1')
    params.set('pageSize', '200')
    params.set('lang', locale)
    const res = await fetch(`/api/notebook/notes?${params.toString()}`, { cache: 'no-store' })
    const json = await res.json()
    setMapNotes(json.items || [])
    setLoadingMapNotes(false)
  }

  const loadFollowers = async (page = followersPage) => {
    if (!summary?.user?.id) return
    setLoadingFollowers(true)
    const params = new URLSearchParams()
    params.set('userId', summary.user.id)
    params.set('page', String(page))
    params.set('pageSize', '12')
    const res = await fetch(`/api/notebook/followers?${params.toString()}`, { cache: 'no-store' })
    const json = await res.json()
    setFollowers(json.items || [])
    setFollowersPages(json.totalPages || 1)
    setLoadingFollowers(false)
  }

  const loadFollowing = async (page = followingPage) => {
    if (!summary?.user?.id) return
    setLoadingFollowing(true)
    const params = new URLSearchParams()
    params.set('userId', summary.user.id)
    params.set('page', String(page))
    params.set('pageSize', '12')
    const res = await fetch(`/api/notebook/following?${params.toString()}`, { cache: 'no-store' })
    const json = await res.json()
    setFollowing(json.items || [])
    setFollowingPages(json.totalPages || 1)
    setLoadingFollowing(false)
  }

  const loadAroma = async () => {
    if (!summary?.user?.id) return
    setLoadingAroma(true)
    const params = new URLSearchParams()
    params.set('userId', summary.user.id)
    params.set('lang', locale)
    const res = await fetch(`/api/notebook/aroma?${params.toString()}`, { cache: 'no-store' })
    const json = await res.json()
    setAromaData(json)
    setLoadingAroma(false)
  }

  const loadShelf = async (
    page = shelfPage,
    sort: 'updated_desc' | 'updated_asc' | 'name_asc' | 'name_desc' = shelfSort
  ) => {
    if (!summary?.user?.id) return
    setLoadingShelf(true)
    const params = new URLSearchParams()
    params.set('userId', summary.user.id)
    params.set('page', String(page))
    params.set('pageSize', '12')
    params.set('lang', locale)
    params.set('sort', sort)
    const res = await fetch(`/api/notebook/shelf?${params.toString()}`, { cache: 'no-store' })
    const json = await res.json()
    setShelfItems(json.items || [])
    setShelfPages(json.totalPages || 1)
    setLoadingShelf(false)
  }

  const loadDrafts = async (
    page = draftPage,
    sort: 'updated_desc' | 'updated_asc' | 'name_asc' | 'name_desc' = draftSort
  ) => {
    if (!summary?.user?.id || !summary.isOwner) return
    setLoadingDrafts(true)
    const params = new URLSearchParams()
    params.set('userId', summary.user.id)
    params.set('page', String(page))
    params.set('pageSize', '12')
    params.set('lang', locale)
    params.set('sort', sort)
    const res = await fetch(`/api/notebook/drafts?${params.toString()}`, { cache: 'no-store' })
    const json = await res.json()
    setDraftItems(json.items || [])
    setDraftPages(json.totalPages || 1)
    setLoadingDrafts(false)
  }

  useEffect(() => {
    if (isLoggedIn) loadSummary()
  }, [isLoggedIn])

  useEffect(() => {
    if (isLoading || isLoggedIn || mode !== 'self') return
    let cancelled = false
    const loadPreview = async () => {
      setLoadingPreview(true)
      try {
        const res = await fetch(`/api/notebook/preview?lang=${locale}`, { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setPreview(json)
      } finally {
        if (!cancelled) setLoadingPreview(false)
      }
    }
    loadPreview()
    return () => {
      cancelled = true
    }
  }, [isLoading, isLoggedIn, locale, mode])

  useEffect(() => {
    if (!summary || summary.private) return
    const isOwn = summary.isOwner
    // page_view is tracked automatically by GA; no custom view event needed
  }, [summary?.user?.id])

  useEffect(() => {
    if (!summary || summary.private) return
    if (notesView !== 'list') return
    setNotesPage(1)
    loadNotes(1)
  }, [summary?.user?.id, notesSort, notesView])

  useEffect(() => {
    if (!summary || summary.private) return
    if (activeTab !== 'notes' || notesView !== 'map') return
    loadMapNotes()
  }, [summary?.user?.id, activeTab, notesView, locale])

  useEffect(() => {
    if (!summary || summary.private) return
    if (activeTab !== 'shelf') return
    if (!isShelfVisible) return
    setShelfPage(1)
    loadShelf(1)
  }, [summary?.user?.id, activeTab, shelfSort, isShelfVisible])

  useEffect(() => {
    if (!summary || summary.private) return
    if (!summary.isOwner || activeTab !== 'drafts') return
    setDraftPage(1)
    loadDrafts(1)
  }, [summary?.user?.id, activeTab, draftSort])

  useEffect(() => {
    if (!summary || summary.private) return
    if (hideSocialTabs && (activeTab === 'followers' || activeTab === 'following')) {
      setActiveTab('notes')
      return
    }
    if (activeTab === 'followers') loadFollowers(1)
    if (activeTab === 'following') loadFollowing(1)
    if (activeTab === 'aroma') loadAroma()
  }, [activeTab, summary?.user?.id, hideSocialTabs])

  useEffect(() => {
    if (!summary || summary.private) return
    if (activeTab === 'notes') return
    trackEvent('notebook_section_view', {
      section: activeTab,
      viewer_is_owner: summary.isOwner,
      profile_pseudo: summary.user.pseudo,
    })
  }, [activeTab, summary?.user?.id])

  useEffect(() => {
    if (!summary || summary.private) return
    if (activeTab !== 'notes' || notesView !== 'map') return
    trackEvent('notebook_notes_map_viewed', {
      viewer_is_owner: summary.isOwner,
      profile_pseudo: summary.user.pseudo,
    })
  }, [activeTab, notesView, summary?.user?.id])

  const toggleFollow = async (targetUserId: string) => {
    const res = await fetch('/api/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId }),
    })
    if (!res.ok) return
    const json = await res.json()
    if (summary && summary.user.id === targetUserId) {
      setSummary({ ...summary, isFollowing: json.following })
    }
    if (json.following) {
      trackEvent('follow_user', { target_user_id: targetUserId })
    } else {
      trackEvent('unfollow_user', { target_user_id: targetUserId })
    }
    loadSummary()
    if (activeTab === 'followers') loadFollowers()
    if (activeTab === 'following') loadFollowing()
  }

  const deleteDraft = async (draftId: string) => {
    if (!confirm(t('tasting.confirmDelete'))) return
    const res = await fetch(`/api/tasting-notes/${draftId}`, { method: 'DELETE' })
    if (!res.ok) return
    trackEvent('tasting_note_draft_deleted', { note_id: draftId })
    await Promise.all([loadSummary(), loadDrafts(draftPage)])
  }

  if (isLoading) return <div className="p-8">{t('common.loading')}</div>
  if (!isLoggedIn) {
    const previewAvatar = preview ? avatarForPseudo(preview.user.pseudo) : null
    const previewFlagUrl = getCountryFlagUrl(preview?.user?.countryId || null)
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 space-y-6">
          {!loadingPreview && preview ? (
            <div className="relative">
              <div className="opacity-75 blur-[1.5px]">
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center gap-4 min-w-0">
                    {previewAvatar ? (
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-semibold shrink-0"
                        style={{ backgroundColor: previewAvatar.color }}
                      >
                        {previewAvatar.initial}
                      </div>
                    ) : null}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-xl font-semibold text-gray-900 truncate">{preview.user.pseudo}</div>
                        {previewFlagUrl ? <img src={previewFlagUrl} alt="" className="h-5 w-5 rounded-full" /> : null}
                      </div>
                      <div className="text-sm text-gray-500">{t('notebook.profileSubtitle')}</div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <button
                      onClick={() => setPreviewTab('notes')}
                      className={`rounded-xl h-20 border px-4 flex items-center gap-3 text-left ${previewTab === 'notes' ? 'border-transparent' : 'border-gray-200'}`}
                      style={previewTab === 'notes' ? { backgroundColor: 'var(--color-primary-light)' } : { backgroundColor: '#fff' }}
                    >
                      <span className="relative inline-flex items-center justify-center">
                        <Notepad
                          size={28}
                          weight="duotone"
                          aria-hidden
                          style={{ color: 'var(--color-primary)', opacity: previewTab === 'notes' ? 1 : 0.68 }}
                        />
                        <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-gray-900 text-white text-[10px] font-semibold leading-[18px] text-center">
                          {preview.counts.notes}
                        </span>
                      </span>
                      <span className={`text-sm font-medium ${previewTab === 'notes' ? 'text-[var(--color-primary)]' : 'text-gray-700'}`}>
                        {noteCountLabel(preview.counts.notes)}
                      </span>
                    </button>

                    <button
                      onClick={() => setPreviewTab('aroma')}
                      className={`rounded-xl h-20 border px-4 flex items-center gap-3 text-left ${previewTab === 'aroma' ? 'border-transparent' : 'border-gray-200'}`}
                      style={previewTab === 'aroma' ? { backgroundColor: 'var(--color-primary-light)' } : { backgroundColor: '#fff' }}
                    >
                      <Sparkle
                        size={28}
                        weight="duotone"
                        aria-hidden
                        style={{ color: 'var(--color-primary)', opacity: previewTab === 'aroma' ? 1 : 0.68 }}
                      />
                      <span className={`text-sm font-medium ${previewTab === 'aroma' ? 'text-[var(--color-primary)]' : 'text-gray-700'}`}>
                        {t('notebook.aromaTitle')}
                      </span>
                    </button>

                    <button
                      onClick={() => setPreviewTab('shelf')}
                      className={`rounded-xl h-20 border px-4 flex items-center gap-3 text-left ${previewTab === 'shelf' ? 'border-transparent' : 'border-gray-200'}`}
                      style={previewTab === 'shelf' ? { backgroundColor: 'var(--color-primary-light)' } : { backgroundColor: '#fff' }}
                    >
                      <span className="relative inline-flex items-center justify-center">
                        <BeerBottle
                          size={28}
                          weight="duotone"
                          className="-rotate-45"
                          aria-hidden
                          style={{ color: 'var(--color-primary)', opacity: previewTab === 'shelf' ? 1 : 0.68 }}
                        />
                        <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-gray-900 text-white text-[10px] font-semibold leading-[18px] text-center">
                          {preview.counts.shelf}
                        </span>
                      </span>
                      <span className={`text-sm font-medium ${previewTab === 'shelf' ? 'text-[var(--color-primary)]' : 'text-gray-700'}`}>
                        {shelfCountLabel(preview.counts.shelf)}
                      </span>
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => setPreviewTab('followers')}
                      className="rounded-xl px-4 py-2.5 text-left border border-gray-200"
                      style={previewTab === 'followers' ? { backgroundColor: 'var(--color-primary-light)', borderColor: 'transparent' } : { backgroundColor: '#fff' }}
                    >
                      <div className="text-lg font-semibold text-gray-900">{preview.counts.followers}</div>
                      <div className="text-xs text-gray-600">{followersCountLabel(preview.counts.followers)}</div>
                    </button>
                    <button
                      onClick={() => setPreviewTab('following')}
                      className="rounded-xl px-4 py-2.5 text-left border border-gray-200"
                      style={previewTab === 'following' ? { backgroundColor: 'var(--color-primary-light)', borderColor: 'transparent' } : { backgroundColor: '#fff' }}
                    >
                      <div className="text-lg font-semibold text-gray-900">{preview.counts.following}</div>
                      <div className="text-xs text-gray-600">{followingCountLabel(preview.counts.following)}</div>
                    </button>
                  </div>

                  <div className="mt-6">
                    {previewTab === 'notes' ? (
                      <div className="space-y-4">
                        <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 p-1">
                          <button
                            type="button"
                            onClick={() => setPreviewNotesView('list')}
                            className={`px-3 py-1.5 rounded-full text-sm transition ${previewNotesView === 'list' ? 'text-white' : 'text-gray-700'}`}
                            style={{ backgroundColor: previewNotesView === 'list' ? 'var(--color-primary)' : 'transparent' }}
                          >
                            {t('notebook.notesListView')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewNotesView('map')}
                            className={`px-3 py-1.5 rounded-full text-sm transition ${previewNotesView === 'map' ? 'text-white' : 'text-gray-700'}`}
                            style={{ backgroundColor: previewNotesView === 'map' ? 'var(--color-primary)' : 'transparent' }}
                          >
                            {t('notebook.notesMapView')}
                          </button>
                        </div>
                        {previewNotesView === 'list' ? (
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {preview.notes.map((note) => (
                              <div key={note.id} className="rounded-xl border border-gray-200 p-4 bg-white">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-lg bg-white border border-gray-100 flex items-center justify-center overflow-hidden">
                                    {normalizeImage(note.bottleImageUrl) ? (
                                      <img src={normalizeImage(note.bottleImageUrl)} alt={note.whiskyName || ''} className="w-full h-full object-contain" />
                                    ) : null}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-gray-900 truncate">{note.whiskyName || '-'}</div>
                                    <div className="text-xs text-gray-500">
                                      {note.rating != null ? `${t('notebook.ratingLabel')}: ${note.rating}/10` : t('notebook.ratingLabel')}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-gray-200 overflow-hidden">
                            <NotebookNotesMap
                              notes={preview.notes}
                              locale={locale}
                              viewWhiskyLabel={t('map.viewWhisky')}
                            />
                          </div>
                        )}
                      </div>
                    ) : null}

                    {previewTab === 'aroma' ? (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {(['nose', 'palate', 'finish'] as const).map((section) => (
                          <div key={section} className="rounded-xl border border-gray-200 p-4 bg-white">
                            <div className="text-sm font-semibold text-gray-900 capitalize">{section}</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {(preview.aroma.top?.[section] || []).slice(0, 3).map((tag, idx) => (
                                <span key={`${section}-${idx}`} className="px-2 py-1 rounded-full text-xs border border-gray-200 bg-gray-50 text-gray-700">
                                  {tag.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {previewTab === 'shelf' ? (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {preview.shelf.map((item) => (
                          <div key={item.id} className="rounded-xl border border-gray-200 p-4 bg-white">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-lg bg-white border border-gray-100 flex items-center justify-center overflow-hidden">
                                {normalizeImage(item.bottleImageUrl) ? (
                                  <img src={normalizeImage(item.bottleImageUrl)} alt={item.whiskyName || ''} className="w-full h-full object-contain" />
                                ) : null}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900 truncate">{item.whiskyName || '-'}</div>
                                <div className="text-xs text-gray-500">{statusLabel(item.status)}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {previewTab === 'followers' ? (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {preview.followers.map((user) => {
                          const avatar = avatarForPseudo(user.pseudo)
                          const flagUrl = getCountryFlagUrl(user.countryId || null)
                          return (
                            <div key={user.id} className="rounded-xl border border-gray-200 p-4 bg-white">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-11 h-11 rounded-full flex items-center justify-center text-white text-lg font-semibold shrink-0"
                                  style={{ backgroundColor: avatar.color }}
                                >
                                  {avatar.initial}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="text-sm font-semibold text-gray-900 truncate">{user.pseudo}</div>
                                    {flagUrl ? <img src={flagUrl} alt="" className="h-4 w-4 rounded-full" /> : null}
                                  </div>
                                  <div className="text-xs text-gray-500">{noteCountText(user.notesCount)}</div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : null}

                    {previewTab === 'following' ? (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {preview.following.map((user) => {
                          const avatar = avatarForPseudo(user.pseudo)
                          const flagUrl = getCountryFlagUrl(user.countryId || null)
                          return (
                            <div key={user.id} className="rounded-xl border border-gray-200 p-4 bg-white">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-11 h-11 rounded-full flex items-center justify-center text-white text-lg font-semibold shrink-0"
                                  style={{ backgroundColor: avatar.color }}
                                >
                                  {avatar.initial}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="text-sm font-semibold text-gray-900 truncate">{user.pseudo}</div>
                                    {flagUrl ? <img src={flagUrl} alt="" className="h-4 w-4 rounded-full" /> : null}
                                  </div>
                                  <div className="text-xs text-gray-500">{noteCountText(user.notesCount)}</div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-gray-50 via-gray-50/65 to-transparent" />
            </div>
          ) : null}

          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm text-center">
            <h2 className="text-2xl font-semibold text-gray-800 mb-3">{t('notebook.loginTitle')}</h2>
            <p className="text-gray-600 mb-6">{t('notebook.loginSubtitle')}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={`/${locale}/login`}
                className="block py-3 px-6 rounded-full text-center text-white text-sm font-medium transition"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {t('navigation.signIn')}
              </Link>
              <SignupCtaLink
                href={`/${locale}/register`}
                sourceContext="notebook_guest_block"
                className="block py-3 px-6 rounded-full text-center border text-sm font-medium transition"
                style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
              >
                {t('navigation.signUp')}
              </SignupCtaLink>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loadingSummary || !summary) {
    return <div className="p-8">{t('common.loading')}</div>
  }

  if (summary.private) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div
          className="px-4 md:px-8 py-4"
          style={{ backgroundColor: 'var(--color-primary-light)' }}
        >
          <div className="max-w-6xl mx-auto text-sm text-gray-600 text-center">
            <Link href={`/${locale}/explorer`} className="hover:underline">
              {t('explorer.title')}
            </Link>
            <span className="mx-2">›</span>
            <span className="text-gray-800">{summary.user.pseudo}</span>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-12 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">{t('notebook.privateTitle')}</h2>
          <p className="text-gray-600">{t('notebook.privateSubtitle')}</p>
        </div>
      </div>
    )
  }

  const avatar = avatarForPseudo(summary.user.pseudo)
  const profileFlagUrl = getCountryFlagUrl(summary.user.countryId || null)

  return (
    <div className="min-h-screen bg-gray-50">
      {mode === 'public' && (
        <div
          className="px-4 md:px-8 py-4"
          style={{ backgroundColor: 'var(--color-primary-light)' }}
        >
          <div className="max-w-6xl mx-auto text-sm text-gray-600 text-center">
            <Link href={`/${locale}/explorer`} className="hover:underline">
              {t('explorer.title')}
            </Link>
            <span className="mx-2">›</span>
            <span className="text-gray-800">{summary.user.pseudo}</span>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="grid grid-cols-[1fr_auto] items-center gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-semibold shrink-0"
                style={{ backgroundColor: avatar.color }}
              >
                {avatar.initial}
              </div>
              <div className="min-w-0">
                <div className="text-xl font-semibold text-gray-900 truncate inline-flex items-center gap-2">
                  <span className="truncate">{summary.user.pseudo}</span>
                  {profileFlagUrl && (
                    <img
                      src={profileFlagUrl}
                      alt=""
                      className="h-4 w-6 rounded-sm shrink-0"
                      loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  )}
                </div>
                <div className="text-sm text-gray-500">{t('notebook.profileSubtitle')}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-self-end">
              {!summary.isOwner && (
                <button
                  onClick={() => toggleFollow(summary.user.id)}
                  className="h-10 w-10 inline-flex items-center justify-center rounded-full transition shrink-0"
                  aria-label={summary.isFollowing ? t('notebook.followActionFollowing') : t('notebook.followActionFollow')}
                  title={summary.isFollowing ? t('notebook.followActionFollowing') : t('notebook.followActionFollow')}
                  style={{
                    backgroundColor: summary.isFollowing ? 'var(--color-primary-light)' : 'var(--color-primary)',
                    color: summary.isFollowing ? 'var(--color-primary)' : '#fff',
                  }}
                >
                  <FollowActionIcon following={summary.isFollowing} />
                </button>
              )}
                  {canShare && (
                    <div className="flex flex-col items-end gap-1">
                      <button
                        onClick={handleShare}
                        className="h-10 w-10 inline-flex items-center justify-center rounded-full text-sm transition border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        aria-label={t('notebook.share')}
                      >
                        <svg
                          aria-hidden
                          viewBox="0 0 24 24"
                          className="h-6 w-6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="18" cy="5" r="3" />
                          <circle cx="6" cy="12" r="3" />
                          <circle cx="18" cy="19" r="3" />
                          <path d="M8.6 11l6.8-3.4M8.6 13l6.8 3.4" />
                        </svg>
                      </button>
                  {shareNotice && <span className="text-xs text-gray-500">{shareNotice}</span>}
                </div>
              )}
            </div>
          </div>

          <div className={`mt-6 grid grid-cols-1 sm:grid-cols-2 ${kpiGridLgClass} gap-4`}>
            <button
              onClick={() => setActiveTab('notes')}
              aria-label={`${noteCountLabel(summary.counts.notes)} (${summary.counts.notes})`}
              title={`${noteCountLabel(summary.counts.notes)} (${summary.counts.notes})`}
              className={`rounded-xl h-20 border px-4 flex items-center gap-3 text-left ${activeTab === 'notes' ? 'border-transparent' : 'border-gray-200'}`}
              style={activeTab === 'notes' ? { backgroundColor: 'var(--color-primary-light)' } : { backgroundColor: '#fff' }}
            >
              <span className="relative inline-flex items-center justify-center">
                <Notepad
                  size={28}
                  weight="duotone"
                  aria-hidden
                  style={{ color: activeTab === 'notes' ? 'var(--color-primary)' : 'var(--color-primary)', opacity: activeTab === 'notes' ? 1 : 0.68 }}
                />
                <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-gray-900 text-white text-[10px] font-semibold leading-[18px] text-center">
                  {summary.counts.notes}
                </span>
              </span>
              <span className={`text-sm font-medium ${activeTab === 'notes' ? 'text-[var(--color-primary)]' : 'text-gray-700'}`}>
                {noteCountLabel(summary.counts.notes)}
              </span>
            </button>

            {hasDraftsTab && (
              <button
                onClick={() => setActiveTab('drafts')}
                aria-label={`${t('notebook.draftsTitle')} (${summary.counts.drafts || 0})`}
                title={`${t('notebook.draftsTitle')} (${summary.counts.drafts || 0})`}
                className={`rounded-xl h-20 border px-4 flex items-center gap-3 text-left ${activeTab === 'drafts' ? 'border-transparent' : 'border-gray-200'}`}
                style={activeTab === 'drafts' ? { backgroundColor: 'var(--color-primary-light)' } : { backgroundColor: '#fff' }}
              >
                <span className="relative inline-flex items-center justify-center">
                  <PencilSimple
                    size={28}
                    weight="duotone"
                    aria-hidden
                    style={{ color: activeTab === 'drafts' ? 'var(--color-primary)' : 'var(--color-primary)', opacity: activeTab === 'drafts' ? 1 : 0.68 }}
                  />
                  <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-gray-900 text-white text-[10px] font-semibold leading-[18px] text-center">
                    {summary.counts.drafts || 0}
                  </span>
                </span>
                <span className={`text-sm font-medium ${activeTab === 'drafts' ? 'text-[var(--color-primary)]' : 'text-gray-700'}`}>
                  {t('notebook.draftsTitle')}
                </span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('aroma')}
              aria-label={t('notebook.aromaTitle')}
              title={t('notebook.aromaTitle')}
              className={`rounded-xl h-20 border px-4 flex items-center gap-3 text-left ${activeTab === 'aroma' ? 'border-transparent' : 'border-gray-200'}`}
              style={activeTab === 'aroma' ? { backgroundColor: 'var(--color-primary-light)' } : { backgroundColor: '#fff' }}
            >
              <Sparkle
                size={28}
                weight="duotone"
                aria-hidden
                style={{ color: activeTab === 'aroma' ? 'var(--color-primary)' : 'var(--color-primary)', opacity: activeTab === 'aroma' ? 1 : 0.68 }}
              />
              <span className={`text-sm font-medium ${activeTab === 'aroma' ? 'text-[var(--color-primary)]' : 'text-gray-700'}`}>
                {t('notebook.aromaTitle')}
              </span>
            </button>

            {isShelfVisible && (
              <button
                onClick={() => setActiveTab('shelf')}
                aria-label={`${t('notebook.shelfTitle')} (${summary.counts.shelf || 0})`}
                title={`${t('notebook.shelfTitle')} (${summary.counts.shelf || 0})`}
                className={`rounded-xl h-20 border px-4 flex items-center gap-3 text-left ${activeTab === 'shelf' ? 'border-transparent' : 'border-gray-200'}`}
                style={activeTab === 'shelf' ? { backgroundColor: 'var(--color-primary-light)' } : { backgroundColor: '#fff' }}
              >
                <span className="relative inline-flex items-center justify-center">
                  <BeerBottle
                    size={28}
                    weight="duotone"
                    className="-rotate-45"
                    aria-hidden
                    style={{ color: activeTab === 'shelf' ? 'var(--color-primary)' : 'var(--color-primary)', opacity: activeTab === 'shelf' ? 1 : 0.68 }}
                  />
                  <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-gray-900 text-white text-[10px] font-semibold leading-[18px] text-center">
                    {summary.counts.shelf || 0}
                  </span>
                </span>
                <span className={`text-sm font-medium ${activeTab === 'shelf' ? 'text-[var(--color-primary)]' : 'text-gray-700'}`}>
                  {shelfCountLabel(summary.counts.shelf || 0)}
                </span>
              </button>
            )}
          </div>

          {!hideSocialTabs && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => setActiveTab('followers')}
                className={`rounded-xl px-4 py-2.5 text-left border transition ${activeTab === 'followers' ? 'border-transparent' : 'border-gray-200'}`}
                style={activeTab === 'followers' ? { backgroundColor: 'var(--color-primary-light)' } : { backgroundColor: '#fff' }}
              >
                <div className="text-lg font-semibold text-gray-900">{summary.counts.followers}</div>
                <div className="text-xs text-gray-600">{followersCountLabel(summary.counts.followers)}</div>
              </button>
              <button
                onClick={() => setActiveTab('following')}
                className={`rounded-xl px-4 py-2.5 text-left border transition ${activeTab === 'following' ? 'border-transparent' : 'border-gray-200'}`}
                style={activeTab === 'following' ? { backgroundColor: 'var(--color-primary-light)' } : { backgroundColor: '#fff' }}
              >
                <div className="text-lg font-semibold text-gray-900">{summary.counts.following}</div>
                <div className="text-xs text-gray-600">{followingCountLabel(summary.counts.following)}</div>
              </button>
            </div>
          )}
        </div>

        <div className="mt-8">
          {activeTab === 'notes' && (
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center rounded-full border border-gray-200 bg-white p-1">
                  <button
                    onClick={() => setNotesView('list')}
                    className={`px-3 py-1.5 rounded-full text-sm transition ${notesView === 'list' ? 'text-white' : 'text-gray-700'}`}
                    style={notesView === 'list' ? { backgroundColor: 'var(--color-primary)' } : {}}
                  >
                    {t('notebook.notesListView')}
                  </button>
                  <button
                    onClick={() => setNotesView('map')}
                    className={`px-3 py-1.5 rounded-full text-sm transition ${notesView === 'map' ? 'text-white' : 'text-gray-700'}`}
                    style={notesView === 'map' ? { backgroundColor: 'var(--color-primary)' } : {}}
                  >
                    {t('notebook.notesMapView')}
                  </button>
                </div>
                {notesView === 'list' && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="notes-sort" className="text-sm text-gray-600">
                      {t('notebook.notesSortLabel')}
                    </label>
                    <select
                      id="notes-sort"
                      value={notesSort}
                      onChange={(e) => {
                        setNotesPage(1)
                        setNotesSort(e.target.value as typeof notesSort)
                      }}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="created_desc">{t('notebook.notesSortCreatedDesc')}</option>
                      <option value="created_asc">{t('notebook.notesSortCreatedAsc')}</option>
                      <option value="rating_desc">{t('notebook.notesSortRatingDesc')}</option>
                      <option value="rating_asc">{t('notebook.notesSortRatingAsc')}</option>
                    </select>
                  </div>
                )}
              </div>

              {notesView === 'map' ? (
                loadingMapNotes ? (
                  <div className="text-sm text-gray-500">{t('common.loading')}</div>
                ) : mapNotes.filter((n) => n.latitude !== null && n.longitude !== null).length === 0 ? (
                  <div className="text-sm text-gray-600">{t('notebook.noGeoNotes')}</div>
                ) : (
                  <NotebookNotesMap
                    notes={mapNotes}
                    locale={locale}
                    viewWhiskyLabel={t('map.viewWhisky')}
                  />
                )
              ) : loadingNotes ? (
                <div className="text-sm text-gray-500">{t('common.loading')}</div>
              ) : notes.length === 0 ? (
                <div className="text-sm text-gray-600">{t('notebook.noNotes')}</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {notes.map((note) => {
                      const imageSrc = normalizeImage(note.bottleImageUrl)
                      const producer =
                        note.bottlingType === 'DB' ? note.distillerName : note.bottlerName
                      const typeLine = [note.type, note.countryName].filter(Boolean).join(' • ')
                      return (
                        <Link
                          key={note.id}
                          href={`${buildWhiskyPath(locale, note.whiskyId, note.whiskyName || undefined)}${mode === 'public' ? `?user=${summary.user.pseudo}` : ''}`}
                          className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-md transition"
                        >
                          <div className="w-full h-40 bg-white rounded-xl flex items-center justify-center overflow-hidden">
                            {imageSrc ? (
                              <img src={imageSrc} alt={note.whiskyName || ''} className="w-full h-full object-contain" />
                            ) : (
                              <div className="text-gray-400">{t('catalogue.noImage')}</div>
                            )}
                          </div>
                          <div className="mt-4 space-y-1">
                            <div className="text-base font-semibold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
                              {note.whiskyName}
                            </div>
                            {producer && (
                              <div className="text-sm text-gray-600 line-clamp-1">
                                {producer}
                              </div>
                            )}
                            {typeLine && (
                              <div className="text-xs text-gray-500">
                                {typeLine}
                              </div>
                            )}
                            {typeof note.rating === 'number' && (
                              <div>
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-xs font-semibold">
                                  ★ {note.rating}/10
                                </span>
                              </div>
                            )}
                            {summary.isOwner && note.location && (
                              <div className="text-xs text-gray-600 flex items-center gap-1.5">
                                <svg
                                  viewBox="0 0 24 24"
                                  className="h-5 w-5 text-gray-500"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M12 21s-7-4.35-7-10a7 7 0 1 1 14 0c0 5.65-7 10-7 10z" />
                                  <circle cx="12" cy="11" r="2.5" />
                                </svg>
                                <span className="truncate">{note.location}</span>
                                <span className="text-gray-400">·</span>
                                <span className="text-gray-500 inline-flex items-center gap-1">
                                  <span>{t('tasting.locationVisibilityShort')}:</span>
                                  {note.locationVisibility === 'public_precise' ? (
                                    <svg
                                      viewBox="0 0 24 24"
                                      className="h-5 w-5 text-gray-500"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      aria-label={t('tasting.locationModePrecise')}
                                    >
                                      <circle cx="12" cy="12" r="8" />
                                      <path d="M12 4v4M12 16v4M4 12h4M16 12h4" />
                                      <circle cx="12" cy="12" r="1.5" />
                                    </svg>
                                  ) : (
                                    <svg
                                      viewBox="0 0 24 24"
                                      className="h-5 w-5 text-gray-500"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      aria-label={t('tasting.locationModeCity')}
                                    >
                                      <path d="M3 21h18" />
                                      <path d="M5 21V10h5v11" />
                                      <path d="M10 21V6h4v15" />
                                      <path d="M14 21V12h5v9" />
                                      <path d="M7 13h.01M7 16h.01M12 9h.01M12 12h.01M12 15h.01M16 15h.01M16 18h.01" />
                                    </svg>
                                  )}
                                </span>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {note.tags.map((tag) => (
                                <span key={tag} className="px-3 py-1 rounded-full text-xs border border-gray-200 bg-white">
                                  {tag}
                                </span>
                              ))}
                              {note.extraTagsCount > 0 && (
                                <span className="px-3 py-1 rounded-full text-xs border border-gray-200 bg-white">
                                  +{note.extraTagsCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                  {notesPages > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-8">
                      <button
                        onClick={() => {
                          const next = Math.max(1, notesPage - 1)
                          setNotesPage(next)
                          loadNotes(next)
                        }}
                        disabled={notesPage === 1}
                        className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
                      >
                        {t('catalogue.prev')}
                      </button>
                      <span className="text-sm text-gray-500">{notesPage} / {notesPages}</span>
                      <button
                        onClick={() => {
                          const next = Math.min(notesPages, notesPage + 1)
                          setNotesPage(next)
                          loadNotes(next)
                        }}
                        disabled={notesPage === notesPages}
                        className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
                      >
                        {t('catalogue.next')}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'drafts' && summary.isOwner && (
            <div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-700">{t('notebook.draftsTitle')}</div>
                <div className="flex items-center gap-2">
                  <label htmlFor="draft-sort" className="text-sm text-gray-600">
                    {t('notebook.notesSortLabel')}
                  </label>
                  <select
                    id="draft-sort"
                    value={draftSort}
                    onChange={(e) => {
                      setDraftPage(1)
                      setDraftSort(e.target.value as typeof draftSort)
                    }}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="updated_desc">{t('notebook.shelfSortUpdatedDesc')}</option>
                    <option value="updated_asc">{t('notebook.shelfSortUpdatedAsc')}</option>
                    <option value="name_asc">{t('catalogue.sortNameAsc')}</option>
                    <option value="name_desc">{t('catalogue.sortNameDesc')}</option>
                  </select>
                </div>
              </div>

              {loadingDrafts ? (
                <div className="text-sm text-gray-500">{t('common.loading')}</div>
              ) : draftItems.length === 0 ? (
                <div className="text-sm text-gray-600">{t('notebook.noDrafts')}</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {draftItems.map((item) => {
                      const imageSrc = normalizeImage(item.bottleImageUrl)
                      const producer =
                        item.bottlingType === 'DB' ? item.distillerName : item.bottlerName
                      const typeLine = [item.type, item.countryName].filter(Boolean).join(' • ')
                      const href = buildWhiskyPath(locale, item.whiskyId, item.whiskyName || undefined, item.whiskySlug || undefined)
                      return (
                        <div key={item.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                          <Link href={href} className="block">
                            <div className="w-full h-40 bg-white rounded-xl flex items-center justify-center overflow-hidden">
                              {imageSrc ? (
                                <img src={imageSrc} alt={item.whiskyName || ''} className="w-full h-full object-contain" />
                              ) : (
                                <div className="text-gray-400">{t('catalogue.noImage')}</div>
                              )}
                            </div>
                            <div className="mt-4 space-y-1">
                              <div className="text-base font-semibold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
                                {item.whiskyName}
                              </div>
                              {producer && <div className="text-sm text-gray-600 line-clamp-1">{producer}</div>}
                              {typeLine && <div className="text-xs text-gray-500">{typeLine}</div>}
                            </div>
                          </Link>
                          <div className="mt-3">
                            <div className="text-xs text-gray-600">{t('notebook.draftCompletion')} {item.completionPercent}%</div>
                            <div className="h-1.5 mt-1 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${item.completionPercent}%`, backgroundColor: 'var(--color-primary)' }} />
                            </div>
                          </div>
                          <div className="mt-4 flex items-center gap-2">
                            <Link
                              href={href}
                              className="px-3 py-1.5 rounded-lg text-sm text-white"
                              style={{ backgroundColor: 'var(--color-primary)' }}
                            >
                              {t('notebook.draftContinue')}
                            </Link>
                            <button
                              onClick={() => deleteDraft(item.id)}
                              className="px-3 py-1.5 rounded-lg border border-red-300 text-sm text-red-600"
                            >
                              {t('notebook.draftDelete')}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {draftPages > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-8">
                      <button
                        onClick={() => {
                          const next = Math.max(1, draftPage - 1)
                          setDraftPage(next)
                          loadDrafts(next)
                        }}
                        disabled={draftPage === 1}
                        className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
                      >
                        {t('catalogue.prev')}
                      </button>
                      <span className="text-sm text-gray-500">{draftPage} / {draftPages}</span>
                      <button
                        onClick={() => {
                          const next = Math.min(draftPages, draftPage + 1)
                          setDraftPage(next)
                          loadDrafts(next)
                        }}
                        disabled={draftPage === draftPages}
                        className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
                      >
                        {t('catalogue.next')}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'shelf' && isShelfVisible && (
            <div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-700">{t('notebook.shelfTitle')}</div>
                <div className="flex items-center gap-2">
                  <label htmlFor="shelf-sort" className="text-sm text-gray-600">
                    {t('notebook.notesSortLabel')}
                  </label>
                  <select
                    id="shelf-sort"
                    value={shelfSort}
                    onChange={(e) => {
                      setShelfPage(1)
                      setShelfSort(e.target.value as typeof shelfSort)
                    }}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="updated_desc">{t('notebook.shelfSortUpdatedDesc')}</option>
                    <option value="updated_asc">{t('notebook.shelfSortUpdatedAsc')}</option>
                    <option value="name_asc">{t('catalogue.sortNameAsc')}</option>
                    <option value="name_desc">{t('catalogue.sortNameDesc')}</option>
                  </select>
                </div>
              </div>

              {loadingShelf ? (
                <div className="text-sm text-gray-500">{t('common.loading')}</div>
              ) : shelfItems.length === 0 ? (
                <div className="text-sm text-gray-600">{t('notebook.shelfEmpty')}</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {shelfItems.map((item) => {
                      const imageSrc = normalizeImage(item.bottleImageUrl)
                      const producer =
                        item.bottlingType === 'DB' ? item.distillerName : item.bottlerName
                      const typeLine = [item.type, item.countryName].filter(Boolean).join(' • ')
                      return (
                        <Link
                          key={item.id}
                          href={`${buildWhiskyPath(locale, item.whiskyId, item.whiskyName || undefined, item.whiskySlug || undefined)}${mode === 'public' ? `?user=${summary.user.pseudo}` : ''}`}
                          className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-md transition"
                        >
                          <div className="w-full h-40 bg-white rounded-xl flex items-center justify-center overflow-hidden">
                            {imageSrc ? (
                              <img src={imageSrc} alt={item.whiskyName || ''} className="w-full h-full object-contain" />
                            ) : (
                              <div className="text-gray-400">{t('catalogue.noImage')}</div>
                            )}
                          </div>
                          <div className="mt-4 space-y-1">
                            <div className="text-base font-semibold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
                              {item.whiskyName}
                            </div>
                            {producer && <div className="text-sm text-gray-600 line-clamp-1">{producer}</div>}
                            {typeLine && <div className="text-xs text-gray-500">{typeLine}</div>}
                            <div>
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  summary?.user?.shelfVisibility === 'public'
                                    ? 'bg-gray-100 text-gray-700 border border-gray-200'
                                    : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {statusIcon(item.status)}
                                <span>{statusLabel(item.status)}</span>
                              </span>
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                  {shelfPages > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-8">
                      <button
                        onClick={() => {
                          const next = Math.max(1, shelfPage - 1)
                          setShelfPage(next)
                          loadShelf(next)
                        }}
                        disabled={shelfPage === 1}
                        className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
                      >
                        {t('catalogue.prev')}
                      </button>
                      <span className="text-sm text-gray-500">{shelfPage} / {shelfPages}</span>
                      <button
                        onClick={() => {
                          const next = Math.min(shelfPages, shelfPage + 1)
                          setShelfPage(next)
                          loadShelf(next)
                        }}
                        disabled={shelfPage === shelfPages}
                        className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
                      >
                        {t('catalogue.next')}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'followers' && !hideSocialTabs && (
            <div>
              {loadingFollowers ? (
                <div className="text-sm text-gray-500">{t('common.loading')}</div>
              ) : followers.length === 0 ? (
                <div className="text-sm text-gray-600">{t('notebook.noFollowers')}</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {followers.map((user) => {
                      const avatar = avatarForPseudo(user.pseudo)
                      return (
                        <div key={user.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div
                                className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold"
                                style={{ backgroundColor: avatar.color }}
                              >
                                {avatar.initial}
                              </div>
                              <div className="space-y-0.5">
                                <div className="text-base font-semibold text-gray-900">{user.pseudo}</div>
                                <div className="text-sm text-gray-500">
                                  {noteCountText(user.notesCount)}
                                </div>
                              </div>
                            </div>

                            {viewer?.id !== user.id && (
                              <button
                                onClick={() => toggleFollow(user.id)}
                                className="h-10 w-10 inline-flex items-center justify-center rounded-full transition"
                                aria-label={user.isFollowing ? t('notebook.followActionFollowing') : t('notebook.followActionFollow')}
                                title={user.isFollowing ? t('notebook.followActionFollowing') : t('notebook.followActionFollow')}
                                style={{
                                  backgroundColor: user.isFollowing ? 'var(--color-primary-light)' : 'var(--color-primary)',
                                  color: user.isFollowing ? 'var(--color-primary)' : '#fff',
                                }}
                              >
                                <FollowActionIcon following={user.isFollowing} />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {followersPages > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-8">
                      <button
                        onClick={() => {
                          const next = Math.max(1, followersPage - 1)
                          setFollowersPage(next)
                          loadFollowers(next)
                        }}
                        disabled={followersPage === 1}
                        className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
                      >
                        {t('catalogue.prev')}
                      </button>
                      <span className="text-sm text-gray-500">{followersPage} / {followersPages}</span>
                      <button
                        onClick={() => {
                          const next = Math.min(followersPages, followersPage + 1)
                          setFollowersPage(next)
                          loadFollowers(next)
                        }}
                        disabled={followersPage === followersPages}
                        className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
                      >
                        {t('catalogue.next')}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'following' && !hideSocialTabs && (
            <div>
              {loadingFollowing ? (
                <div className="text-sm text-gray-500">{t('common.loading')}</div>
              ) : following.length === 0 ? (
                <div className="text-sm text-gray-600">{t('notebook.noFollowing')}</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {following.map((user) => {
                      const avatar = avatarForPseudo(user.pseudo)
                      return (
                        <div key={user.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div
                                className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold"
                                style={{ backgroundColor: avatar.color }}
                              >
                                {avatar.initial}
                              </div>
                              <div className="space-y-0.5">
                                <div className="text-base font-semibold text-gray-900">{user.pseudo}</div>
                                <div className="text-sm text-gray-500">
                                  {noteCountText(user.notesCount)}
                                </div>
                              </div>
                            </div>

                            {viewer?.id !== user.id && (
                              <button
                                onClick={() => toggleFollow(user.id)}
                                className="h-10 w-10 inline-flex items-center justify-center rounded-full transition"
                                aria-label={user.isFollowing ? t('notebook.followActionFollowing') : t('notebook.followActionFollow')}
                                title={user.isFollowing ? t('notebook.followActionFollowing') : t('notebook.followActionFollow')}
                                style={{
                                  backgroundColor: user.isFollowing ? 'var(--color-primary-light)' : 'var(--color-primary)',
                                  color: user.isFollowing ? 'var(--color-primary)' : '#fff',
                                }}
                              >
                                <FollowActionIcon following={user.isFollowing} />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {followingPages > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-8">
                      <button
                        onClick={() => {
                          const next = Math.max(1, followingPage - 1)
                          setFollowingPage(next)
                          loadFollowing(next)
                        }}
                        disabled={followingPage === 1}
                        className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
                      >
                        {t('catalogue.prev')}
                      </button>
                      <span className="text-sm text-gray-500">{followingPage} / {followingPages}</span>
                      <button
                        onClick={() => {
                          const next = Math.min(followingPages, followingPage + 1)
                          setFollowingPage(next)
                          loadFollowing(next)
                        }}
                        disabled={followingPage === followingPages}
                        className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
                      >
                        {t('catalogue.next')}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'aroma' && (
            <div>
              {loadingAroma ? (
                <div className="text-sm text-gray-500">{t('common.loading')}</div>
              ) : aromaData && !aromaData.hasProfile ? (
                <div className="text-sm text-gray-600">{t('notebook.aromaEmpty')}</div>
              ) : aromaData ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                      <div className="text-3xl font-semibold text-gray-900">{aromaData.avgRating}/10</div>
                      <div className="flex items-center gap-1 text-sm text-gray-300 mt-1">
                        {Array.from({ length: 10 }).map((_, index) => {
                          const value = index + 1
                          const active = aromaData.avgRating >= value - 0.5
                          return (
                            <span
                              key={`user-aroma-star-${value}`}
                              className={active ? 'text-yellow-400' : 'text-gray-300'}
                            >
                              {active ? '★' : '☆'}
                            </span>
                          )
                        })}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">{t('notebook.aromaAvg')}</div>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                      <div className="text-3xl font-semibold text-gray-900">{aromaData.totalNotes}</div>
                      <div className="text-sm text-gray-500 mt-1">{noteCountLabel(aromaData.totalNotes)}</div>
                    </div>
                  </div>

                  {(['nose', 'palate', 'finish'] as const).map((section) => (
                    <div key={section} className="rounded-2xl border border-gray-200 bg-white p-5">
                      <div className="text-xs uppercase tracking-wide text-gray-500 mb-4">
                        {t(`tasting.${section}`)}
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                          <div className="text-sm font-semibold text-gray-800 mb-2">{t('notebook.aromaTop')}</div>
                          <div className="flex flex-wrap gap-2">
                            {(aromaData.top?.[section] || []).map((tag) => (
                              <span key={`${section}-top-${tag.name}`} className="px-3 py-1 rounded-full text-xs border border-gray-200 bg-white">
                                {tag.name} {tag.score}/10 ({tag.count})
                              </span>
                            ))}
                            {(aromaData.top?.[section] || []).length === 0 && (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-800 mb-2">{t('notebook.aromaWorst')}</div>
                          <div className="flex flex-wrap gap-2">
                            {(aromaData.worst?.[section] || []).map((tag) => (
                              <span key={`${section}-worst-${tag.name}`} className="px-3 py-1 rounded-full text-xs border border-gray-200 bg-white">
                                {tag.name} {tag.score}/10 ({tag.count})
                              </span>
                            ))}
                            {(aromaData.worst?.[section] || []).length === 0 && (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
