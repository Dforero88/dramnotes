import type { Metadata } from 'next'
import Link from 'next/link'
import { eq, or, sql } from 'drizzle-orm'
import { db, countries, distillers, whiskies } from '@/lib/db'
import { getTranslations, type Locale } from '@/lib/i18n'
import { buildWhiskyPath } from '@/lib/whisky-url'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Props = {
  params: Promise<{ locale: Locale; slug: string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params
  const baseUrl = process.env.APP_URL || 'https://dramnotes.com'
  const row = await db
    .select({ name: distillers.name, descriptionFr: distillers.descriptionFr, descriptionEn: distillers.descriptionEn })
    .from(distillers)
    .where(or(eq(distillers.slug, slug), eq(distillers.id, slug)))
    .limit(1)
  const name = row?.[0]?.name || 'Distiller'
  const localizedDescription =
    locale === 'fr'
      ? row?.[0]?.descriptionFr || row?.[0]?.descriptionEn
      : row?.[0]?.descriptionEn || row?.[0]?.descriptionFr
  const description = localizedDescription || `Catalogue des whiskies du distiller ${name}.`
  const url = `${baseUrl}/${locale}/distiller/${slug}`
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

export default async function DistillerPage({ params, searchParams }: Props) {
  const { locale, slug } = await params
  const { page: pageRaw } = await searchParams
  const page = Math.max(1, Number(pageRaw || '1'))
  const pageSize = 12
  const offset = (page - 1) * pageSize
  const t = getTranslations(locale)

  const headerRows = await db
    .select({
      id: distillers.id,
      slug: distillers.slug,
      name: distillers.name,
      descriptionFr: distillers.descriptionFr,
      descriptionEn: distillers.descriptionEn,
      imageUrl: distillers.imageUrl,
      region: distillers.region,
      countryName: countries.name,
      countryNameFr: countries.nameFr,
    })
    .from(distillers)
    .leftJoin(countries, eq(countries.id, distillers.countryId))
    .where(or(eq(distillers.slug, slug), eq(distillers.id, slug)))
    .limit(1)

  const header = headerRows?.[0]
  if (!header) {
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

  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(whiskies)
    .where(eq(whiskies.distillerId, header.id))
  const total = Number(countRows?.[0]?.count || 0)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const whiskyRows = await db
    .select({
      id: whiskies.id,
      slug: whiskies.slug,
      name: whiskies.name,
      bottleImageUrl: sql<string>`coalesce(${whiskies.bottleImageUrl}, ${whiskies.imageUrl})`,
      type: whiskies.type,
      countryName: countries.name,
      countryNameFr: countries.nameFr,
    })
    .from(whiskies)
    .leftJoin(countries, eq(countries.id, whiskies.countryId))
    .where(eq(whiskies.distillerId, header.id))
    .orderBy(sql`${whiskies.createdAt} desc`)
    .limit(pageSize)
    .offset(offset)

  type WhiskyRow = {
    id: string
    slug: string | null
    name: string
    bottleImageUrl: string | null
    type: string | null
    countryName: string | null
    countryNameFr: string | null
  }
  const items = (whiskyRows as WhiskyRow[]).map((row) => ({
    ...row,
    countryName: locale === 'fr' ? row.countryNameFr || row.countryName : row.countryName,
  }))

  const countryLabel = locale === 'fr' ? header.countryNameFr || header.countryName : header.countryName
  const localizedDescription =
    locale === 'fr'
      ? header.descriptionFr || header.descriptionEn
      : header.descriptionEn || header.descriptionFr
  const imageSrc = normalizeImage(header.imageUrl)

  return (
    <div className="min-h-screen bg-gray-50 px-4 md:px-8 py-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row gap-5">
            <div className="w-28 h-28 rounded-xl border border-gray-200 bg-white overflow-hidden flex items-center justify-center shrink-0">
              {imageSrc ? (
                <img src={imageSrc} alt={header.name} className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs text-gray-400">{t('catalogue.noImage')}</span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
                {header.name}
              </h1>
              <div className="mt-2 text-sm text-gray-600">
                {[countryLabel, header.region].filter(Boolean).join(' • ')}
              </div>
              <div className="mt-3 text-sm text-gray-700">
                {localizedDescription || `${header.name} — ${total} ${t('catalogue.whiskiesCount')}.`}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {items.map((item) => {
            const img = normalizeImage(item.bottleImageUrl)
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
                <div className="p-3">
                  <h3 className="text-base font-semibold line-clamp-2">{item.name}</h3>
                  <div className="text-xs text-gray-500 mt-1">
                    {[item.type, item.countryName].filter(Boolean).join(' • ')}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Link
              href={`/${locale}/distiller/${slug}?page=${Math.max(1, page - 1)}`}
              className={`px-3 py-2 rounded-lg border ${page === 1 ? 'pointer-events-none opacity-50' : ''}`}
              style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
            >
              {t('catalogue.prev')}
            </Link>
            <span className="text-sm text-gray-600">
              {t('catalogue.page')} {page} / {totalPages}
            </span>
            <Link
              href={`/${locale}/distiller/${slug}?page=${Math.min(totalPages, page + 1)}`}
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
