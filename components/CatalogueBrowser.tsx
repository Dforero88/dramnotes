'use client'

import { useEffect, useMemo, useState } from 'react'
import { getTranslations, type Locale } from '@/lib/i18n'

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
  distiller: string
  bottler: string
  barcode: string
  distilledYear: string
  bottledYear: string
  age: string
  alcoholVolume: string
  region: string
  type: string
}

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
  distiller: '',
  bottler: '',
  barcode: '',
  distilledYear: '',
  bottledYear: '',
  age: '',
  alcoholVolume: '',
  region: '',
  type: '',
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

  const pageSize = 12

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value && String(value).trim() !== '') {
        params.set(key, String(value).trim())
      }
    })
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))
    return params.toString()
  }, [appliedFilters, page])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/whisky/list?${queryString}`)
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

  const applyFilters = () => {
    setAppliedFilters({ ...draftFilters })
    setPage(1)
    setFiltersOpen(false)
  }

  const resetFilters = () => {
    setDraftFilters(emptyFilters)
    setAppliedFilters(emptyFilters)
    setPage(1)
    setFiltersOpen(false)
  }

  const renderFilters = (isMobile = false) => (
    <div className={isMobile ? 'space-y-4' : 'space-y-4'}>
      <h2 className="text-lg font-semibold">{t('catalogue.filtersTitle')}</h2>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterName')}</label>
          <input
            value={draftFilters.name}
            onChange={(e) => setDraftFilters({ ...draftFilters, name: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
            placeholder={t('catalogue.filterNamePlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterDistiller')}</label>
          <input
            value={draftFilters.distiller}
            onChange={(e) => setDraftFilters({ ...draftFilters, distiller: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
            placeholder={t('catalogue.filterDistillerPlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterBottler')}</label>
          <input
            value={draftFilters.bottler}
            onChange={(e) => setDraftFilters({ ...draftFilters, bottler: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
            placeholder={t('catalogue.filterBottlerPlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterBarcode')}</label>
          <input
            value={draftFilters.barcode}
            onChange={(e) => setDraftFilters({ ...draftFilters, barcode: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
            placeholder={t('catalogue.filterBarcodePlaceholder')}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterDistilledYear')}</label>
            <input
              value={draftFilters.distilledYear}
              onChange={(e) => setDraftFilters({ ...draftFilters, distilledYear: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="YYYY"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterBottledYear')}</label>
            <input
              value={draftFilters.bottledYear}
              onChange={(e) => setDraftFilters({ ...draftFilters, bottledYear: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="YYYY"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterAge')}</label>
            <input
              value={draftFilters.age}
              onChange={(e) => setDraftFilters({ ...draftFilters, age: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              placeholder={t('catalogue.filterAgePlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterAlcohol')}</label>
            <input
              value={draftFilters.alcoholVolume}
              onChange={(e) => setDraftFilters({ ...draftFilters, alcoholVolume: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              placeholder={t('catalogue.filterAlcoholPlaceholder')}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterRegion')}</label>
          <input
            value={draftFilters.region}
            onChange={(e) => setDraftFilters({ ...draftFilters, region: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
            placeholder={t('catalogue.filterRegionPlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">{t('catalogue.filterType')}</label>
          <select
            value={draftFilters.type}
            onChange={(e) => setDraftFilters({ ...draftFilters, type: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">{t('common.selectEmpty')}</option>
            {typeOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
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
        <button
          onClick={resetFilters}
          className="px-4 py-2 rounded-lg border flex-1"
          style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
        >
          {t('catalogue.resetFilters')}
        </button>
      </div>
    </div>
  )

  return (
    <div className="px-4 md:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{t('catalogue.title')}</h1>
        <button
          onClick={() => setFiltersOpen(true)}
          className="md:hidden px-4 py-2 border rounded-lg"
          style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
        >
          {t('catalogue.openFilters')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
        <aside className="hidden md:block bg-white rounded-xl border border-gray-200 p-5 h-fit">
          {renderFilters()}
        </aside>

        <section>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="w-full aspect-[3/4] bg-gray-100">
                  {item.bottleImageUrl ? (
                    <img
                      src={item.bottleImageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      {t('catalogue.noImage')}
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-1">
                  <h3 className="text-lg font-semibold">{item.name}</h3>
                  <div className="text-sm text-gray-600">
                    {item.distillerName || item.bottlerName || item.region || item.type || ''}
                  </div>
                  <div className="text-xs text-gray-500">
                    {[item.countryName, item.age ? `${item.age}y` : null, item.alcoholVolume ? `${item.alcoholVolume}%` : null]
                      .filter(Boolean)
                      .join(' • ')}
                  </div>
                </div>
              </div>
            ))}
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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:hidden">
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
  )
}
