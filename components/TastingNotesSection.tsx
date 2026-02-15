'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import TagInput from '@/components/TagInput'
import { getTranslations, type Locale } from '@/lib/i18n'
import Script from 'next/script'
import { trackEvent } from '@/lib/analytics-client'

type Note = {
  id: string
  status?: 'draft' | 'published'
  locationVisibility?: 'public_city' | 'public_precise'
  tastingDate: string
  location?: string | null
  latitude?: number | null
  longitude?: number | null
  country?: string | null
  city?: string | null
  overall?: string | null
  rating?: number | null
  pseudo?: string | null
  tags?: {
    nose: { id: string; name: string }[]
    palate: { id: string; name: string }[]
    finish: { id: string; name: string }[]
  }
}

type Tag = { id: string; name: string }

const emptyTags: { nose: Tag[]; palate: Tag[]; finish: Tag[] } = { nose: [], palate: [], finish: [] }

function buildAvatar(pseudo: string) {
  const colors = [
    '#3498db', '#2ecc71', '#e74c3c', '#f39c12',
    '#9b59b6', '#1abc9c', '#d35400', '#c0392b',
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

export default function TastingNotesSection({
  whiskyId,
  whiskyPath,
  locale,
  googleMapsApiKey,
  filterPseudo,
  notesVisibilityPublic,
}: {
  whiskyId: string
  whiskyPath?: string
  locale: Locale
  googleMapsApiKey?: string | null
  filterPseudo?: string | null
  notesVisibilityPublic?: boolean
}) {
  const t = getTranslations(locale)
  const { data: session, status } = useSession()
  const isAuthenticated = status === 'authenticated'

  const [myNote, setMyNote] = useState<Note | null>(null)
  const [myTags, setMyTags] = useState(emptyTags)
  const [editing, setEditing] = useState(false)

  const [tastingDate, setTastingDate] = useState('')
  const [location, setLocation] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [overall, setOverall] = useState('')
  const [rating, setRating] = useState(0)
  const [locationVisibility, setLocationVisibility] = useState<'public_city' | 'public_precise'>('public_city')
  const [formError, setFormError] = useState('')

  const [others, setOthers] = useState<Note[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [sort, setSort] = useState('recent')
  const [savingNote, setSavingNote] = useState(false)
  const [deletingNote, setDeletingNote] = useState(false)

  const getTastingErrorMessage = (errorCode?: string, fallback?: string) => {
    switch (errorCode) {
      case 'RATE_LIMIT':
        return t('tasting.errorRateLimit')
      case 'MISSING_REQUIRED_FIELDS':
        return t('tasting.errorMissingRequiredFields')
      case 'LOCATION_REQUIRED':
        return t('tasting.errorLocationRequired')
      case 'OVERALL_REQUIRED':
        return t('tasting.errorOverallRequired')
      case 'RATING_INVALID':
        return t('tasting.errorRatingInvalid')
      case 'TAGS_REQUIRED_ALL_SECTIONS':
        return t('tasting.errorTagsRequiredAllSections')
      case 'OVERALL_INVALID':
        return t('tasting.errorOverallInvalid')
      case 'LOCATION_INVALID':
        return t('tasting.errorLocationInvalid')
      case 'COUNTRY_INVALID':
        return t('tasting.errorCountryInvalid')
      case 'CITY_INVALID':
        return t('tasting.errorCityInvalid')
      case 'NOTE_ALREADY_EXISTS':
        return t('tasting.errorNoteAlreadyExists')
      case 'NOTE_NOT_FOUND':
        return t('tasting.errorNoteNotFound')
      case 'CANNOT_DOWNGRADE_PUBLISHED':
        return t('tasting.errorCannotDowngradePublished')
      case 'UNAUTHORIZED':
        return t('tasting.errorUnauthorized')
      default:
        return fallback || t('common.errorOccurred')
    }
  }

  const locationRef = useRef<HTMLInputElement>(null)
  const [mapsReady, setMapsReady] = useState(false)
  const autocompleteRef = useRef<any>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    const loadMy = async () => {
      const res = await fetch(`/api/tasting-notes/my?whiskyId=${whiskyId}&lang=${locale}`, { cache: 'no-store' })
      const json = await res.json()
      if (json?.note) {
        setMyNote(json.note)
        setMyTags(json.tags || emptyTags)
        setEditing((json.note.status || 'published') !== 'published')
      } else {
        setMyNote(null)
        setMyTags(emptyTags)
        setEditing(false)
      }
    }
    loadMy()
  }, [isAuthenticated, whiskyId, locale])

  useEffect(() => {
    if (!isAuthenticated) return
    const loadOthers = async () => {
      const params = new URLSearchParams({
        whiskyId,
        lang: locale,
        page: String(page),
        pageSize: '6',
        sort,
      })
      if (filterPseudo) params.set('user', filterPseudo)
      const res = await fetch(`/api/tasting-notes/public?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      setOthers(json?.items || [])
      setTotalPages(json?.totalPages || 1)
    }
    loadOthers()
  }, [isAuthenticated, whiskyId, locale, page, filterPseudo, sort])

  useEffect(() => {
    if (!myNote) return
    setTastingDate(myNote.tastingDate || '')
    setLocation(myNote.location || '')
    setLatitude(myNote.latitude || null)
    setLongitude(myNote.longitude || null)
    setCountry(myNote.country || '')
    setCity(myNote.city || '')
    setOverall(myNote.overall || '')
    setRating(myNote.rating || 0)
    setLocationVisibility(myNote.locationVisibility === 'public_precise' ? 'public_precise' : 'public_city')
  }, [myNote])

  const resetForm = () => {
    setTastingDate(new Date().toISOString().slice(0, 10))
    setLocation('')
    setLatitude(null)
    setLongitude(null)
    setCountry('')
    setCity('')
    setOverall('')
    setRating(0)
    setLocationVisibility('public_city')
    setMyTags(emptyTags)
  }

  useEffect(() => {
    if (!myNote && isAuthenticated) {
      resetForm()
    }
  }, [myNote, isAuthenticated])

  const saveNote = async (targetStatus: 'draft' | 'published') => {
    if (savingNote) return
    setFormError('')
    if (targetStatus === 'published') {
      const hasTags =
        myTags.nose.length > 0 && myTags.palate.length > 0 && myTags.finish.length > 0
      if (!tastingDate || !location || !overall || rating < 1 || !hasTags) {
        setFormError(t('tasting.validationRequired'))
        return
      }
    }
    const payload: any = {
      status: targetStatus,
      locationVisibility,
      tastingDate,
      location,
      latitude,
      longitude,
      country,
      city,
      overall,
      rating: rating || null,
      tags: myTags,
    }
    if (!myNote) payload.whiskyId = whiskyId

    setSavingNote(true)
    try {
      const isUpdate = Boolean(myNote)
      const res = await fetch(isUpdate ? `/api/tasting-notes/${myNote?.id}` : '/api/tasting-notes', {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const result = await res.json().catch(() => ({}))
        const reload = await fetch(`/api/tasting-notes/my?whiskyId=${whiskyId}&lang=${locale}`, { cache: 'no-store' })
        const json = await reload.json()
        setMyNote(json?.note || null)
        setMyTags(json?.tags || emptyTags)
        const currentStatus = (json?.note?.status || targetStatus) as 'draft' | 'published'
        setEditing(currentStatus !== 'published')
        if (targetStatus === 'draft' && result?.created) {
          trackEvent('tasting_note_draft_created', { whisky_id: whiskyId })
        }
        if (targetStatus === 'published') {
          if (!isUpdate || result?.publishedFromDraft) {
            trackEvent('tasting_note_created', { whisky_id: whiskyId })
          }
        }
        return
      }
      const errorJson = await res.json().catch(() => ({}))
      setFormError(getTastingErrorMessage(errorJson?.errorCode, errorJson?.error))
    } finally {
      setSavingNote(false)
    }
  }

  const handleDelete = async () => {
    if (!myNote) return
    if (deletingNote || savingNote) return
    if (!confirm(t('tasting.confirmDelete'))) return
    setDeletingNote(true)
    try {
      const res = await fetch(`/api/tasting-notes/${myNote.id}`, { method: 'DELETE' })
      if (res.ok) {
        if ((myNote.status || 'published') === 'draft') {
          trackEvent('tasting_note_draft_deleted', { whisky_id: whiskyId })
        } else {
          trackEvent('tasting_note_deleted', { whisky_id: whiskyId })
        }
        setMyNote(null)
        setEditing(false)
        resetForm()
      }
    } finally {
      setDeletingNote(false)
    }
  }

  const stars = useMemo(() => Array.from({ length: 10 }, (_, i) => i + 1), [])

  const renderTagChips = (tags: Tag[]) => {
    if (!tags.length) return <span className="text-gray-500">—</span>
    return (
      <div className="flex flex-wrap gap-2 mt-1">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="px-3 py-1 rounded-full text-xs border bg-white"
            style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
          >
            {tag.name}
          </span>
        ))}
      </div>
    )
  }

  useEffect(() => {
    if (!googleMapsApiKey) return
    if (typeof window === 'undefined') return

    const win = window as any

    const initAutocomplete = () => {
      if (autocompleteRef.current) return
      if (!locationRef.current) return
      if (!win.google || !win.google.maps?.places) return
      const autocomplete = new win.google.maps.places.Autocomplete(locationRef.current, {
        types: ['establishment', 'geocode'],
      })
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (!place?.geometry) return
        const name = place.name || ''
        const address = place.formatted_address || ''
        let formatted = ''
        if (name && address) {
          const lowerName = name.toLowerCase()
          const lowerAddress = address.toLowerCase()
          formatted = lowerAddress.startsWith(lowerName) ? address : `${name}, ${address}`
        } else {
          formatted = address || name
        }
        if (formatted) setLocation(formatted)
        setLatitude(place.geometry.location.lat())
        setLongitude(place.geometry.location.lng())
        const comps = place.address_components || []
        let ctry = ''
        let cityName = ''
        comps.forEach((c: any) => {
          if (c.types.includes('country')) ctry = c.long_name
          if (c.types.includes('locality') || c.types.includes('postal_town')) cityName = c.long_name
        })
        setCountry(ctry)
        setCity(cityName)
      })
      autocompleteRef.current = autocomplete
      setMapsReady(true)
    }

    if (editing) {
      autocompleteRef.current = null
    }

    initAutocomplete()

    const interval = setInterval(() => {
      if (autocompleteRef.current) return
      initAutocomplete()
    }, 300)

    return () => {
      clearInterval(interval)
    }
  }, [googleMapsApiKey, editing])

  if (!isAuthenticated) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm text-center mt-10">
        <h3 className="text-xl font-semibold">{t('tasting.loginTitle')}</h3>
        <p className="text-gray-600 mt-2">{t('tasting.loginSubtitle')}</p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={`/${locale}/login`}
            className="block w-full sm:w-auto px-6 py-3 rounded-full text-center text-white text-sm font-medium transition"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {t('navigation.signIn')}
          </Link>
          <Link
            href={`/${locale}/register`}
            className="block w-full sm:w-auto px-6 py-3 rounded-full text-center border text-sm font-medium transition"
            style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
          >
            {t('navigation.signUp')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-10 space-y-8">
      {googleMapsApiKey && (
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`}
          strategy="afterInteractive"
          onLoad={() => setMapsReady(true)}
        />
      )}

      <div className="space-y-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">{t('tasting.myNoteTitle')}</h3>
            {myNote && myNote.status !== 'draft' && !editing && (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(true)}
                  disabled={savingNote || deletingNote}
                  className="px-3 py-1.5 rounded-full border text-sm"
                  style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                >
                  {t('tasting.edit')}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={savingNote || deletingNote}
                  className="px-3 py-1.5 rounded-full border border-red-300 text-sm text-red-600"
                >
                  {deletingNote ? t('common.saving') : t('tasting.delete')}
                </button>
              </div>
            )}
          </div>
          {myNote && myNote.status !== 'draft' && !editing ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                {myNote.tastingDate} {myNote.location ? `• ${myNote.location}` : ''}
              </div>
              <div className="flex gap-1 text-yellow-500">
                {stars.map((s) => (
                  <span key={s}>{s <= (myNote.rating || 0) ? '★' : '☆'}</span>
                ))}
                <span className="text-xs text-gray-500 ml-2">({myNote.rating || 0}/10)</span>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <strong>{t('tasting.nose')}:</strong>
                  {renderTagChips(myTags.nose)}
                </div>
                <div>
                  <strong>{t('tasting.palate')}:</strong>
                  {renderTagChips(myTags.palate)}
                </div>
                <div>
                  <strong>{t('tasting.finish')}:</strong>
                  {renderTagChips(myTags.finish)}
                </div>
              </div>
              {myNote.overall && (
                <p className="text-gray-700">{myNote.overall}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {formError && (
                <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-xl px-3 py-2">
                  {formError}
                </div>
              )}
              <div className="max-w-xs">
                <label className="block text-sm font-medium text-gray-700">{t('tasting.date')}</label>
                <input
                  type="date"
                  value={tastingDate}
                  onChange={(e) => setTastingDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
                />
              </div>
              <div className={`grid grid-cols-1 gap-4 ${notesVisibilityPublic ? 'md:grid-cols-[minmax(0,1fr)_auto]' : ''}`}>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('tasting.location')}</label>
                  <input
                    ref={locationRef}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2"
                    placeholder={t('tasting.locationPlaceholder')}
                    autoComplete="off"
                    style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
                  />
                </div>
                {notesVisibilityPublic && (
                  <div className="md:min-w-[280px]">
                    <label className="block text-sm font-medium text-gray-700">{t('tasting.locationVisibilityLabel')}</label>
                    <div className="inline-flex items-center rounded-full border border-gray-200 bg-white p-1">
                      <button
                        type="button"
                        onClick={() => setLocationVisibility('public_city')}
                        className={`px-3 py-1.5 rounded-full text-sm transition ${locationVisibility === 'public_city' ? 'text-white' : 'text-gray-700'}`}
                        style={locationVisibility === 'public_city' ? { backgroundColor: 'var(--color-primary)' } : {}}
                      >
                        {t('tasting.locationVisibilityCity')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setLocationVisibility('public_precise')}
                        className={`px-3 py-1.5 rounded-full text-sm transition ${locationVisibility === 'public_precise' ? 'text-white' : 'text-gray-700'}`}
                        style={locationVisibility === 'public_precise' ? { backgroundColor: 'var(--color-primary)' } : {}}
                      >
                        {t('tasting.locationVisibilityPrecise')}
                      </button>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">{t('tasting.locationVisibilityHelp')}</div>
                  </div>
                )}
              </div>

              <TagInput
                label={t('tasting.nose')}
                value={myTags.nose}
                onChange={(tags) => setMyTags({ ...myTags, nose: tags })}
                lang={locale}
                placeholder={t('tasting.nosePlaceholder')}
                createLabel={t('tasting.createTag')}
              />
              <TagInput
                label={t('tasting.palate')}
                value={myTags.palate}
                onChange={(tags) => setMyTags({ ...myTags, palate: tags })}
                lang={locale}
                placeholder={t('tasting.palatePlaceholder')}
                createLabel={t('tasting.createTag')}
              />
              <TagInput
                label={t('tasting.finish')}
                value={myTags.finish}
                onChange={(tags) => setMyTags({ ...myTags, finish: tags })}
                lang={locale}
                placeholder={t('tasting.finishPlaceholder')}
                createLabel={t('tasting.createTag')}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700">{t('tasting.overall')}</label>
                <textarea
                  value={overall}
                  onChange={(e) => setOverall(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2"
                  placeholder={t('tasting.overallPlaceholder')}
                  style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('tasting.rating')}</label>
                <div className="flex gap-1 text-yellow-500 text-lg">
                  {stars.map((s) => (
                    <button
                      type="button"
                      key={s}
                      disabled={savingNote || deletingNote}
                      onClick={() => setRating(s)}
                      className="hover:scale-110 transition-transform"
                    >
                      {s <= rating ? '★' : '☆'}
                    </button>
                  ))}
                  <span className="text-xs text-gray-500 ml-2">({rating}/10)</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => saveNote('published')}
                  disabled={savingNote || deletingNote}
                  className="px-4 py-2 rounded-lg text-white"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {savingNote ? t('common.saving') : t('tasting.publish')}
                </button>
                <button
                  onClick={() => saveNote('draft')}
                  disabled={savingNote || deletingNote}
                  className="px-4 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                >
                  {savingNote ? t('common.saving') : t('tasting.saveDraft')}
                </button>
                {myNote && (
                  <button
                    onClick={() => {
                      if (myNote.status === 'draft') return
                      setEditing(false)
                    }}
                    disabled={savingNote || deletingNote}
                    className="px-4 py-2 rounded-lg border"
                    style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                  >
                    {t('common.cancel')}
                  </button>
                )}
                {myNote?.status === 'draft' && (
                  <button
                    onClick={handleDelete}
                    disabled={savingNote || deletingNote}
                    className="px-4 py-2 rounded-lg border border-red-300 text-sm text-red-600"
                  >
                    {deletingNote ? t('common.saving') : t('tasting.deleteDraft')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">{t('tasting.otherNotesTitle')}</h3>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">{t('tasting.sortLabel')}</label>
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value)
                  setPage(1)
                }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-light"
              >
                <option value="recent">{t('tasting.sortRecent')}</option>
                <option value="oldest">{t('tasting.sortOldest')}</option>
                <option value="ratingDesc">{t('tasting.sortRatingDesc')}</option>
                <option value="ratingAsc">{t('tasting.sortRatingAsc')}</option>
              </select>
            </div>
          </div>
          {filterPseudo && (
            <div className="mb-4 p-3 bg-gray-50 rounded-xl text-sm flex items-center justify-between">
              <span>{t('tasting.filteredBy')} {filterPseudo}</span>
              <Link href={whiskyPath || `/${locale}/whisky/${whiskyId}`} className="text-sm" style={{ color: 'var(--color-primary)' }}>
                {t('tasting.clearFilter')}
              </Link>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {others.map((note) => {
              const pseudo = note.pseudo || 'User'
              const avatar = buildAvatar(pseudo)
              return (
                <div key={note.id} className="rounded-xl p-4 bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm" style={{ backgroundColor: avatar.color }}>
                      {avatar.initial}
                    </div>
                    <div className="text-sm font-medium">{pseudo}</div>
                    <div className="text-xs text-gray-500 ml-auto">{note.tastingDate}</div>
                  </div>
                  <div className="flex gap-1 text-yellow-500 mt-2">
                    {stars.map((s) => (
                      <span key={s}>{s <= (note.rating || 0) ? '★' : '☆'}</span>
                    ))}
                    <span className="text-xs text-gray-500 ml-2">({note.rating || 0}/10)</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    {note.location || ''}
                  </div>
                  <div className="mt-2 text-sm">
                    <div>
                      <strong>{t('tasting.nose')}:</strong>
                      {renderTagChips(note.tags?.nose || [])}
                    </div>
                    <div>
                      <strong>{t('tasting.palate')}:</strong>
                      {renderTagChips(note.tags?.palate || [])}
                    </div>
                    <div>
                      <strong>{t('tasting.finish')}:</strong>
                      {renderTagChips(note.tags?.finish || [])}
                    </div>
                  </div>
                  {note.overall && <p className="text-sm text-gray-700 mt-2">{note.overall}</p>}
                </div>
              )
            })}
            {others.length === 0 && (
              <p className="text-sm text-gray-600">{t('tasting.noOtherNotes')}</p>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded border text-sm disabled:opacity-50"
              >
                {t('catalogue.prev')}
              </button>
              <span className="text-xs text-gray-500">
                {page}/{totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded border text-sm disabled:opacity-50"
              >
                {t('catalogue.next')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
