'use client'

import { useEffect, useMemo, useState } from 'react'
import { getTranslations, type Locale } from '@/lib/i18n'
import Link from 'next/link'
import TagInput from '@/components/TagInput'

type WhiskyCard = {
  id: string
  name: string
  bottleImageUrl?: string | null
  distillerName?: string | null
  bottlerName?: string | null
  countryName?: string | null
  type?: string | null
  age?: number | null
  region?: string | null
  alcoholVolume?: number | null
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

export default function CatalogueBrowser({ locale }: { locale: Locale }) {
  const t = getTranslations(locale)
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters)
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters)
  const [items, setItems] = useState<WhiskyCard[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [countries, setCountries] = useState<Array<{ id: string; name: string; nameFr?: string | null; displayName?: string | null }>>([])
  const [noseTags, setNoseTags] = useState<Tag[]>([])
  const [palateTags, setPalateTags] = useState<Tag[]>([])
  const [finishTags, setFinishTags] = useState<Tag[]>([])

  const pageSize = 12

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value && String(value).trim() !== '') {
        params.set(key, String(value).trim())
      }
    })
    if (!params.has('sort')) params.set('sort', 'name_asc')
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))
    return params.toString()
  }, [appliedFilters, page])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/whisky/list?lang=${locale}&${queryString}`)
        const json = await res.json()
        setItems(json?.items || [])
        setTotalPages(json?.totalPages || 1)
      } catch (e) {
        console.error('Erreur chargement catalogue', e)
        setItems([])
        setTotalPages(1)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [queryString])

  useEffect(() => {
    const loadCountries = async () => {
      try {
        const res = await fetch(`/api/countries?lang=${locale}`)
        const json = await res.json()
        setCountries(json?.countries || [])
      } catch (e) {
        console.error('Erreur load countries', e)
      }
    }
    loadCountries()
  }, [])

  const applyFilters = () => {
    setAppliedFilters({
      ...draftFilters,
      noseTags: noseTags.map((t) => t.id).join(','),
      palateTags: palateTags.map((t) => t.id).join(','),
      finishTags: finishTags.map((t) => t.id).join(','),
    })
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

  const renderFilters = (isMobile = false) => (
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
        <div>
          <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterDistiller')}</label>
          <input
            value={draftFilters.distiller}
            onChange={(e) => setDraftFilters({ ...draftFilters, distiller: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2"
            placeholder={t('catalogue.filterDistillerPlaceholder')}
            style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterBottler')}</label>
          <input
            value={draftFilters.bottler}
            onChange={(e) => setDraftFilters({ ...draftFilters, bottler: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2"
            placeholder={t('catalogue.filterBottlerPlaceholder')}
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
  )

  return (
    <div className="px-4 md:px-8 py-8">
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

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        <aside className="hidden lg:block bg-white rounded-2xl border border-gray-200 p-6 h-fit shadow-sm">
          {renderFilters()}
        </aside>

        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold text-gray-700">{t('catalogue.sortLabel')}</div>
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
              <option value="created_desc">{t('catalogue.sortCreatedDesc')}</option>
              <option value="created_asc">{t('catalogue.sortCreatedAsc')}</option>
              <option value="notes_desc">{t('catalogue.sortNotesDesc')}</option>
              <option value="notes_asc">{t('catalogue.sortNotesAsc')}</option>
              <option value="rating_desc">{t('catalogue.sortRatingDesc')}</option>
              <option value="rating_asc">{t('catalogue.sortRatingAsc')}</option>
            </select>
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
            {items.map((item) => {
              const imageSrc =
                typeof item.bottleImageUrl === 'string' && item.bottleImageUrl.trim() !== ''
                  ? item.bottleImageUrl.startsWith('http') || item.bottleImageUrl.startsWith('/')
                    ? item.bottleImageUrl
                    : `/${item.bottleImageUrl}`
                  : ''

              return (
                <Link
                  key={item.id}
                  href={`/${locale}/whisky/${item.id}`}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow block"
                >
                  <div className="w-full h-48 bg-white flex items-center justify-center">
                    {imageSrc ? (
                      <img
                        src={imageSrc}
                        alt={item.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        {t('catalogue.noImage')}
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <h3 className="text-base font-semibold line-clamp-2">{item.name}</h3>
                    <div className="text-sm text-gray-600 line-clamp-1">
                      {item.distillerName || item.bottlerName || item.region || item.type || ''}
                    </div>
                    <div className="text-xs text-gray-500">
                      {[item.type, item.countryName].filter(Boolean).join(' • ')}
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
