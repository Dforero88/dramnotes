import { NextRequest, NextResponse } from 'next/server'
import { db, countries } from '@/lib/db'
import { getRouteCache, setRouteCache } from '@/lib/server-route-cache'

export const dynamic = 'force-dynamic'
const CACHE_TTL_SECONDS = 3600

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const locale = (searchParams.get('lang') || 'fr').toLowerCase()
    const cacheKey = `countries:${locale}`
    const cached = getRouteCache<{ countries: unknown[] }>(cacheKey)
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': `public, max-age=0, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=60` },
      })
    }
    const result = await db.select().from(countries)
    type CountryRow = { id: string; name: string; nameFr: string | null }
    const items = (result as CountryRow[])
      .map((c: CountryRow) => ({
        ...c,
        displayName: locale === 'fr' ? c.nameFr || c.name : c.name,
      }))
      .sort((a, b) =>
        String(a.displayName || '').localeCompare(String(b.displayName || ''), locale === 'fr' ? 'fr' : 'en', {
          sensitivity: 'base',
        })
      )
    const payload = { countries: items }
    setRouteCache(cacheKey, payload, CACHE_TTL_SECONDS)
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': `public, max-age=0, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=60` },
    })
  } catch (error) {
    console.error('❌ Erreur countries:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
