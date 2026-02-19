import type { MetadataRoute } from 'next'
import { db, whiskies, distillers, bottlers, users, isMysql } from '@/lib/db'
import { and, eq, sql } from 'drizzle-orm'
import { buildWhiskyPath } from '@/lib/whisky-url'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.APP_URL || 'https://dramnotes.com'
  const locales = ['fr', 'en']

  const staticPaths = ['/', '/catalogue', '/explorer', '/map', '/login', '/register', '/privacy', '/terms', '/about', '/contact']
  const staticEntries = locales.flatMap((locale) =>
    staticPaths.map((path) => ({
      url: `${baseUrl}/${locale}${path === '/' ? '' : path}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: path === '/' ? 1 : 0.7,
    }))
  )

  try {
    const whiskyRows = await db
      .select({ id: whiskies.id, slug: whiskies.slug, name: whiskies.name, updatedAt: whiskies.updatedAt })
      .from(whiskies)
      .orderBy(sql`${whiskies.updatedAt} desc`)
    type WhiskySitemapRow = { id: string; slug: string | null; name: string | null; updatedAt: Date | null }

    const whiskyEntries = locales.flatMap((locale) =>
      (whiskyRows as WhiskySitemapRow[]).map((row: WhiskySitemapRow) => ({
        url: `${baseUrl}${buildWhiskyPath(locale, row.id, row.name, row.slug)}`,
        lastModified: row.updatedAt || new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.8,
      }))
    )

    const distillerRows = await db
      .select({ slug: distillers.slug, id: distillers.id })
      .from(distillers)
      .where(and(eq(distillers.isActive, 1), sql`${distillers.mergedIntoId} is null`))
      .orderBy(sql`lower(${distillers.name}) asc`)
    type DistillerSitemapRow = { slug: string | null; id: string }
    const distillerEntries = locales.flatMap((locale) =>
      (distillerRows as DistillerSitemapRow[])
        .filter((row) => Boolean(row.slug))
        .map((row) => ({
          url: `${baseUrl}/${locale}/distiller/${encodeURIComponent(String(row.slug))}`,
          lastModified: new Date(),
          changeFrequency: 'monthly' as const,
          priority: 0.7,
        }))
    )

    const bottlerRows = await db
      .select({ slug: bottlers.slug, id: bottlers.id })
      .from(bottlers)
      .where(and(eq(bottlers.isActive, 1), sql`${bottlers.mergedIntoId} is null`))
      .orderBy(sql`lower(${bottlers.name}) asc`)
    type BottlerSitemapRow = { slug: string | null; id: string }
    const bottlerEntries = locales.flatMap((locale) =>
      (bottlerRows as BottlerSitemapRow[])
        .filter((row) => Boolean(row.slug))
        .map((row) => ({
          url: `${baseUrl}/${locale}/bottler/${encodeURIComponent(String(row.slug))}`,
          lastModified: new Date(),
          changeFrequency: 'monthly' as const,
          priority: 0.7,
        }))
    )

    const publicUsersRows = await db
      .select({ pseudo: users.pseudo, updatedAt: users.updatedAt })
      .from(users)
      .where(isMysql ? sql`binary ${users.visibility} = 'public'` : eq(users.visibility, 'public'))
    type PublicUserSitemapRow = { pseudo: string | null; updatedAt: Date | null }
    const publicUserEntries = locales.flatMap((locale) =>
      (publicUsersRows as PublicUserSitemapRow[])
        .filter((row) => Boolean(row.pseudo))
        .map((row) => ({
          url: `${baseUrl}/${locale}/user/${encodeURIComponent(String(row.pseudo))}`,
          lastModified: row.updatedAt || new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        }))
    )

    return [...staticEntries, ...whiskyEntries, ...distillerEntries, ...bottlerEntries, ...publicUserEntries]
  } catch (error) {
    console.error('[sitemap] failed, returning static entries only:', error)
    return staticEntries
  }
}
