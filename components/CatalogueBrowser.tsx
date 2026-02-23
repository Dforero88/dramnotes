'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getTranslations, type Locale } from '@/lib/i18n'
import Link from 'next/link'
import TagInput from '@/components/TagInput'
import { buildWhiskyPath } from '@/lib/whisky-url'
import { buildBottlerPath, buildDistillerPath } from '@/lib/producer-url'
import { trackEvent } from '@/lib/analytics-client'

type WhiskyCard = {
  id: string
  name: string
  bottleImageUrl?: string | null
  avgRating?: number | null
  totalReviews?: number | null
  distillerName?: string | null
  bottlerName?: string | null
  countryName?: string | null
  type?: string | null
  age?: number | null
  region?: string | null
  alcoholVolume?: number | null
}

type ProducerCard = {
  id: string
  slug?: string | null
  name: string
  imageUrl?: string | null
  countryName?: string | null
  region?: string | null
  whiskyCount?: number
}

type Filters = {
  name: string
  countryId: string
  distiller: string
  bottler: string
  barcode: string
  distilledYear: string
  bottledYear: string
  age: string
  alcoholVolume: string
  ratingMin: string
  ratingMax: string
  noseTags: string
  palateTags: string
  finishTags: string
  region: string
  type: string
  bottlingType: string
  sort: string
}

type Tag = { id: string; name: string }
type ProducerKind = 'distiller' | 'bottler'
type CatalogueView = 'whiskies' | 'distillers' | 'bottlers'

const typeOptions = [
  'American whiskey',
  'Blend',
  'Blended Grain',
  'Blended Malt',
  'Bourbon',
  'Canadian Whisky',
  'Corn',
  'Rye',
  'Single Grain',
  'Single Malt',
  'Single Pot Still',
  'Spirit',
  'Tennesse',
  'Wheat',
]

const emptyFilters: Filters = {
  name: '',
  countryId: '',
  distiller: '',
  bottler: '',
  barcode: '',
  distilledYear: '',
  bottledYear: '',
  age: '',
  alcoholVolume: '',
  ratingMin: '',
  ratingMax: '',
  noseTags: '',
  palateTags: '',
  finishTags: '',
  region: '',
  type: '',
  bottlingType: '',
  sort: 'name_asc',
}

async function fetchJsonWithRetry(url: string, attempts = 2) {
  let lastError: unknown = null
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      return await res.json()
    } catch (error) {
      lastError = error
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    }
  }
  throw lastError
}

