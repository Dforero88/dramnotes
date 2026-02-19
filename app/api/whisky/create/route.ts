import { NextRequest, NextResponse } from 'next/server'
import { db, whiskies, distillers, bottlers, activities } from '@/lib/db'
import { and, eq, sql } from 'drizzle-orm'
import { generateId } from '@/lib/db'
import path from 'path'
import fs from 'fs/promises'
import { validateWhiskyName, validateDisplayName, sanitizeText } from '@/lib/moderation'
import { captureBusinessEvent } from '@/lib/sentry-business'
import { buildRateLimitKey, rateLimit } from '@/lib/rate-limit'
import { normalizeProducerName } from '@/lib/producer-name'
import { resolveBottlerName, resolveDistillerName } from '@/lib/producer-resolver'
import { slugifyProducerName } from '@/lib/producer-url'
import { slugifyWhiskyName } from '@/lib/whisky-url'
import { normalizeWhiskyName } from '@/lib/whisky-name'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function normalizeYear(value: any): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function apiError(code: string, message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ errorCode: code, error: message, ...(extra || {}) }, { status })
}

async function generateUniqueWhiskySlug(name: string): Promise<string> {
  const base = slugifyWhiskyName(name)
  let slug = base
  let counter = 2
  while (true) {
    const existing = await db
      .select({ id: whiskies.id })
      .from(whiskies)
      .where(eq(whiskies.slug, slug))
      .limit(1)
    if (existing.length === 0) return slug
    slug = `${base}-${counter}`
    counter += 1
  }
}

async function generateUniqueDistillerSlug(name: string): Promise<string> {
  const base = slugifyProducerName(name)
  let slug = base
  let counter = 2
  while (true) {
    const existing = await db
      .select({ id: distillers.id })
      .from(distillers)
      .where(eq(distillers.slug, slug))
      .limit(1)
    if (existing.length === 0) return slug
    slug = `${base}-${counter}`
    counter += 1
  }
}

async function generateUniqueBottlerSlug(name: string): Promise<string> {
  const base = slugifyProducerName(name)
  let slug = base
  let counter = 2
  while (true) {
    const existing = await db
      .select({ id: bottlers.id })
      .from(bottlers)
      .where(eq(bottlers.slug, slug))
      .limit(1)
    if (existing.length === 0) return slug
    slug = `${base}-${counter}`
    counter += 1
  }
}

