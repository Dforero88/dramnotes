import type { Metadata } from 'next'
import Link from 'next/link'
import { and, eq, or, sql } from 'drizzle-orm'
import { db, bottlers, countries, distillers, whiskies, whiskyAnalyticsCache } from '@/lib/db'
import { getTranslations, type Locale } from '@/lib/i18n'
import { buildWhiskyPath } from '@/lib/whisky-url'
import { buildBottlerPath } from '@/lib/producer-url'
import ProducerSortSelect from '@/components/ProducerSortSelect'
import { resolveCurrentSlugFromLegacy } from '@/lib/slug-redirects'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Props = {
  params: Promise<{ locale: Locale; slug: string }>
  searchParams: Promise<{ page?: string; sort?: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params
  const baseUrl = process.env.APP_URL || 'https://dramnotes.com'
  const row = await db
    .select({ name: bottlers.name, descriptionFr: bottlers.descriptionFr, descriptionEn: bottlers.descriptionEn })
    .from(bottlers)
    .where(and(or(eq(bottlers.slug, slug), eq(bottlers.id, slug)), eq(bottlers.isActive, 1), sql`${bottlers.mergedIntoId} is null`))
    .limit(1)
  const name = row?.[0]?.name || 'Bottler'
  const localizedDescription =
    locale === 'fr'
      ? row?.[0]?.descriptionFr || row?.[0]?.descriptionEn
      : row?.[0]?.descriptionEn || row?.[0]?.descriptionFr
  const description = localizedDescription || `Catalogue des whiskies embouteillés par ${name}.`
  const url = `${baseUrl}/${locale}/bottler/${slug}`
  return {
    title: `${name} · DramNotes`,
    description,
    openGraph: { title: `${name} · DramNotes`, description, url },
    alternates: { canonical: url },
  }
}

function normalizeImage(url?: string | null) {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('/')) return url
  return `/${url}`
}

