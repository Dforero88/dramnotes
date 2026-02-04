import { getTranslations, type Locale } from '@/lib/i18n'
import Link from 'next/link'
import { db, whiskies, distillers, bottlers, countries } from '@/lib/db'
import { eq, sql } from 'drizzle-orm'

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
}: {
  params: { locale: Locale; id: string }
}) {
  const { locale, id } = params
  const t = getTranslations(locale)

  const result = await db
    .select({
      id: whiskies.id,
      name: whiskies.name,
      bottleImageUrl: sql<string>`coalesce(${whiskies.bottleImageUrl}, ${whiskies.imageUrl})`,
      distillerName: distillers.name,
      bottlerName: bottlers.name,
      countryName: countries.name,
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

  const detailItems = [
    { label: t('whisky.fieldCountry'), value: whisky.countryName },
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
            <div className="w-full h-[420px] bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden">
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
                {whisky.countryName && (
                  <span className="px-3 py-1 rounded-full text-sm border border-gray-200 bg-white">
                    {whisky.countryName}
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
      </div>
    </div>
  )
}
