import { getTranslations, type Locale } from '@/lib/i18n'
import Link from 'next/link'
import { db, whiskies, distillers, bottlers, countries, whiskyAnalyticsCache, whiskyTagStats, tagLang } from '@/lib/db'
import { and, eq, sql } from 'drizzle-orm'
import TastingNotesSection from '@/components/TastingNotesSection'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function normalizeImage(url?: string | null) {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('/')) return url
  return `/${url}`
}

function formatYear(value: number | null) {
  if (typeof value !== 'number') return null
  return value > 0 ? value : null
}

export default async function WhiskyDetailPage({
  params,
  searchParams,
}: {
  params: { locale: Locale; id: string }
  searchParams: { user?: string }
}) {
  const { locale, id } = params
  const t = getTranslations(locale)
  const session = await getServerSession(authOptions)
  const isLoggedIn = Boolean(session?.user?.id)
  if (process.env.DRAMNOTES_BUILD === '1') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div
          className="px-4 md:px-8 py-4"
          style={{ backgroundColor: 'var(--color-primary-light)' }}
        >
          <div className="max-w-6xl mx-auto text-sm text-gray-600 text-center">
            <Link href={`/${locale}/catalogue`} className="hover:underline">
              {t('catalogue.title')}
            </Link>
            <span className="mx-2">›</span>
            <span className="text-gray-800">{t('whisky.title')}</span>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
            <div className="text-gray-600">{t('common.loading')}</div>
          </div>
        </div>
      </div>
    )
  }
  const filterPseudo = searchParams?.user || null

  const result = await db
    .select({
      id: whiskies.id,
      name: whiskies.name,
      bottleImageUrl: sql<string>`coalesce(${whiskies.bottleImageUrl}, ${whiskies.imageUrl})`,
      distillerName: distillers.name,
      bottlerName: bottlers.name,
      countryName: countries.name,
      countryNameFr: countries.nameFr,
      bottlingType: whiskies.bottlingType,
      barcode: whiskies.barcode,
      distilledYear: whiskies.distilledYear,
      bottledYear: whiskies.bottledYear,
      age: whiskies.age,
      caskType: whiskies.caskType,
      batchId: whiskies.batchId,
      alcoholVolume: whiskies.alcoholVolume,
      bottledFor: whiskies.bottledFor,
      region: whiskies.region,
      type: whiskies.type,
      description: whiskies.description,
    })
    .from(whiskies)
    .leftJoin(distillers, eq(whiskies.distillerId, distillers.id))
    .leftJoin(bottlers, eq(whiskies.bottlerId, bottlers.id))
    .leftJoin(countries, eq(whiskies.countryId, countries.id))
    .where(eq(whiskies.id, id))
    .limit(1)

  const whisky = result?.[0]

  if (!whisky) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <p className="text-gray-600">{t('whisky.notFound')}</p>
          <Link
            href={`/${locale}/catalogue`}
            className="inline-block mt-4 px-6 py-3 rounded-lg text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {t('whisky.backToCatalogue')}
          </Link>
        </div>
      </div>
    )
  }

  const imageSrc = normalizeImage(whisky.bottleImageUrl)
  const countryLabel =
    locale === 'fr' ? whisky.countryNameFr || whisky.countryName : whisky.countryName

  const detailItems = [
    { label: t('whisky.fieldCountry'), value: countryLabel },
    { label: t('whisky.fieldDistiller'), value: whisky.distillerName },
    { label: t('whisky.fieldBottler'), value: whisky.bottlerName },
    {
      label: t('whisky.fieldBottlingType'),
      value:
        whisky.bottlingType === 'DB'
          ? t('whisky.bottlingDB')
          : whisky.bottlingType === 'IB'
            ? t('whisky.bottlingIB')
            : whisky.bottlingType,
    },
    { label: t('whisky.fieldBarcode'), value: whisky.barcode },
    { label: t('whisky.fieldDistilledYear'), value: formatYear(whisky.distilledYear) },
    { label: t('whisky.fieldBottledYear'), value: formatYear(whisky.bottledYear) },
    { label: t('whisky.fieldAge'), value: whisky.age ? `${whisky.age}y` : null },
    { label: t('whisky.fieldAlcoholVolume'), value: whisky.alcoholVolume ? `${whisky.alcoholVolume}%` : null },
    { label: t('whisky.fieldCaskType'), value: whisky.caskType },
    { label: t('whisky.fieldBatchId'), value: whisky.batchId },
    { label: t('whisky.fieldBottledFor'), value: whisky.bottledFor },
    { label: t('whisky.fieldRegion'), value: whisky.region },
    { label: t('whisky.fieldType'), value: whisky.type },
  ].filter((item) => item.value !== null && item.value !== undefined && String(item.value).trim() !== '')

  let analyticsData: {
    avgRating: number
    totalReviews: number
    tags: { nose: { name: string; count: number }[]; palate: { name: string; count: number }[]; finish: { name: string; count: number }[] }
  } | null = null

  if (isLoggedIn) {
    const cacheRows = await db
      .select({
        avgRating: whiskyAnalyticsCache.avgRating,
        totalReviews: whiskyAnalyticsCache.totalReviews,
      })
      .from(whiskyAnalyticsCache)
      .where(eq(whiskyAnalyticsCache.whiskyId, id))
      .limit(1)

    const cache = cacheRows?.[0]
    if (cache && Number(cache.totalReviews || 0) > 0) {
      const tagRows = await db
        .select({
          section: whiskyTagStats.section,
          count: whiskyTagStats.count,
          name: tagLang.name,
        })
        .from(whiskyTagStats)
        .leftJoin(tagLang, and(eq(tagLang.tagId, whiskyTagStats.tagId), eq(tagLang.lang, locale)))
        .where(eq(whiskyTagStats.whiskyId, id))
        .orderBy(sql`${whiskyTagStats.count} desc`)

      const grouped = { nose: [] as { name: string; count: number }[], palate: [] as { name: string; count: number }[], finish: [] as { name: string; count: number }[] }
      tagRows.forEach((row) => {
        if (!row.name) return
        if (row.section === 'nose' && grouped.nose.length < 4) grouped.nose.push({ name: row.name, count: Number(row.count || 0) })
        if (row.section === 'palate' && grouped.palate.length < 4) grouped.palate.push({ name: row.name, count: Number(row.count || 0) })
        if (row.section === 'finish' && grouped.finish.length < 4) grouped.finish.push({ name: row.name, count: Number(row.count || 0) })
      })

      analyticsData = {
        avgRating: Number(cache.avgRating || 0),
        totalReviews: Number(cache.totalReviews || 0),
        tags: {
          nose: grouped.nose,
          palate: grouped.palate,
          finish: grouped.finish,
        },
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div
        className="px-4 md:px-8 py-4"
        style={{ backgroundColor: 'var(--color-primary-light)' }}
      >
        <div className="max-w-6xl mx-auto text-sm text-gray-600 text-center">
          <Link href={`/${locale}/catalogue`} className="hover:underline">
            {t('catalogue.title')}
          </Link>
          <span className="mx-2">›</span>
          <span className="text-gray-800">{whisky.name}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-10">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="w-full h-[420px] bg-white rounded-xl flex items-center justify-center overflow-hidden">
              {imageSrc ? (
                <img src={imageSrc} alt={whisky.name} className="w-full h-full object-contain" />
              ) : (
                <div className="text-gray-400">{t('catalogue.noImage')}</div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{whisky.name}</h1>
              <div className="flex flex-wrap gap-2">
                {whisky.type && (
                  <span className="px-3 py-1 rounded-full text-sm border border-gray-200 bg-white">
                    {whisky.type}
                  </span>
                )}
                {(whisky.bottlingType === 'DB' ? whisky.distillerName : whisky.bottlerName) && (
                  <span className="px-3 py-1 rounded-full text-sm border border-gray-200 bg-white">
                    {whisky.bottlingType === 'DB' ? whisky.distillerName : whisky.bottlerName}
                  </span>
                )}
                {countryLabel && (
                  <span className="px-3 py-1 rounded-full text-sm border border-gray-200 bg-white">
                    {countryLabel}
                  </span>
                )}
              </div>
              {whisky.description && (
                <p className="text-gray-600">{whisky.description}</p>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">{t('whisky.detailsTitle')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {detailItems.map((item) => (
                  <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">{item.label}</p>
                    <p className="text-sm font-medium text-gray-900 mt-1">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10">
          {isLoggedIn ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">{t('whisky.analyticsTitle')}</h2>
              {analyticsData ? (
                <>
                  <div className="flex flex-wrap items-center gap-6">
                    <div>
                      <div className="text-3xl font-semibold text-gray-900">{analyticsData.avgRating}/10</div>
                      <div className="flex items-center gap-1 text-sm text-gray-300 mt-1">
                        {Array.from({ length: 10 }).map((_, index) => {
                          const value = index + 1
                          const active = analyticsData.avgRating >= value - 0.5
                          return (
                            <span
                              key={`avg-star-${value}`}
                              className={active ? 'text-yellow-400' : 'text-gray-300'}
                            >
                              {active ? '★' : '☆'}
                            </span>
                          )
                        })}
                      </div>
                      <div className="text-sm text-gray-500">{t('whisky.analyticsAvgLabel')}</div>
                    </div>
                    <div>
                      <div className="text-3xl font-semibold text-gray-900">{analyticsData.totalReviews}</div>
                      <div className="text-sm text-gray-500">{t('whisky.analyticsReviewsLabel')}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                    {([
                      { key: 'nose', label: t('tasting.nose') },
                      { key: 'palate', label: t('tasting.palate') },
                      { key: 'finish', label: t('tasting.finish') },
                    ] as const).map((section) => (
                      <div key={section.key} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">{section.label}</div>
                        <div className="flex flex-wrap gap-2">
                          {(analyticsData.tags[section.key] || []).map((tag) => (
                            <span key={`${section.key}-${tag.name}`} className="px-3 py-1 rounded-full text-xs border border-gray-200 bg-white">
                              {tag.name} ({tag.count})
                            </span>
                          ))}
                          {(analyticsData.tags[section.key] || []).length === 0 && (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-600">{t('whisky.analyticsFirstNote')}</div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-600">{t('whisky.analyticsLogin')}</div>
          )}
        </div>

        <TastingNotesSection
          whiskyId={id}
          locale={locale}
          googleMapsApiKey={process.env.GOOGLE_MAPS_API_KEY || null}
          filterPseudo={filterPseudo}
        />
      </div>
    </div>
  )
}
