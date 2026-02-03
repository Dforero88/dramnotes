import { NextRequest, NextResponse } from 'next/server'
import { db, whiskies } from '@/lib/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const barcode = String(body?.barcode || '').trim()
    if (!barcode) {
      return NextResponse.json({ exists: false })
    }

    const result = await db
      .select({ id: whiskies.id })
      .from(whiskies)
      .where(eq(whiskies.barcode, barcode))
      .limit(1)

    return NextResponse.json({ exists: result.length > 0 })
  } catch (error) {
    console.error('❌ Erreur check-barcode:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
