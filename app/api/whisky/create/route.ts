import { NextRequest, NextResponse } from 'next/server'
import { db, whiskies, distillers, bottlers } from '@/lib/db'
import { and, eq, sql } from 'drizzle-orm'
import { generateId } from '@/lib/db'
import path from 'path'
import fs from 'fs/promises'
import { validateWhiskyName, validateDisplayName, sanitizeText } from '@/lib/moderation'
import * as Sentry from '@sentry/nextjs'

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
    const nameRaw = String(data?.name || '').trim()
    if (!nameRaw) {
      return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
    }
    const nameCheck = await validateWhiskyName(nameRaw)
    if (!nameCheck.ok) {
      return NextResponse.json({ error: nameCheck.message || 'Nom invalide' }, { status: 400 })
    }
    const name = nameCheck.value
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
      const filename = `${generateId()}.webp`
      const uploadsRoot = process.env.UPLOADS_DIR || path.join(process.cwd(), 'public', 'uploads')
      const publicBase = process.env.UPLOADS_PUBLIC_URL || '/uploads/bottles'
      const publicPath = publicBase.replace(/^\/+/, '')
      const relativePath = publicPath.startsWith('uploads/')
        ? publicPath.slice('uploads/'.length)
        : publicPath
      const uploadDir = path.join(uploadsRoot, relativePath)
      await fs.mkdir(uploadDir, { recursive: true })
      const filePath = path.join(uploadDir, filename)
      const buffer = Buffer.from(await bottleImage.arrayBuffer())
      let outputBuffer = buffer
      try {
        const sharpModule = await import('sharp')
        const sharp = sharpModule.default || sharpModule
        const image = sharp(buffer).rotate()
        const meta = await image.metadata()
        const maxDim = Math.max(meta.width || 0, meta.height || 0, 1200)
        const target = Math.min(1200, maxDim)
        outputBuffer = await image
          .resize({
            width: target,
            height: target,
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          })
          .webp({ quality: 85 })
          .toBuffer()
      } catch (e) {
        // Fallback: store original if sharp is unavailable
      }
      await fs.writeFile(filePath, outputBuffer)
      bottleImageUrl = `${publicBase}/${filename}`
      console.log('✅ Bottle image saved:', filePath)
    }

    const now = new Date()
    const id = generateId()

    let distillerId: string | null = null
    let distillerName: string | null = null
    if (data?.distiller && String(data.distiller).trim()) {
      const check = await validateDisplayName(String(data.distiller), 80)
      if (!check.ok) {
        return NextResponse.json({ error: check.message || 'Distilleur invalide' }, { status: 400 })
      }
      distillerName = check.value
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
    let bottlerName: string | null = null
    if (data?.bottler && String(data.bottler).trim()) {
      const check = await validateDisplayName(String(data.bottler), 80)
      if (!check.ok) {
        return NextResponse.json({ error: check.message || 'Embouteilleur invalide' }, { status: 400 })
      }
      bottlerName = check.value
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

    let region: string | null = null
    if (data?.region && String(data.region).trim()) {
      const check = await validateDisplayName(String(data.region), 80)
      if (!check.ok) {
        return NextResponse.json({ error: check.message || 'Région invalide' }, { status: 400 })
      }
      region = check.value
    }

    let type: string | null = null
    if (data?.type && String(data.type).trim()) {
      const check = await validateDisplayName(String(data.type), 80)
      if (!check.ok) {
        return NextResponse.json({ error: check.message || 'Type invalide' }, { status: 400 })
      }
      type = check.value
    }

    let bottledFor: string | null = null
    if (data?.bottled_for && String(data.bottled_for).trim()) {
      const check = await validateDisplayName(String(data.bottled_for), 80)
      if (!check.ok) {
        return NextResponse.json({ error: check.message || 'Embouteillé pour invalide' }, { status: 400 })
      }
      bottledFor = check.value
    }

    let caskType: string | null = null
    if (data?.cask_type && String(data.cask_type).trim()) {
      const check = await validateDisplayName(String(data.cask_type), 80)
      if (!check.ok) {
        return NextResponse.json({ error: check.message || 'Type de fût invalide' }, { status: 400 })
      }
      caskType = check.value
    }

    let batchId: string | null = null
    if (data?.batch_id && String(data.batch_id).trim()) {
      const cleaned = sanitizeText(String(data.batch_id), 40)
      if (cleaned.length < 1) {
        return NextResponse.json({ error: 'Batch invalide' }, { status: 400 })
      }
      batchId = cleaned
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
      caskType,
      batchId,
      alcoholVolume: data?.alcohol_volume ? Number(data.alcohol_volume) : null,
      bottledFor,
      region,
      type,
      description: null,
      imageUrl: bottleImageUrl,
      bottleImageUrl,
      createdAt: now,
      updatedAt: now,
    })

    Sentry.captureMessage('whisky_created', {
      level: 'info',
      tags: { whiskyId: id },
    })

    return NextResponse.json({ success: true, id, bottleImageUrl })
  } catch (error) {
    console.error('❌ Erreur create whisky:', error)
    return NextResponse.json({ error: 'Erreur serveur interne' }, { status: 500 })
  }
}