export default function CatalogueBrowser({ locale }: { locale: Locale }) {
  const t = getTranslations(locale)
  const [view, setView] = useState<CatalogueView>('whiskies')
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters)
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters)
  const [items, setItems] = useState<Array<WhiskyCard | ProducerCard>>([])
  const [totalResults, setTotalResults] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [countries, setCountries] = useState<Array<{ id: string; name: string; nameFr?: string | null; displayName?: string | null }>>([])
  const [noseTags, setNoseTags] = useState<Tag[]>([])
  const [palateTags, setPalateTags] = useState<Tag[]>([])
  const [finishTags, setFinishTags] = useState<Tag[]>([])
  const [producerSuggestions, setProducerSuggestions] = useState<{ distiller: string[]; bottler: string[] }>({
    distiller: [],
    bottler: [],
  })
  const [producerOpen, setProducerOpen] = useState<{ distiller: boolean; bottler: boolean }>({
    distiller: false,
    bottler: false,
  })
  const prevViewRef = useRef<CatalogueView | null>(null)

  const pageSize = 12

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    const includeKeys =
      view === 'whiskies'
        ? [
            'name',
            'countryId',
            'distiller',
            'bottler',
            'barcode',
            'distilledYear',
            'bottledYear',
            'age',
            'alcoholVolume',
            'ratingMin',
            'ratingMax',
            'noseTags',
            'palateTags',
            'finishTags',
            'region',
            'type',
            'bottlingType',
            'sort',
          ]
        : ['name', 'countryId', 'region', 'sort']
    includeKeys.forEach((key) => {
      const value = (appliedFilters as any)[key]
      if (value && String(value).trim() !== '') params.set(key, String(value).trim())
    })
    if (!params.has('sort')) params.set('sort', 'name_asc')
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))
    return params.toString()
  }, [appliedFilters, page, view])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const endpoint =
          view === 'whiskies'
            ? '/api/whisky/list'
            : view === 'distillers'
              ? '/api/distillers/list'
              : '/api/bottlers/list'
        const json = await fetchJsonWithRetry(`${endpoint}?lang=${locale}&${queryString}`)
        setItems(json?.items || [])
        setTotalResults(Number(json?.total || 0))
        setTotalPages(json?.totalPages || 1)
      } catch (e) {
        console.error('Erreur chargement catalogue', e)
        setItems([])
        setTotalResults(0)
        setTotalPages(1)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [queryString, locale, view])

  useEffect(() => {
    let cancelled = false
    const loadCountries = async () => {
      try {
        const json = await fetchJsonWithRetry(`/api/countries?lang=${locale}`)
        if (!cancelled) {
          setCountries(json?.countries || [])
        }
      } catch {
        if (!cancelled) {
          setCountries([])
        }
      }
    }
    loadCountries()
    return () => {
      cancelled = true
    }
  }, [locale])

  useEffect(() => {
    if (view !== 'whiskies') return
    const entries: Array<{ kind: ProducerKind; query: string }> = [
      { kind: 'distiller', query: draftFilters.distiller.trim() },
      { kind: 'bottler', query: draftFilters.bottler.trim() },
    ]

    const controllers = entries.map(() => new AbortController())
    const timers = entries.map(({ kind, query }, idx) =>
      setTimeout(async () => {
        if (query.length < 2) {
          setProducerSuggestions((prev) => ({ ...prev, [kind]: [] }))
          return
        }
        try {
          const res = await fetch(
            `/api/producers/suggest?kind=${kind}&q=${encodeURIComponent(query)}&limit=8`,
            { signal: controllers[idx].signal }
          )
          const json = await res.json()
          setProducerSuggestions((prev) => ({ ...prev, [kind]: json?.items || [] }))
        } catch (_e) {
          // ignore abort/network and keep UX responsive
        }
      }, 250)
    )

    return () => {
      timers.forEach((t) => clearTimeout(t))
      controllers.forEach((c) => c.abort())
    }
  }, [draftFilters.distiller, draftFilters.bottler, view])

  const applyFilters = () => {
    const filterEntries: Array<[string, string]> =
      view === 'whiskies'
        ? [
            ['name', draftFilters.name],
            ['countryId', draftFilters.countryId],
            ['distiller', draftFilters.distiller],
            ['bottler', draftFilters.bottler],
            ['barcode', draftFilters.barcode],
            ['distilledYear', draftFilters.distilledYear],
            ['bottledYear', draftFilters.bottledYear],
            ['age', draftFilters.age],
            ['alcoholVolume', draftFilters.alcoholVolume],
            ['ratingMin', draftFilters.ratingMin],
            ['ratingMax', draftFilters.ratingMax],
            ['region', draftFilters.region],
            ['type', draftFilters.type],
            ['bottlingType', draftFilters.bottlingType],
            ['noseTags', noseTags.map((tag) => tag.id).join(',')],
            ['palateTags', palateTags.map((tag) => tag.id).join(',')],
            ['finishTags', finishTags.map((tag) => tag.id).join(',')],
          ]
        : [
            ['name', draftFilters.name],
            ['countryId', draftFilters.countryId],
            ['region', draftFilters.region],
          ]
    const activeFilterTypes = filterEntries
      .filter(([, value]) => String(value || '').trim() !== '')
      .map(([key]) => key)

    trackEvent('search_performed', {
      query_length: draftFilters.name.trim().length,
      filters_count: activeFilterTypes.length,
      filter_types: activeFilterTypes.join(','),
      source_context: 'catalogue',
      search_view: view,
    })

    setAppliedFilters((prev) => ({
      ...prev,
      ...draftFilters,
      noseTags: view === 'whiskies' ? noseTags.map((t) => t.id).join(',') : '',
      palateTags: view === 'whiskies' ? palateTags.map((t) => t.id).join(',') : '',
      finishTags: view === 'whiskies' ? finishTags.map((t) => t.id).join(',') : '',
    }))
    setPage(1)
    setFiltersOpen(false)
  }

  const resetFilters = () => {
    setDraftFilters(emptyFilters)
    setAppliedFilters(emptyFilters)
    setNoseTags([])
    setPalateTags([])
    setFinishTags([])
    setPage(1)
    setFiltersOpen(false)
  }

  useEffect(() => {
    setPage(1)
    setDraftFilters((prev) => {
      const whiskySorts = new Set(['name_asc', 'name_desc', 'created_desc', 'created_asc', 'notes_desc', 'notes_asc', 'rating_desc', 'rating_asc'])
      const producerSorts = new Set(['name_asc', 'name_desc', 'count_desc', 'count_asc'])
      const nextSort = view === 'whiskies'
        ? (whiskySorts.has(prev.sort) ? prev.sort : 'name_asc')
        : (producerSorts.has(prev.sort) ? prev.sort : 'name_asc')
      if (nextSort === prev.sort) return prev
      return { ...prev, sort: nextSort }
    })
    setAppliedFilters((prev) => {
      const whiskySorts = new Set(['name_asc', 'name_desc', 'created_desc', 'created_asc', 'notes_desc', 'notes_asc', 'rating_desc', 'rating_asc'])
      const producerSorts = new Set(['name_asc', 'name_desc', 'count_desc', 'count_asc'])
      const nextSort = view === 'whiskies'
        ? (whiskySorts.has(prev.sort) ? prev.sort : 'name_asc')
        : (producerSorts.has(prev.sort) ? prev.sort : 'name_asc')
      if (nextSort === prev.sort) return prev
      return { ...prev, sort: nextSort }
    })
  }, [view])

  useEffect(() => {
    const previousView = prevViewRef.current
    trackEvent('catalogue_view_selected', {
      source_context: 'catalogue',
      selected_view: view,
      previous_view: previousView || '',
      trigger: previousView ? 'toggle_click' : 'page_load',
    })
    prevViewRef.current = view
  }, [view])

  const renderFilters = (isMobile = false) => (
    view !== 'whiskies' ? (
      <div className={isMobile ? 'space-y-4' : 'space-y-5'}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('catalogue.filtersTitle')}</h2>
          {!isMobile && (
            <button
              onClick={resetFilters}
              className="text-sm"
              style={{ color: 'var(--color-primary)' }}
            >
              {t('catalogue.resetFilters')}
            </button>
          )}
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {view === 'distillers' ? t('catalogue.filterDistiller') : t('catalogue.filterBottler')}
            </label>
            <input
              value={draftFilters.name}
              onChange={(e) => setDraftFilters({ ...draftFilters, name: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2"
              placeholder={
                view === 'distillers'
                  ? t('catalogue.filterDistillerPlaceholder')
                  : t('catalogue.filterBottlerPlaceholder')
              }
              style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterCountry')}</label>
            <select
              value={draftFilters.countryId}
              onChange={(e) => setDraftFilters({ ...draftFilters, countryId: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
            >
              <option value="">{t('common.selectEmpty')}</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>{c.displayName || c.nameFr || c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterRegion')}</label>
            <input
              value={draftFilters.region}
              onChange={(e) => setDraftFilters({ ...draftFilters, region: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2"
              placeholder={t('catalogue.filterRegionPlaceholder')}
              style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
            />
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={applyFilters}
            className="px-4 py-2 text-white rounded-lg flex-1"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {t('catalogue.applyFilters')}
          </button>
        </div>
      </div>
    ) : (
    <div className={isMobile ? 'space-y-4' : 'space-y-5'}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('catalogue.filtersTitle')}</h2>
        {!isMobile && (
          <button
            onClick={resetFilters}
            className="text-sm"
            style={{ color: 'var(--color-primary)' }}
          >
            {t('catalogue.resetFilters')}
          </button>
        )}
      </div>
      <div className="space-y-5">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterName')}</label>
            <input
              value={draftFilters.name}
              onChange={(e) => setDraftFilters({ ...draftFilters, name: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2"
              placeholder={t('catalogue.filterNamePlaceholder')}
              style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterType')}</label>
            <select
              value={draftFilters.type}
              onChange={(e) => setDraftFilters({ ...draftFilters, type: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
            >
              <option value="">{t('common.selectEmpty')}</option>
              {typeOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterBottlingType')}</label>
            <select
              value={draftFilters.bottlingType}
              onChange={(e) => setDraftFilters({ ...draftFilters, bottlingType: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
            >
              <option value="">{t('common.selectEmpty')}</option>
              <option value="DB">{t('whisky.bottlingDB')}</option>
              <option value="IB">{t('whisky.bottlingIB')}</option>
            </select>
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterDistiller')}</label>
            <input
              value={draftFilters.distiller}
              onFocus={() => setProducerOpen((prev) => ({ ...prev, distiller: true }))}
              onBlur={() => setTimeout(() => setProducerOpen((prev) => ({ ...prev, distiller: false })), 120)}
              onChange={(e) => {
                setDraftFilters({ ...draftFilters, distiller: e.target.value })
                setProducerOpen((prev) => ({ ...prev, distiller: true }))
              }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2"
              placeholder={t('catalogue.filterDistillerPlaceholder')}
              style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
            />
            {producerOpen.distiller && producerSuggestions.distiller.length > 0 ? (
              <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                {producerSuggestions.distiller.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setDraftFilters((prev) => ({ ...prev, distiller: name }))
                      setProducerOpen((prev) => ({ ...prev, distiller: false }))
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {draftFilters.bottlingType !== 'DB' ? (
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterBottler')}</label>
              <input
                value={draftFilters.bottler}
                onFocus={() => setProducerOpen((prev) => ({ ...prev, bottler: true }))}
                onBlur={() => setTimeout(() => setProducerOpen((prev) => ({ ...prev, bottler: false })), 120)}
                onChange={(e) => {
                  setDraftFilters({ ...draftFilters, bottler: e.target.value })
                  setProducerOpen((prev) => ({ ...prev, bottler: true }))
                }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2"
                placeholder={t('catalogue.filterBottlerPlaceholder')}
                style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
              />
              {producerOpen.bottler && producerSuggestions.bottler.length > 0 ? (
                <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                  {producerSuggestions.bottler.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setDraftFilters((prev) => ({ ...prev, bottler: name }))
                        setProducerOpen((prev) => ({ ...prev, bottler: false }))
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterCountry')}</label>
            <select
              value={draftFilters.countryId}
              onChange={(e) => setDraftFilters({ ...draftFilters, countryId: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
            >
              <option value="">{t('common.selectEmpty')}</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>{c.displayName || c.nameFr || c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterRegion')}</label>
            <input
              value={draftFilters.region}
              onChange={(e) => setDraftFilters({ ...draftFilters, region: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2"
              placeholder={t('catalogue.filterRegionPlaceholder')}
              style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterBarcode')}</label>
            <input
              value={draftFilters.barcode}
              onChange={(e) => setDraftFilters({ ...draftFilters, barcode: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2"
              placeholder={t('catalogue.filterBarcodePlaceholder')}
              style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterDistilledYear')}</label>
              <input
                value={draftFilters.distilledYear}
                onChange={(e) => setDraftFilters({ ...draftFilters, distilledYear: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2"
                placeholder={t('catalogue.filterDistilledYearPlaceholder')}
                style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterBottledYear')}</label>
              <input
                value={draftFilters.bottledYear}
                onChange={(e) => setDraftFilters({ ...draftFilters, bottledYear: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2"
                placeholder={t('catalogue.filterBottledYearPlaceholder')}
                style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterAge')}</label>
              <input
                value={draftFilters.age}
                onChange={(e) => setDraftFilters({ ...draftFilters, age: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2"
                placeholder={t('catalogue.filterAgePlaceholder')}
                style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterAlcohol')}</label>
              <input
                value={draftFilters.alcoholVolume}
                onChange={(e) => setDraftFilters({ ...draftFilters, alcoholVolume: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2"
                placeholder={t('catalogue.filterAlcoholPlaceholder')}
                style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterRatingMin')}</label>
              <input
                value={draftFilters.ratingMin}
                onChange={(e) => setDraftFilters({ ...draftFilters, ratingMin: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2"
                placeholder={t('catalogue.filterRatingMinPlaceholder')}
                style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterRatingMax')}</label>
              <input
                value={draftFilters.ratingMax}
                onChange={(e) => setDraftFilters({ ...draftFilters, ratingMax: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2"
                placeholder={t('catalogue.filterRatingMaxPlaceholder')}
                style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
              />
            </div>
          </div>
          <TagInput
            label={t('catalogue.filterNoseTags')}
            value={noseTags}
            onChange={setNoseTags}
            lang={locale}
            placeholder={t('catalogue.filterNoseTagsPlaceholder')}
            createLabel={t('tasting.createTag')}
            allowCreate={false}
          />
          <TagInput
            label={t('catalogue.filterPalateTags')}
            value={palateTags}
            onChange={setPalateTags}
            lang={locale}
            placeholder={t('catalogue.filterPalateTagsPlaceholder')}
            createLabel={t('tasting.createTag')}
            allowCreate={false}
          />
          <TagInput
            label={t('catalogue.filterFinishTags')}
            value={finishTags}
            onChange={setFinishTags}
            lang={locale}
            placeholder={t('catalogue.filterFinishTagsPlaceholder')}
            createLabel={t('tasting.createTag')}
            allowCreate={false}
          />
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={applyFilters}
          className="px-4 py-2 text-white rounded-lg flex-1"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {t('catalogue.applyFilters')}
        </button>
      </div>
    </div>
    )
  )

  return (
    <div className="px-4 md:px-8 pt-8 pb-0">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">{t('catalogue.title')}</h1>
          <button
            onClick={() => setFiltersOpen(true)}
            className="lg:hidden px-4 py-2 border rounded-lg"
            style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
          >
            {t('catalogue.openFilters')}
          </button>
        </div>

        <div className="mb-6 inline-flex rounded-full border border-gray-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => setView('whiskies')}
            className={`px-4 py-2 rounded-full text-sm ${view === 'whiskies' ? 'text-white' : 'text-gray-600'}`}
            style={{ backgroundColor: view === 'whiskies' ? 'var(--color-primary)' : 'transparent' }}
          >
            {t('catalogue.viewWhiskies')}
          </button>
          <button
            onClick={() => setView('distillers')}
            className={`px-4 py-2 rounded-full text-sm ${view === 'distillers' ? 'text-white' : 'text-gray-600'}`}
            style={{ backgroundColor: view === 'distillers' ? 'var(--color-primary)' : 'transparent' }}
          >
            {t('catalogue.viewDistillers')}
          </button>
          <button
            onClick={() => setView('bottlers')}
            className={`px-4 py-2 rounded-full text-sm ${view === 'bottlers' ? 'text-white' : 'text-gray-600'}`}
            style={{ backgroundColor: view === 'bottlers' ? 'var(--color-primary)' : 'transparent' }}
          >
            {t('catalogue.viewBottlers')}
          </button>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        <aside className="hidden lg:block bg-white rounded-2xl border border-gray-200 p-6 h-fit shadow-sm">
          {renderFilters()}
        </aside>

        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-500">
              {!loading
                ? `${totalResults} ${totalResults <= 1 ? t('catalogue.resultsCountSingular') : t('catalogue.resultsCountPlural')}`
                : ''}
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:block text-sm font-semibold text-gray-700">{t('catalogue.sortLabel')}</div>
              <select
                value={draftFilters.sort}
                onChange={(e) => {
                  const value = e.target.value
                  setDraftFilters({ ...draftFilters, sort: value })
                  setAppliedFilters((prev) => ({ ...prev, sort: value }))
                  setPage(1)
                }}
                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm"
                style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
              >
                <option value="name_asc">{t('catalogue.sortNameAsc')}</option>
                <option value="name_desc">{t('catalogue.sortNameDesc')}</option>
                {view === 'whiskies' ? (
                  <>
                    <option value="created_desc">{t('catalogue.sortCreatedDesc')}</option>
                    <option value="created_asc">{t('catalogue.sortCreatedAsc')}</option>
                    <option value="notes_desc">{t('catalogue.sortNotesDesc')}</option>
                    <option value="notes_asc">{t('catalogue.sortNotesAsc')}</option>
                    <option value="rating_desc">{t('catalogue.sortRatingDesc')}</option>
                    <option value="rating_asc">{t('catalogue.sortRatingAsc')}</option>
                  </>
                ) : (
                  <>
                    <option value="count_desc">{t('catalogue.sortWhiskiesCountDesc')}</option>
                    <option value="count_asc">{t('catalogue.sortWhiskiesCountAsc')}</option>
                  </>
                )}
              </select>
            </div>
          </div>
          {loading && (
            <div className="p-6 bg-white rounded-xl border border-gray-200 text-center">
              {t('catalogue.loading')}
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="p-6 bg-white rounded-xl border border-gray-200 text-center text-gray-600">
              {t('catalogue.noResults')}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {view === 'whiskies' && items.map((item) => {
              const whisky = item as WhiskyCard
              const imageSrc =
                typeof whisky.bottleImageUrl === 'string' && whisky.bottleImageUrl.trim() !== ''
                  ? whisky.bottleImageUrl.startsWith('http') || whisky.bottleImageUrl.startsWith('/')
                    ? whisky.bottleImageUrl
                    : `/${whisky.bottleImageUrl}`
                  : ''

              return (
                <Link
                  key={whisky.id}
                  href={buildWhiskyPath(locale, whisky.id, whisky.name)}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow block"
                >
                  <div className="w-full h-48 bg-white flex items-center justify-center">
                    {imageSrc ? (
                      <img
                        src={imageSrc}
                        alt={whisky.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        {t('catalogue.noImage')}
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <h3 className="text-base font-semibold line-clamp-2">{whisky.name}</h3>
                    <div className="text-sm text-gray-600 line-clamp-1">
                      {whisky.distillerName || whisky.bottlerName || whisky.region || whisky.type || ''}
                    </div>
                    <div className="text-xs text-gray-500">
                      {[whisky.type, whisky.countryName].filter(Boolean).join(' • ')}
                    </div>
                    {(typeof whisky.avgRating === 'number' || Number(whisky.totalReviews || 0) > 0) && (
                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        {typeof whisky.avgRating === 'number' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-xs font-semibold">
                            ★ {whisky.avgRating.toFixed(1)}/10
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {Number(whisky.totalReviews || 0)} {Number(whisky.totalReviews || 0) === 1 ? t('catalogue.noteCountSingular') : t('catalogue.noteCountPlural')}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
            {view !== 'whiskies' && items.map((item) => {
              const producer = item as ProducerCard
              const imageSrc =
                typeof producer.imageUrl === 'string' && producer.imageUrl.trim() !== ''
                  ? producer.imageUrl.startsWith('http') || producer.imageUrl.startsWith('/')
                    ? producer.imageUrl
                    : `/${producer.imageUrl}`
                  : ''
              const href = view === 'distillers'
                ? buildDistillerPath(locale, producer.slug || producer.id)
                : buildBottlerPath(locale, producer.slug || producer.id)
              return (
                <Link
                  key={`${view}-${producer.id}`}
                  href={href}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow block"
                >
                  <div className="w-full h-48 bg-white flex items-center justify-center">
                    {imageSrc ? (
                      <img src={imageSrc} alt={producer.name} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        {t('catalogue.noImage')}
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <h3 className="text-base font-semibold line-clamp-2">{producer.name}</h3>
                    <div className="text-xs text-gray-500">
                      {[producer.countryName, producer.region].filter(Boolean).join(' • ')}
                    </div>
                    <div className="pt-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-xs font-semibold">
                        {Number(producer.whiskyCount || 0)} {Number(producer.whiskyCount || 0) === 1 ? t('catalogue.whiskyCountSingular') : t('catalogue.whiskyCountPlural')}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 rounded-lg border disabled:opacity-50"
                style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
              >
                {t('catalogue.prev')}
              </button>
              <span className="text-sm text-gray-600">
                {t('catalogue.page')} {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 rounded-lg border disabled:opacity-50"
                style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
              >
                {t('catalogue.next')}
              </button>
            </div>
          )}
        </section>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end lg:hidden">
          <div className="bg-white w-full rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{t('catalogue.filtersTitle')}</h2>
              <button onClick={() => setFiltersOpen(false)} className="text-gray-500">
                {t('common.cancel')}
              </button>
            </div>
            {renderFilters(true)}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
