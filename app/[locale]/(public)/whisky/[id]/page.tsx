import { getTranslations, type Locale } from '@/lib/i18n'
import Link from 'next/link'
import { db, whiskies, distillers, bottlers, countries, whiskyAnalyticsCache, whiskyTagStats, tagLang, users } from '@/lib/db'
import { and, eq, sql } from 'drizzle-orm'
import TastingNotesSection from '@/components/TastingNotesSection'
import WhiskyShelfControl from '@/components/WhiskyShelfControl'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { buildWhiskyPath, extractWhiskyUuidFromParam } from '@/lib/whisky-url'
import { resolveCurrentSlugFromLegacy } from '@/lib/slug-redirects'
import { getRelatedWhiskiesForDisplay } from '@/lib/whisky-related'
import SignupCtaLink from '@/components/SignupCtaLink'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; id: string }> }): Promise<Metadata> {
  const { locale, id } = await params
  const baseUrl = process.env.APP_URL || 'https://dramnotes.com'
  const maybeUuid = extractWhiskyUuidFromParam(id)
  const whiskyRow = await db
    .select({
      id: whiskies.id,
      slug: whiskies.slug,
      name: whiskies.name,
      image: sql<string>`coalesce(${whiskies.bottleImageUrl}, ${whiskies.imageUrl})`,
    })
    .from(whiskies)
    .where(maybeUuid ? eq(whiskies.id, maybeUuid) : eq(whiskies.slug, id))
    .limit(1)

  const whisky = whiskyRow?.[0]
  const title = whisky?.name ? `${whisky.name}` : 'Whisky'
  const imageUrl = whisky?.image ? (whisky.image.startsWith('http') || whisky.image.startsWith('/') ? whisky.image : `${baseUrl}/${whisky.image}`) : undefined
  const path = whisky?.id ? buildWhiskyPath(locale, whisky.id, whisky.name, whisky.slug) : `/${locale}/whisky/${id}`
  const url = `${baseUrl}${path}`

  return {
    title,
    description: whisky?.name ? `Notes de dégustation et profil aromatique pour ${whisky.name}.` : 'Fiche whisky.',
    openGraph: {
      title,
      description: whisky?.name ? `Notes de dégustation et profil aromatique pour ${whisky.name}.` : 'Fiche whisky.',
      url,
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
    alternates: { canonical: url },
  }
}

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
  params: Promise<{ locale: Locale; id: string }>
  searchParams: Promise<{ user?: string }>
}) {
  const { locale, id } = await params
  const resolvedSearchParams = await searchParams
  const maybeUuid = extractWhiskyUuidFromParam(id)
  const t = getTranslations(locale)
  const session = await getServerSession(authOptions)
  const isLoggedIn = Boolean(session?.user?.id)
  let notesVisibilityPublic = false
  if (session?.user?.id) {
    const userRows = await db
      .select({ visibility: users.visibility })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
    notesVisibilityPublic = userRows?.[0]?.visibility === 'public'
  }
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
  const filterPseudo = resolvedSearchParams?.user || null

  const result = await db
    .select({
      id: whiskies.id,
      slug: whiskies.slug,
      name: whiskies.name,
      bottleImageUrl: sql<string>`coalesce(${whiskies.bottleImageUrl}, ${whiskies.imageUrl})`,
      distillerName: distillers.name,
      distillerSlug: distillers.slug,
      bottlerName: bottlers.name,
      bottlerSlug: bottlers.slug,
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
      photoCreditPseudo: sql<string | null>`(
        select ${users.pseudo}
        from ${users}
        where ${users.id} = ${whiskies.addedById}
        limit 1
      )`,
    })
    .from(whiskies)
    .leftJoin(distillers, eq(whiskies.distillerId, distillers.id))
    .leftJoin(bottlers, eq(whiskies.bottlerId, bottlers.id))
    .leftJoin(countries, eq(whiskies.countryId, countries.id))
    .where(maybeUuid ? eq(whiskies.id, maybeUuid) : eq(whiskies.slug, id))
    .limit(1)

  const whisky = result?.[0]

  if (!whisky) {
    if (!maybeUuid) {
      const legacy = await resolveCurrentSlugFromLegacy('whisky', id)
      if (legacy?.slug) {
        redirect(buildWhiskyPath(locale, legacy.entityId, undefined, legacy.slug))
      }
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

  const canonicalPath = buildWhiskyPath(locale, whisky.id, whisky.name, whisky.slug)
  if (id !== canonicalPath.split('/').pop()) {
    const userSuffix = filterPseudo ? `?user=${encodeURIComponent(filterPseudo)}` : ''
    redirect(`${canonicalPath}${userSuffix}`)
  }

  const imageSrc = normalizeImage(whisky.bottleImageUrl)
  const countryLabel =
    locale === 'fr' ? whisky.countryNameFr || whisky.countryName : whisky.countryName
  const distillerPath = whisky.distillerSlug ? `/${locale}/distiller/${encodeURIComponent(String(whisky.distillerSlug))}` : null
  const bottlerPath = whisky.bottlerSlug ? `/${locale}/bottler/${encodeURIComponent(String(whisky.bottlerSlug))}` : null

  const detailItems = [
    { label: t('whisky.fieldCountry'), value: countryLabel },
    { label: t('whisky.fieldRegion'), value: whisky.region },
    { label: t('whisky.fieldDistiller'), value: whisky.distillerName, href: distillerPath },
    { label: t('whisky.fieldBottler'), value: whisky.bottlerName, href: bottlerPath },
    {
      label: t('whisky.fieldBottlingType'),
      value:
        whisky.bottlingType === 'DB'
          ? t('whisky.bottlingDB')
          : whisky.bottlingType === 'IB'
            ? t('whisky.bottlingIB')
            : whisky.bottlingType,
    },
    { label: t('whisky.fieldType'), value: whisky.type },
    { label: t('whisky.fieldDistilledYear'), value: formatYear(whisky.distilledYear) },
    { label: t('whisky.fieldBottledYear'), value: formatYear(whisky.bottledYear) },
    { label: t('whisky.fieldAge'), value: whisky.age ? `${whisky.age}y` : null },
    { label: t('whisky.fieldAlcoholVolume'), value: whisky.alcoholVolume ? `${whisky.alcoholVolume}%` : null },
    { label: t('whisky.fieldCaskType'), value: whisky.caskType },
    { label: t('whisky.fieldBatchId'), value: whisky.batchId },
    { label: t('whisky.fieldBottledFor'), value: whisky.bottledFor },
    { label: t('whisky.fieldBarcode'), value: whisky.barcode },
  ].filter((item) => item.value !== null && item.value !== undefined && String(item.value).trim() !== '')

  let analyticsData: {
    avgRating: number
    totalReviews: number
    tags: { nose: { name: string; count: number }[]; palate: { name: string; count: number }[]; finish: { name: string; count: number }[] }
  } | null = null

  const cacheRows = await db
    .select({
      avgRating: whiskyAnalyticsCache.avgRating,
      totalReviews: whiskyAnalyticsCache.totalReviews,
    })
    .from(whiskyAnalyticsCache)
    .where(eq(whiskyAnalyticsCache.whiskyId, whisky.id))
    .limit(1)

  const cache = cacheRows?.[0]
  if (cache && Number(cache.totalReviews || 0) > 0) {
    type TagStatRow = {
      section: 'nose' | 'palate' | 'finish'
      count: number
      name: string | null
    }
    const tagRows = await db
      .select({
        section: whiskyTagStats.section,
        count: whiskyTagStats.count,
        name: tagLang.name,
      })
      .from(whiskyTagStats)
      .leftJoin(tagLang, and(eq(tagLang.tagId, whiskyTagStats.tagId), eq(tagLang.lang, locale)))
      .where(eq(whiskyTagStats.whiskyId, whisky.id))
      .orderBy(sql`${whiskyTagStats.count} desc`) as TagStatRow[]

    const grouped = { nose: [] as { name: string; count: number }[], palate: [] as { name: string; count: number }[], finish: [] as { name: string; count: number }[] }
    tagRows.forEach((row: TagStatRow) => {
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

  let relatedWhiskies: Awaited<ReturnType<typeof getRelatedWhiskiesForDisplay>> = []
  try {
    relatedWhiskies = await getRelatedWhiskiesForDisplay(whisky.id, locale, 4)
  } catch (error) {
    console.error('⚠️ whisky-related fetch failed:', error)
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
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] lg:grid-cols-[420px_1fr] gap-8">
          <div className="order-2 md:order-1 md:row-span-3 md:self-stretch bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex items-center justify-center">
            <div className="w-full">
              <div className="aspect-square md:max-h-[360px] lg:max-h-none bg-white rounded-xl flex items-center justify-center overflow-hidden">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt={whisky.name}
                  className="max-w-full max-h-full object-contain object-center mx-auto my-auto"
                />
              ) : (
                <div className="text-gray-400">{t('catalogue.noImage')}</div>
              )}
              </div>
              {imageSrc && whisky.photoCreditPseudo ? (
                <p className="mt-3 text-xs text-gray-500 text-center">
                  {t('whisky.photoCredit')} @{whisky.photoCreditPseudo}
                </p>
              ) : null}
            </div>
          </div>

          <div className="order-1 md:order-2 flex flex-col gap-5">
            <div className="space-y-4">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">{whisky.name}</h1>
              <div className="flex flex-wrap gap-2">
                {whisky.type && (
                  <span className="px-3 py-1 rounded-full text-sm border border-gray-200 bg-white">
                    {whisky.type}
                  </span>
                )}
                {(whisky.bottlingType === 'DB' ? whisky.distillerName : whisky.bottlerName) && (
                  whisky.bottlingType === 'DB' && distillerPath ? (
                    <Link href={distillerPath} className="px-3 py-1 rounded-full text-sm border border-gray-200 bg-white hover:bg-gray-50">
                      {whisky.distillerName}
                    </Link>
                  ) : whisky.bottlingType === 'IB' && bottlerPath ? (
                    <Link href={bottlerPath} className="px-3 py-1 rounded-full text-sm border border-gray-200 bg-white hover:bg-gray-50">
                      {whisky.bottlerName}
                    </Link>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-sm border border-gray-200 bg-white">
                      {whisky.bottlingType === 'DB' ? whisky.distillerName : whisky.bottlerName}
                    </span>
                  )
                )}
                {countryLabel && (
                  <span className="px-3 py-1 rounded-full text-sm border border-gray-200 bg-white">
                    {countryLabel}
                  </span>
                )}
              </div>
            </div>

            {whisky.description && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm text-gray-600">{whisky.description}</p>
              </div>
            )}
          </div>

          <div className="order-3 md:hidden">
            <WhiskyShelfControl
              locale={locale}
              whiskyId={whisky.id}
              isLoggedIn={isLoggedIn}
            />
          </div>

          <div className="order-4 md:order-3 md:col-start-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">{t('whisky.detailsTitle')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {detailItems.map((item) => (
                <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">{item.label}</p>
                  {item.href ? (
                    <Link href={item.href} className="text-sm font-medium text-gray-900 mt-1 inline-block hover:underline">
                      {item.value}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-gray-900 mt-1">{item.value}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="hidden md:block order-5 md:order-4 md:col-start-2">
            <WhiskyShelfControl
              locale={locale}
              whiskyId={whisky.id}
              isLoggedIn={isLoggedIn}
            />
          </div>
        </div>

        <div className="mt-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">{t('whisky.analyticsTitle')}</h2>
            {analyticsData ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  <div className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="flex items-start gap-1">
                      <div className="flex items-center gap-0.5 text-sm leading-none text-gray-300">
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
                      <span className="text-[11px] text-gray-700 align-super">{analyticsData.avgRating}/10</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{t('whisky.analyticsAvgLabel')}</div>
                  </div>

                  <div className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="text-base font-semibold text-gray-900">{analyticsData.totalReviews}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {analyticsData.totalReviews === 1 ? t('whisky.analyticsReviewLabelSingular') : t('whisky.analyticsReviewLabelPlural')}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
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
        </div>

        <TastingNotesSection
          whiskyId={whisky.id}
          whiskyPath={canonicalPath}
          locale={locale}
          googleMapsApiKey={process.env.GOOGLE_MAPS_API_KEY || null}
          filterPseudo={filterPseudo}
          notesVisibilityPublic={notesVisibilityPublic}
        />

        <div className="mt-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">{t('whisky.relatedTitle')}</h2>
            {relatedWhiskies.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {relatedWhiskies.map((item) => (
                  <Link
                    key={item.id}
                    href={buildWhiskyPath(locale, item.id, item.name, item.slug)}
                    className="rounded-xl border border-gray-200 bg-white p-3 hover:shadow-md transition-shadow"
                  >
                    <div className="aspect-square bg-white rounded-lg flex items-center justify-center overflow-hidden">
                      {item.imageUrl ? (
                        <img
                          src={normalizeImage(item.imageUrl)}
                          alt={item.name}
                          className="max-w-full max-h-full object-contain object-center"
                        />
                      ) : (
                        <div className="text-gray-400 text-sm">{t('catalogue.noImage')}</div>
                      )}
                    </div>
                    <div className="mt-3">
                      <div className="text-sm font-semibold text-gray-900 line-clamp-2" style={{ fontFamily: 'var(--font-heading)' }}>
                        {item.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                        {item.bottlingType === 'DB' ? item.distillerName : item.bottlerName}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                        {[item.type, item.countryName].filter(Boolean).join(' • ')}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-600">{t('whisky.relatedEmpty')}</div>
            )}

            <div className="mt-6 pt-6 border-t border-gray-100">
              {isLoggedIn ? (
                <div className="text-center">
                  <h3 className="text-xl font-bold text-primary mb-2">{t('catalogue.missingWhisky')}</h3>
                  <p className="text-gray-700 mb-4">{t('catalogue.addWhiskyDescription')}</p>
                  <Link
                    href={`/${locale}/add-whisky`}
                    className="inline-flex items-center gap-2 py-2.5 px-5 bg-primary text-white rounded-full hover:bg-primary-dark-light transition-colors"
                  >
                    <span>+</span>
                    <span>{t('catalogue.addWhiskyButton')}</span>
                  </Link>
                </div>
              ) : (
                <div className="text-center">
                  <h3 className="text-xl font-bold text-gray-700 mb-2">{t('catalogue.missingWhisky')}</h3>
                  <p className="text-gray-600 mb-3">{t('catalogue.loginRequired')}</p>
                  <div className="flex gap-3 justify-center">
                    <Link
                      href={`/${locale}/login`}
                      className="py-2 px-5 bg-primary text-white rounded-full hover:bg-primary-dark-light transition-colors"
                    >
                      {t('navigation.signIn')}
                    </Link>
                    <SignupCtaLink
                      href={`/${locale}/register`}
                      sourceContext="whisky_related_guest_footer"
                      className="py-2 px-5 bg-white text-primary border border-primary rounded-full hover:bg-gray-50 transition-colors"
                    >
                      {t('navigation.signUp')}
                    </SignupCtaLink>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
