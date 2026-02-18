'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { getTranslations, type Locale } from '@/lib/i18n'

type ProducerKind = 'distiller' | 'bottler'

type ProducerItem = {
  id: string
  name: string
  slug?: string | null
  imageUrl?: string | null
  descriptionFr?: string | null
  descriptionEn?: string | null
  countryId?: string | null
  countryName?: string | null
  region?: string | null
  whiskyCount?: number
  bottleImageUrl?: string | null
  barcode?: string | null
  age?: number | null
  distilledYear?: number | null
  bottledYear?: number | null
  alcoholVolume?: number | null
  bottlingType?: string | null
  type?: string | null
  missingEan13?: boolean
  ageNotNormalized?: boolean
  missingImage?: boolean
  createdAt?: string | null
}

type Country = { id: string; name: string; nameFr?: string | null; displayName?: string | null }

export default function AdminProducersPageClient() {
  const params = useParams()
  const locale = params.locale as Locale
  const t = getTranslations(locale)
  const whiskyTypeOptions = [
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

  const [kind, setKind] = useState<ProducerKind | 'whisky'>('distiller')
  const [q, setQ] = useState('')
  const [missingDescription, setMissingDescription] = useState(false)
  const [missingImage, setMissingImage] = useState(false)
  const [missingEan13, setMissingEan13] = useState(false)
  const [ageNotNormalized, setAgeNotNormalized] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [items, setItems] = useState<ProducerItem[]>([])
  const [loading, setLoading] = useState(false)
  const [countries, setCountries] = useState<Country[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null)
  const [previewImageUrl, setPreviewImageUrl] = useState('')

  const selected = useMemo(() => items.find((x) => x.id === selectedId) || null, [items, selectedId])

  const [form, setForm] = useState({
    name: '',
    countryId: '',
    region: '',
    descriptionFr: '',
    descriptionEn: '',
    barcode: '',
    age: '',
    distilledYear: '',
    bottledYear: '',
    alcoholVolume: '',
    bottlingType: 'DB',
    type: '',
  })

  useEffect(() => {
    const loadCountries = async () => {
      const res = await fetch(`/api/countries?lang=${locale}`)
      const json = await res.json()
      setCountries(json?.countries || [])
    }
    loadCountries()
  }, [locale])

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('kind', kind)
      params.set('page', String(page))
      params.set('pageSize', '20')
      params.set('lang', locale)
      if (q.trim()) params.set('q', q.trim())
      if (missingDescription) params.set('missingDescription', '1')
      if (missingImage) params.set('missingImage', '1')
      if (missingEan13) params.set('missingEan13', '1')
      if (ageNotNormalized) params.set('ageNotNormalized', '1')
      const res = await fetch(`/api/admin/producers/list?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Error')
      setItems(json?.items || [])
      setTotalPages(json?.totalPages || 1)
      if (!selectedId && json?.items?.length) setSelectedId(json.items[0].id)
      if (selectedId && json?.items?.every((x: ProducerItem) => x.id !== selectedId)) {
        setSelectedId(json?.items?.[0]?.id || null)
      }
    } catch (e: any) {
      setMessage(e?.message || t('common.error'))
      setItems([])
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, page, missingDescription, missingImage, missingEan13, ageNotNormalized])

  useEffect(() => {
    if (!selected) return
    setPendingImageFile(null)
    setPreviewImageUrl(kind === 'whisky' ? (selected.bottleImageUrl || selected.imageUrl || '') : (selected.imageUrl || ''))
    setForm({
      name: selected.name || '',
      countryId: selected.countryId || '',
      region: selected.region || '',
      descriptionFr: selected.descriptionFr || '',
      descriptionEn: selected.descriptionEn || '',
      barcode: selected.barcode || '',
      age: selected.age == null ? '' : String(selected.age),
      distilledYear: selected.distilledYear == null ? '' : String(selected.distilledYear),
      bottledYear: selected.bottledYear == null ? '' : String(selected.bottledYear),
      alcoholVolume: selected.alcoholVolume == null ? '' : String(selected.alcoholVolume),
      bottlingType: selected.bottlingType === 'IB' ? 'IB' : 'DB',
      type: selected.type || '',
    })
  }, [selected, kind])

  const applySearch = () => {
    setPage(1)
    load()
  }

  const save = async () => {
    if (!selected) return
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch(`/api/admin/producers/${selected.id}?kind=${kind}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Error')

      if (pendingImageFile) {
        const fd = new FormData()
        fd.append('image', pendingImageFile)
        const imageRes = await fetch(`/api/admin/producers/${selected.id}/image?kind=${kind}`, {
          method: 'POST',
          body: fd,
        })
        const imageJson = await imageRes.json()
        if (!imageRes.ok) throw new Error(imageJson?.error || 'Error')
        setPendingImageFile(null)
        setPreviewImageUrl(imageJson?.imageUrl || previewImageUrl)
      }

      setMessage(t('account.addressSaved'))
      await load()
    } catch (e: any) {
      setMessage(e?.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const onUpload = (file: File) => {
    setMessage('')
    setPendingImageFile(file)
    setPreviewImageUrl(URL.createObjectURL(file))
    setMessage(t('adminProducers.imagePendingSave'))
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 md:px-8 py-10">
      <div className="max-w-7xl mx-auto space-y-5">
        <h1 className="text-3xl font-bold">{t('adminProducers.title')}</h1>

        <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => { setKind('distiller'); setPage(1); setSelectedId(null); setMissingEan13(false); setAgeNotNormalized(false) }}
            className={`px-4 py-2 rounded-full text-sm ${kind === 'distiller' ? 'text-white' : 'text-gray-600'}`}
            style={{ backgroundColor: kind === 'distiller' ? 'var(--color-primary)' : 'transparent' }}
          >
            {t('catalogue.viewDistillers')}
          </button>
          <button
            onClick={() => { setKind('bottler'); setPage(1); setSelectedId(null); setMissingEan13(false); setAgeNotNormalized(false) }}
            className={`px-4 py-2 rounded-full text-sm ${kind === 'bottler' ? 'text-white' : 'text-gray-600'}`}
            style={{ backgroundColor: kind === 'bottler' ? 'var(--color-primary)' : 'transparent' }}
          >
            {t('catalogue.viewBottlers')}
          </button>
          <button
            onClick={() => { setKind('whisky'); setPage(1); setSelectedId(null); setMissingDescription(false) }}
            className={`px-4 py-2 rounded-full text-sm ${kind === 'whisky' ? 'text-white' : 'text-gray-600'}`}
            style={{ backgroundColor: kind === 'whisky' ? 'var(--color-primary)' : 'transparent' }}
          >
            {t('catalogue.viewWhiskies')}
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2"
            placeholder={t('adminProducers.searchPlaceholder')}
          />
          {kind === 'whisky' ? (
            <>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={missingEan13} onChange={(e) => setMissingEan13(e.target.checked)} />
                {t('adminProducers.onlyMissingEan13')}
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={ageNotNormalized} onChange={(e) => setAgeNotNormalized(e.target.checked)} />
                {t('adminProducers.onlyAgeNotNormalized')}
              </label>
            </>
          ) : (
            <>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={missingDescription} onChange={(e) => setMissingDescription(e.target.checked)} />
                {t('adminProducers.onlyMissingDescription')}
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={missingImage} onChange={(e) => setMissingImage(e.target.checked)} />
                {t('adminProducers.onlyMissingImage')}
              </label>
            </>
          )}
          <button
            onClick={applySearch}
            className="px-4 py-2 rounded-xl text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {t('explorer.searchButton')}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-5">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-100">
              {loading ? (
                <div className="p-4 text-gray-600">{t('common.loading')}</div>
              ) : items.length === 0 ? (
                <div className="p-4 text-gray-600">{t('catalogue.noResults')}</div>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full text-left p-4 hover:bg-gray-50 ${selectedId === item.id ? 'bg-gray-50' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{item.name}</div>
                        {kind === 'whisky' ? (
                          <div className="text-xs text-gray-500">
                            {[item.countryName, item.region, item.type].filter(Boolean).join(' • ')}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500">
                            {[item.countryName, item.region].filter(Boolean).join(' • ')}
                          </div>
                        )}
                      </div>
                      {kind === 'whisky' ? (
                        <div className="text-xs text-gray-500">{item.createdAt ? new Date(item.createdAt).toLocaleDateString(locale) : ''}</div>
                      ) : (
                        <div className="text-xs text-gray-500">{Number(item.whiskyCount || 0)} {t('catalogue.whiskiesCount')}</div>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {kind === 'whisky' ? (
                        <>
                          {item.missingEan13 ? (
                            <span className="px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-700">{t('adminProducers.missingEan13Badge')}</span>
                          ) : null}
                          {item.ageNotNormalized ? (
                            <span className="px-2 py-0.5 rounded-full border border-sky-300 bg-sky-50 text-sky-700">{t('adminProducers.ageNotNormalizedBadge')}</span>
                          ) : null}
                          {item.missingImage ? (
                            <span className="px-2 py-0.5 rounded-full border border-rose-300 bg-rose-50 text-rose-700">{t('adminProducers.missingImageBadge')}</span>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {(!item.descriptionFr && !item.descriptionEn) ? (
                            <span className="px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-700">{t('adminProducers.missingDescriptionBadge')}</span>
                          ) : null}
                          {!item.countryId ? (
                            <span className="px-2 py-0.5 rounded-full border border-sky-300 bg-sky-50 text-sky-700">{t('adminProducers.missingCountryBadge')}</span>
                          ) : null}
                          {!item.imageUrl ? (
                            <span className="px-2 py-0.5 rounded-full border border-rose-300 bg-rose-50 text-rose-700">{t('adminProducers.missingImageBadge')}</span>
                          ) : null}
                        </>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="p-3 border-t border-gray-100 flex items-center justify-center gap-3">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-50">
                {t('catalogue.prev')}
              </button>
              <span className="text-sm">{t('catalogue.page')} {page}/{totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 border rounded disabled:opacity-50">
                {t('catalogue.next')}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
            {!selected ? (
              <div className="text-gray-600 text-sm">{t('adminProducers.selectItem')}</div>
            ) : (
              <>
                <h2 className="text-lg font-semibold">{selected.name}</h2>
                <div className="space-y-3">
                  <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2" placeholder={t('catalogue.filterName')} />
                  <select value={form.countryId} onChange={(e) => setForm((p) => ({ ...p, countryId: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2">
                    <option value="">{t('common.selectEmpty')}</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>{c.displayName || c.nameFr || c.name}</option>
                    ))}
                  </select>
                  <input value={form.region} onChange={(e) => setForm((p) => ({ ...p, region: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2" placeholder={t('catalogue.filterRegion')} />
                  {kind === 'whisky' ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input value={form.barcode} onChange={(e) => setForm((p) => ({ ...p, barcode: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2" placeholder={t('whisky.fieldBarcode')} />
                        <input value={form.age} onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2" placeholder={t('catalogue.filterAgePlaceholder')} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select value={form.bottlingType} onChange={(e) => setForm((p) => ({ ...p, bottlingType: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2">
                          <option value="DB">{t('whisky.bottlingDB')}</option>
                          <option value="IB">{t('whisky.bottlingIB')}</option>
                        </select>
                        <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2">
                          <option value="">{t('common.selectEmpty')}</option>
                          {whiskyTypeOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input value={form.distilledYear} onChange={(e) => setForm((p) => ({ ...p, distilledYear: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2" placeholder={t('whisky.fieldDistilledYear')} />
                        <input value={form.bottledYear} onChange={(e) => setForm((p) => ({ ...p, bottledYear: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2" placeholder={t('whisky.fieldBottledYear')} />
                        <input value={form.alcoholVolume} onChange={(e) => setForm((p) => ({ ...p, alcoholVolume: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2" placeholder={t('whisky.fieldAlcoholVolume')} />
                      </div>
                      <div className="text-xs text-gray-500">
                        {t('adminProducers.currentSlug')}: {selected.slug || '-'}
                      </div>
                    </>
                  ) : (
                    <>
                      <textarea value={form.descriptionFr} onChange={(e) => setForm((p) => ({ ...p, descriptionFr: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 min-h-[110px]" placeholder={t('adminProducers.descriptionFr')} />
                      <textarea value={form.descriptionEn} onChange={(e) => setForm((p) => ({ ...p, descriptionEn: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 min-h-[110px]" placeholder={t('adminProducers.descriptionEn')} />
                    </>
                  )}
                  <div className="space-y-2">
                    <input
                      key={`producer-image-${kind}-${selected.id}`}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void onUpload(file)
                      }}
                    />
                    <div className="text-xs text-gray-500">{t('adminProducers.imageSaveHint')}</div>
                    {previewImageUrl ? <img src={previewImageUrl} alt={selected.name} className="w-28 h-28 object-contain border border-gray-200 rounded-lg bg-white" /> : null}
                  </div>
                  <button onClick={save} disabled={saving} className="w-full px-4 py-2 rounded-xl text-white disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>
                    {saving ? t('common.saving') : t('account.save')}
                  </button>
                </div>
              </>
            )}
            {message ? <div className="text-sm text-gray-700">{message}</div> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