export default async function BottlerPage({ params, searchParams }: Props) {
  const { locale, slug } = await params
  const { page: pageRaw, sort: sortRaw } = await searchParams
  const page = Math.max(1, Number(pageRaw || '1'))
  const sort = String(sortRaw || 'name_asc')
  const pageSize = 12
  const offset = (page - 1) * pageSize
  const t = getTranslations(locale)

  const queryParts: string[] = []
  if (pageRaw) queryParts.push(`page=${encodeURIComponent(pageRaw)}`)
  if (sortRaw) queryParts.push(`sort=${encodeURIComponent(sortRaw)}`)
  const querySuffix = queryParts.length ? `?${queryParts.join('&')}` : ''

  const headerRows = await db
    .select({
      id: bottlers.id,
      slug: bottlers.slug,
      name: bottlers.name,
      descriptionFr: bottlers.descriptionFr,
      descriptionEn: bottlers.descriptionEn,
      imageUrl: bottlers.imageUrl,
      region: bottlers.region,
      countryName: countries.name,
      countryNameFr: countries.nameFr,
    })
    .from(bottlers)
    .leftJoin(countries, eq(countries.id, bottlers.countryId))
    .where(and(or(eq(bottlers.slug, slug), eq(bottlers.id, slug)), eq(bottlers.isActive, 1), sql`${bottlers.mergedIntoId} is null`))
    .limit(1)

  const header = headerRows?.[0]
  if (!header) {
    const legacy = await resolveCurrentSlugFromLegacy('bottler', slug)
    if (legacy?.slug) {
      redirect(`${buildBottlerPath(locale, legacy.slug)}${querySuffix}`)
    }
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

  if (header.slug && slug !== header.slug) {
    redirect(`${buildBottlerPath(locale, header.slug)}${querySuffix}`)
  }

  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(whiskies)
    .where(eq(whiskies.bottlerId, header.id))
  const total = Number(countRows?.[0]?.count || 0)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const baseQuery = db
    .select({
      id: whiskies.id,
      slug: whiskies.slug,
      name: whiskies.name,
      bottleImageUrl: sql<string>`coalesce(${whiskies.bottleImageUrl}, ${whiskies.imageUrl})`,
      distillerName: distillers.name,
      bottlerName: bottlers.name,
      type: whiskies.type,
      region: whiskies.region,
      countryName: countries.name,
      countryNameFr: countries.nameFr,
      avgRating: whiskyAnalyticsCache.avgRating,
      totalReviews: whiskyAnalyticsCache.totalReviews,
    })
    .from(whiskies)
    .leftJoin(distillers, eq(whiskies.distillerId, distillers.id))
    .leftJoin(bottlers, eq(whiskies.bottlerId, bottlers.id))
    .leftJoin(countries, eq(countries.id, whiskies.countryId))
    .leftJoin(whiskyAnalyticsCache, eq(whiskyAnalyticsCache.whiskyId, whiskies.id))
    .where(eq(whiskies.bottlerId, header.id))
  const whiskyRows =
    sort === 'name_desc'
      ? await baseQuery.orderBy(sql`lower(${whiskies.name}) desc`).limit(pageSize).offset(offset)
      : sort === 'created_desc'
        ? await baseQuery.orderBy(sql`${whiskies.createdAt} desc`).limit(pageSize).offset(offset)
        : sort === 'created_asc'
          ? await baseQuery.orderBy(sql`${whiskies.createdAt} asc`).limit(pageSize).offset(offset)
          : sort === 'notes_desc'
            ? await baseQuery.orderBy(sql`coalesce(${whiskyAnalyticsCache.totalReviews}, 0) desc`, sql`lower(${whiskies.name}) asc`).limit(pageSize).offset(offset)
            : sort === 'notes_asc'
              ? await baseQuery.orderBy(sql`coalesce(${whiskyAnalyticsCache.totalReviews}, 0) asc`, sql`lower(${whiskies.name}) asc`).limit(pageSize).offset(offset)
              : sort === 'rating_desc'
                ? await baseQuery.orderBy(sql`coalesce(${whiskyAnalyticsCache.avgRating}, 0) desc`, sql`lower(${whiskies.name}) asc`).limit(pageSize).offset(offset)
                : sort === 'rating_asc'
                  ? await baseQuery.orderBy(sql`coalesce(${whiskyAnalyticsCache.avgRating}, 0) asc`, sql`lower(${whiskies.name}) asc`).limit(pageSize).offset(offset)
                  : await baseQuery.orderBy(sql`lower(${whiskies.name}) asc`).limit(pageSize).offset(offset)

  type WhiskyRow = {
    id: string
    slug: string | null
    name: string
    bottleImageUrl: string | null
    distillerName: string | null
    bottlerName: string | null
    type: string | null
    region: string | null
    countryName: string | null
    countryNameFr: string | null
    avgRating: number | null
    totalReviews: number | null
  }
  const items = (whiskyRows as WhiskyRow[]).map((row) => ({
    ...row,
    countryName: locale === 'fr' ? row.countryNameFr || row.countryName : row.countryName,
    avgRating: row.avgRating === null || row.avgRating === undefined ? null : Number(row.avgRating),
    totalReviews: row.totalReviews === null || row.totalReviews === undefined ? 0 : Number(row.totalReviews),
  }))

  const countryLabel = locale === 'fr' ? header.countryNameFr || header.countryName : header.countryName
  const localizedDescription =
    locale === 'fr'
      ? header.descriptionFr || header.descriptionEn
      : header.descriptionEn || header.descriptionFr
  const imageSrc = normalizeImage(header.imageUrl)

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
          <span>{t('catalogue.viewBottlers')}</span>
          <span className="mx-2">›</span>
          <span className="text-gray-800">{header.name}</span>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <div className="order-2 lg:order-1 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm lg:h-full flex items-center">
            <div className="w-full aspect-square rounded-xl bg-white overflow-hidden">
              {imageSrc ? (
                <div className="w-full h-full grid place-items-center">
                  <img
                    src={imageSrc}
                    alt={header.name}
                    className="block max-w-full max-h-full object-contain object-center"
                  />
                </div>
              ) : (
                <div className="w-full h-full grid place-items-center">
                  <span className="text-xs text-gray-400">{t('catalogue.noImage')}</span>
                </div>
              )}
            </div>
          </div>
          <div className="order-1 lg:order-2 min-w-0 space-y-4">
            <h1 className="text-3xl font-semibold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
              {header.name}
            </h1>
            <div className="flex flex-wrap gap-2">
              {countryLabel ? (
                <span className="px-3 py-1 rounded-full text-sm border border-gray-200 bg-white">
                  {countryLabel}
                </span>
              ) : null}
              {header.region ? (
                <span className="px-3 py-1 rounded-full text-sm border border-gray-200 bg-white">
                  {header.region}
                </span>
              ) : null}
              <span className="px-3 py-1 rounded-full text-sm border border-gray-200 bg-white">
                {total} {t('catalogue.whiskiesCount')}
              </span>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="text-lg font-semibold mb-3">{t('catalogue.producerDescriptionTitle')}</h2>
              <p className="text-sm text-gray-600 whitespace-pre-line">
                {localizedDescription || `${header.name} — ${total} ${t('catalogue.whiskiesCount')}.`}
              </p>
            </div>
          </div>
        </div>

        <ProducerSortSelect
          value={sort}
          label={t('catalogue.sortLabel')}
          options={[
            { value: 'name_asc', label: t('catalogue.sortNameAsc') },
            { value: 'name_desc', label: t('catalogue.sortNameDesc') },
            { value: 'created_desc', label: t('catalogue.sortCreatedDesc') },
            { value: 'created_asc', label: t('catalogue.sortCreatedAsc') },
            { value: 'notes_desc', label: t('catalogue.sortNotesDesc') },
            { value: 'notes_asc', label: t('catalogue.sortNotesAsc') },
            { value: 'rating_desc', label: t('catalogue.sortRatingDesc') },
            { value: 'rating_asc', label: t('catalogue.sortRatingAsc') },
          ]}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {items.map((item) => {
            const img = normalizeImage(item.bottleImageUrl)
            const details = item.distillerName || item.bottlerName || item.region || item.type || ''
            return (
              <Link
                key={item.id}
                href={buildWhiskyPath(locale, item.id, item.name, item.slug)}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow block"
              >
                <div className="w-full h-48 bg-white flex items-center justify-center">
                  {img ? (
                    <img src={img} alt={item.name} className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-gray-400">{t('catalogue.noImage')}</div>
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <h3 className="text-base font-semibold line-clamp-2">{item.name}</h3>
                  <div className="text-sm text-gray-600 line-clamp-1">{details}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {[item.type, item.countryName].filter(Boolean).join(' • ')}
                  </div>
                  {(typeof item.avgRating === 'number' || Number(item.totalReviews || 0) > 0) && (
                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      {typeof item.avgRating === 'number' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-xs font-semibold">
                          ★ {item.avgRating.toFixed(1)}/10
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {Number(item.totalReviews || 0)} {t('catalogue.notesCount')}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Link
              href={`/${locale}/bottler/${header.slug || slug}?page=${Math.max(1, page - 1)}&sort=${encodeURIComponent(sort)}`}
              className={`px-3 py-2 rounded-lg border ${page === 1 ? 'pointer-events-none opacity-50' : ''}`}
              style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
            >
              {t('catalogue.prev')}
            </Link>
            <span className="text-sm text-gray-600">
              {t('catalogue.page')} {page} / {totalPages}
            </span>
            <Link
              href={`/${locale}/bottler/${header.slug || slug}?page=${Math.min(totalPages, page + 1)}&sort=${encodeURIComponent(sort)}`}
              className={`px-3 py-2 rounded-lg border ${page >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
              style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
            >
              {t('catalogue.next')}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
