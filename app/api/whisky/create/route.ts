import { NextRequest, NextResponse } from 'next/server'
import { db, whiskies, distillers, bottlers } from '@/lib/db'
import { and, eq, sql } from 'drizzle-orm'
import { generateId } from '@/lib/db'
import path from 'path'
import fs from 'fs/promises'

export const dynamic = 'force-dynamic'

function normalizeYear(value: any): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const rawData = formData.get('whisky_data')
    const bottleImage = formData.get('bottle_image') as File | null

    if (!rawData) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    const data = JSON.parse(String(rawData))
    const name = String(data?.name || '').trim()
    if (!name) {
      return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
    }
    if (!data?.country_id || String(data.country_id).trim() === '') {
      return NextResponse.json({ error: 'Pays requis' }, { status: 400 })
    }

    const distilledYear = normalizeYear(data?.distilled_year)
    const bottledYear = normalizeYear(data?.bottled_year)

    const duplicate = await db
      .select({ id: whiskies.id })
      .from(whiskies)
      .where(and(
        eq(whiskies.name, name),
        distilledYear === null ? sql`${whiskies.distilledYear} IS NULL` : eq(whiskies.distilledYear, distilledYear),
        bottledYear === null ? sql`${whiskies.bottledYear} IS NULL` : eq(whiskies.bottledYear, bottledYear),
      ))
      .limit(1)

    if (duplicate.length > 0) {
      return NextResponse.json({ error: 'Un whisky avec ce nom/années existe déjà', code: 'DUPLICATE' }, { status: 409 })
    }

    let bottleImageUrl: string | null = null
    if (bottleImage) {
      const ext = bottleImage.type === 'image/png' ? 'png' : 'jpg'
      const filename = `${generateId()}.${ext}`
      const uploadDir =
        process.env.UPLOADS_DIR || path.join(process.cwd(), 'public', 'uploads', 'bottles')
      const publicBase = process.env.UPLOADS_PUBLIC_URL || '/uploads/bottles'
      await fs.mkdir(uploadDir, { recursive: true })
      const filePath = path.join(uploadDir, filename)
      const buffer = Buffer.from(await bottleImage.arrayBuffer())
      await fs.writeFile(filePath, buffer)
      bottleImageUrl = `${publicBase}/${filename}`
      console.log('✅ Bottle image saved:', filePath)
    }

    const now = new Date()
    const id = generateId()

    let distillerId: string | null = null
    if (data?.distiller && String(data.distiller).trim()) {
      const distillerName = String(data.distiller).trim()
      const existing = await db
        .select({ id: distillers.id })
        .from(distillers)
        .where(sql`lower(${distillers.name}) = ${distillerName.toLowerCase()}`)
        .limit(1)
      if (existing.length > 0) {
        distillerId = existing[0].id
      } else {
        distillerId = generateId()
        await db.insert(distillers).values({ id: distillerId, name: distillerName, countryId: data?.country_id || null })
      }
    }

    let bottlerId: string | null = null
    if (data?.bottler && String(data.bottler).trim()) {
      const bottlerName = String(data.bottler).trim()
      const existing = await db
        .select({ id: bottlers.id })
        .from(bottlers)
        .where(sql`lower(${bottlers.name}) = ${bottlerName.toLowerCase()}`)
        .limit(1)
      if (existing.length > 0) {
        bottlerId = existing[0].id
      } else {
        bottlerId = generateId()
        await db.insert(bottlers).values({ id: bottlerId, name: bottlerName })
      }
    }

    await db.insert(whiskies).values({
      id,
      name,
      distillerId,
      bottlerId,
      countryId: data?.country_id || null,
      addedById: data?.added_by || null,
      barcode: data?.ean13 || null,
      barcodeType: data?.ean13 ? 'EAN-13' : null,
      bottlingType: data?.bottling_type || null,
      distilledYear,
      bottledYear,
      age: normalizeYear(data?.age),
      caskType: data?.cask_type || null,
      batchId: data?.batch_id || null,
      alcoholVolume: data?.alcohol_volume ? Number(data.alcohol_volume) : null,
      bottledFor: data?.bottled_for || null,
      region: data?.region || null,
      type: data?.type || null,
      description: null,
      imageUrl: bottleImageUrl,
      bottleImageUrl,
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({ success: true, id, bottleImageUrl })
  } catch (error) {
    console.error('❌ Erreur create whisky:', error)
    return NextResponse.json({ error: 'Erreur serveur interne' }, { status: 500 })
  }
}
