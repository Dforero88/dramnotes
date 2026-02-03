import { NextResponse } from 'next/server'
import { db, countries } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await db.select().from(countries)
    return NextResponse.json({ countries: result })
  } catch (error) {
    console.error('❌ Erreur countries:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