export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(request, {
      key: buildRateLimitKey(request, null, 'whisky-create'),
      windowMs: 60 * 60 * 1000,
      max: 10,
    })
    if (!limit.ok) {
      return NextResponse.json(
        { errorCode: 'RATE_LIMIT', error: 'Trop de requêtes. Réessayez plus tard.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      )
    }

    const formData = await request.formData()
    const rawData = formData.get('whisky_data')
    const bottleImage = formData.get('bottle_image') as File | null

    if (!rawData) {
      return apiError('MISSING_PAYLOAD', 'Données manquantes', 400)
    }

    const data = JSON.parse(String(rawData))
    const nameRaw = String(data?.name || '').trim()
    if (!nameRaw) {
      return apiError('NAME_REQUIRED', 'Nom requis', 400)
    }
    const nameCheck = await validateWhiskyName(nameRaw)
    if (!nameCheck.ok) {
      return apiError('NAME_INVALID', nameCheck.message || 'Nom invalide', 400)
    }
    const normalizedName = normalizeWhiskyName(nameCheck.value)
    const normalizedNameCheck = await validateWhiskyName(normalizedName)
    if (!normalizedNameCheck.ok) {
      return apiError('NAME_INVALID', normalizedNameCheck.message || 'Nom invalide', 400)
    }
    const name = normalizedNameCheck.value
    const bottlingType = String(data?.bottling_type || '').trim()
    if (!bottlingType) {
      return apiError('BOTTLING_TYPE_REQUIRED', 'Type d’embouteillage requis', 400)
    }
    if (!['DB', 'IB'].includes(bottlingType)) {
      return apiError('BOTTLING_TYPE_INVALID', 'Type d’embouteillage invalide', 400)
    }
    if (!data?.country_id || String(data.country_id).trim() === '') {
      return apiError('COUNTRY_REQUIRED', 'Pays requis', 400)
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
      return apiError('WHISKY_DUPLICATE', 'Un whisky avec ce nom/années existe déjà', 409)
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
      const rawBuffer = await bottleImage.arrayBuffer()
      const buffer = Buffer.from(new Uint8Array(rawBuffer))
      let outputBuffer: Buffer = buffer
      try {
        const sharpModule = await import('sharp')
        const sharp = sharpModule.default || sharpModule
        const image = sharp(buffer).rotate()
        const meta = await image.metadata()
        const maxDim = Math.max(meta.width || 0, meta.height || 0, 1200)
        const target = Math.min(1200, maxDim)
        const processed = await image
          .resize({
            width: target,
            height: target,
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 1 },
          })
          .webp({ quality: 85 })
          .toBuffer()
        outputBuffer = Buffer.from(processed)
      } catch (e) {
        // Fallback: store original if sharp is unavailable
      }
      await fs.writeFile(filePath, outputBuffer)
      bottleImageUrl = `${publicBase}/${filename}`
      console.log('✅ Bottle image saved:', filePath)
    }

    const now = new Date()
    const id = generateId()
    const slug = await generateUniqueWhiskySlug(name)

    if (bottlingType === 'DB' && (!data?.distiller || String(data.distiller).trim() === '')) {
      return apiError('DISTILLER_REQUIRED_DB', 'Le distiller est obligatoire pour un embouteillage DB', 400)
    }
    if (bottlingType === 'IB' && (!data?.bottler || String(data.bottler).trim() === '')) {
      return apiError('BOTTLER_REQUIRED_IB', 'Le bottler est obligatoire pour un embouteillage IB', 400)
    }

    if (typeof data?.distiller === 'string' && data.distiller.trim()) {
      const resolved = await resolveDistillerName(data.distiller)
      if (resolved.confidence === 'high' && resolved.resolvedName) {
        data.distiller = resolved.resolvedName
      }
    }
    if (bottlingType === 'IB' && typeof data?.bottler === 'string' && data.bottler.trim()) {
      const resolved = await resolveBottlerName(data.bottler)
      if (resolved.confidence === 'high' && resolved.resolvedName) {
        data.bottler = resolved.resolvedName
      }
    }

    let distillerId: string | null = null
    let distillerName: string | null = null
    const shouldHandleDistiller = bottlingType === 'DB' || bottlingType === 'IB'
    if (shouldHandleDistiller && data?.distiller && String(data.distiller).trim()) {
      const normalizedDistiller = normalizeProducerName(String(data.distiller))
      const check = await validateDisplayName(normalizedDistiller, 80)
      if (!check.ok) {
        return apiError('DISTILLER_INVALID', check.message || 'Distilleur invalide', 400)
      }
      distillerName = check.value
      const existing = await db
        .select({
          id: distillers.id,
          countryId: distillers.countryId,
          isActive: distillers.isActive,
          mergedIntoId: distillers.mergedIntoId,
        })
        .from(distillers)
        .where(and(sql`lower(${distillers.name}) = ${distillerName.toLowerCase()}`, eq(distillers.isActive, 1), sql`${distillers.mergedIntoId} is null`))
        .limit(1)
      if (existing.length > 0) {
        distillerId = existing[0].mergedIntoId || existing[0].id
        // Country ownership:
        // - DB: distiller country can be inferred from bottle country
        // - IB: distiller country is unknown by default, keep null
        if (
          bottlingType === 'DB' &&
          data?.country_id &&
          String(data.country_id).trim() &&
          !existing[0].countryId
        ) {
          await db
            .update(distillers)
            .set({ countryId: String(data.country_id).trim() })
            .where(eq(distillers.id, distillerId))
        }
      } else {
        distillerId = generateId()
        const distillerSlug = await generateUniqueDistillerSlug(distillerName)
        await db.insert(distillers).values({
          id: distillerId,
          name: distillerName,
          slug: distillerSlug,
          descriptionFr: null,
          descriptionEn: null,
          imageUrl: null,
          countryId: bottlingType === 'DB' ? (data?.country_id || null) : null,
          region: data?.region ? String(data.region).trim() : null,
        })
      }
    }

    let bottlerId: string | null = null
    let bottlerName: string | null = null
    if (bottlingType === 'IB' && data?.bottler && String(data.bottler).trim()) {
      const normalizedBottler = normalizeProducerName(String(data.bottler))
      const check = await validateDisplayName(normalizedBottler, 80)
      if (!check.ok) {
        return apiError('BOTTLER_INVALID', check.message || 'Embouteilleur invalide', 400)
      }
      bottlerName = check.value
      const existing = await db
        .select({
          id: bottlers.id,
          countryId: bottlers.countryId,
          isActive: bottlers.isActive,
          mergedIntoId: bottlers.mergedIntoId,
        })
        .from(bottlers)
        .where(and(sql`lower(${bottlers.name}) = ${bottlerName.toLowerCase()}`, eq(bottlers.isActive, 1), sql`${bottlers.mergedIntoId} is null`))
        .limit(1)
      if (existing.length > 0) {
        bottlerId = existing[0].mergedIntoId || existing[0].id
        // Country ownership:
        // - IB: bottler country can be inferred from bottle country
        if (data?.country_id && String(data.country_id).trim() && !existing[0].countryId) {
          await db
            .update(bottlers)
            .set({ countryId: String(data.country_id).trim() })
            .where(eq(bottlers.id, bottlerId))
        }
      } else {
        bottlerId = generateId()
        const bottlerSlug = await generateUniqueBottlerSlug(bottlerName)
        await db.insert(bottlers).values({
          id: bottlerId,
          name: bottlerName,
          slug: bottlerSlug,
          descriptionFr: null,
          descriptionEn: null,
          imageUrl: null,
          countryId: data?.country_id || null,
          region: data?.region ? String(data.region).trim() : null,
        })
      }
    }

    let region: string | null = null
    if (data?.region && String(data.region).trim()) {
      const check = await validateDisplayName(String(data.region), 80)
      if (!check.ok) {
        return apiError('REGION_INVALID', check.message || 'Région invalide', 400)
      }
      region = check.value
    }

    let type: string | null = null
    if (data?.type && String(data.type).trim()) {
      const check = await validateDisplayName(String(data.type), 80)
      if (!check.ok) {
        return apiError('TYPE_INVALID', check.message || 'Type invalide', 400)
      }
      type = check.value
    }

    let bottledFor: string | null = null
    if (data?.bottled_for && String(data.bottled_for).trim()) {
      const check = await validateDisplayName(String(data.bottled_for), 80)
      if (!check.ok) {
        return apiError('BOTTLED_FOR_INVALID', check.message || 'Embouteillé pour invalide', 400)
      }
      bottledFor = check.value
    }

    let caskType: string | null = null
    if (data?.cask_type && String(data.cask_type).trim()) {
      const check = await validateDisplayName(String(data.cask_type), 80)
      if (!check.ok) {
        return apiError('CASK_TYPE_INVALID', check.message || 'Type de fût invalide', 400)
      }
      caskType = check.value
    }

    let batchId: string | null = null
    if (data?.batch_id && String(data.batch_id).trim()) {
      const cleaned = sanitizeText(String(data.batch_id), 40)
      if (cleaned.length < 1) {
        return apiError('BATCH_INVALID', 'Batch invalide', 400)
      }
      batchId = cleaned
    }

    await db.insert(whiskies).values({
      id,
      slug,
      name,
      distillerId,
      bottlerId,
      countryId: data?.country_id || null,
      addedById: data?.added_by || null,
      barcode: data?.ean13 || null,
      barcodeType: data?.ean13 ? 'EAN-13' : null,
      bottlingType,
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

    if (data?.added_by) {
      await db.insert(activities).values({
        id: generateId(),
        userId: String(data.added_by),
        type: 'new_whisky',
        targetId: id,
        createdAt: now,
      })
    }

    await captureBusinessEvent('whisky_created', {
      level: 'info',
      tags: { whiskyId: id, userId: String(data?.added_by || 'unknown') },
      extra: {
        name,
        bottlingType,
      },
    })

    return NextResponse.json({ success: true, id, slug, bottleImageUrl })
  } catch (error) {
    console.error('❌ Erreur create whisky:', error)
    return apiError('SERVER_ERROR', 'Erreur serveur interne', 500)
  }
}
