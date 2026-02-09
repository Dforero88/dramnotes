import type { MetadataRoute } from 'next'
import { db, whiskies } from '@/lib/db'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.APP_URL || 'https://dramnotes.com'
  const locales = ['fr', 'en']

  const staticPaths = ['/', '/catalogue', '/explorer', '/map', '/login', '/register']
  const staticEntries = locales.flatMap((locale) =>
    staticPaths.map((path) => ({
      url: `${baseUrl}/${locale}${path === '/' ? '' : path}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: path === '/' ? 1 : 0.7,
    }))
  )

  const whiskyRows = await db
    .select({ id: whiskies.id, updatedAt: whiskies.updatedAt })
    .from(whiskies)
    .orderBy(sql`${whiskies.updatedAt} desc`)

  const whiskyEntries = locales.flatMap((locale) =>
    whiskyRows.map((row) => ({
      url: `${baseUrl}/${locale}/whisky/${row.id}`,
      lastModified: row.updatedAt || new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    }))
  )

  return [...staticEntries, ...whiskyEntries]
}
