import type { MetadataRoute } from 'next'
import { db, whiskies } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { buildWhiskyPath } from '@/lib/whisky-url'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.APP_URL || 'https://dramnotes.com'
  const locales = ['fr', 'en']

  const staticPaths = ['/', '/catalogue', '/explorer', '/map', '/login', '/register', '/privacy']
  const staticEntries = locales.flatMap((locale) =>
    staticPaths.map((path) => ({
      url: `${baseUrl}/${locale}${path === '/' ? '' : path}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: path === '/' ? 1 : 0.7,
    }))
  )

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

  return [...staticEntries, ...whiskyEntries]
}
