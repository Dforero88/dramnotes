import { NextRequest, NextResponse } from 'next/server'
import { db, countries } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const locale = (searchParams.get('lang') || 'fr').toLowerCase()
    const result = await db.select().from(countries)
    const items = result.map((c) => ({
      ...c,
      displayName: locale === 'fr' ? c.nameFr || c.name : c.name,
    }))
    return NextResponse.json({ countries: items })
  } catch (error) {
    console.error('❌ Erreur countries:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
