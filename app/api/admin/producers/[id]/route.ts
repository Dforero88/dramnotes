import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getServerSession } from 'next-auth'
import { and, eq, sql } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import { db, bottlers, distillers, entityChangeLogItems, entityChangeLogs, whiskies } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { normalizeProducerName } from '@/lib/producer-name'
import { slugifyProducerName } from '@/lib/producer-url'
import { validateDisplayName, validateWhiskyName } from '@/lib/moderation'
import { normalizeWhiskyName } from '@/lib/whisky-name'
import { slugifyWhiskyName } from '@/lib/whisky-url'
import { isSlugReserved, rememberOldSlug } from '@/lib/slug-redirects'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const kindParam = (request.nextUrl.searchParams.get('kind') || 'distiller').toLowerCase()
    const kind = kindParam === 'bottler' ? 'bottler' : kindParam === 'whisky' ? 'whisky' : 'distiller'
    const body = await request.json()

    if (kind === 'whisky') {
      const existingRows = await db
        .select({
          id: whiskies.id,
          slug: whiskies.slug,
          distillerId: whiskies.distillerId,
          bottlerId: whiskies.bottlerId,
        })
        .from(whiskies)
        .where(eq(whiskies.id, id))
        .limit(1)
      const existing = existingRows?.[0]
      if (!existing) return NextResponse.json({ error: 'Whisky not found' }, { status: 404 })

      const nameRaw = typeof body?.name === 'string' ? body.name.trim() : ''
      if (!nameRaw) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
      const normalizedName = normalizeWhiskyName(nameRaw)
      const nameCheck = await validateWhiskyName(normalizedName)
      if (!nameCheck.ok) return NextResponse.json({ error: nameCheck.message || 'Invalid name' }, { status: 400 })

      const baseSlug = slugifyWhiskyName(nameCheck.value)
      let nextSlug = baseSlug
      let counter = 2
      while (await isSlugReserved('whisky', nextSlug, id)) {
        nextSlug = `${baseSlug}-${counter}`
        counter += 1
      }

      const barcode = typeof body?.barcode === 'string' && body.barcode.trim() ? body.barcode.trim() : null
      const bottlingType = body?.bottlingType === 'IB' ? 'IB' : 'DB'
      const age = Number.isFinite(Number(body?.age)) ? Number(body.age) : null
      const distilledYear = Number.isFinite(Number(body?.distilledYear)) ? Number(body.distilledYear) : null
      const bottledYear = Number.isFinite(Number(body?.bottledYear)) ? Number(body.bottledYear) : null
      const alcoholVolume = Number.isFinite(Number(body?.alcoholVolume)) ? Number(body.alcoholVolume) : null
      const countryId = typeof body?.countryId === 'string' && body.countryId.trim() ? body.countryId.trim() : null
      const region = typeof body?.region === 'string' && body.region.trim() ? body.region.trim() : null
      const type = typeof body?.type === 'string' && body.type.trim() ? body.type.trim() : null
      const distillerId =
        typeof body?.distillerId === 'string' && body.distillerId.trim() ? body.distillerId.trim() : null
      const bottlerId =
        typeof body?.bottlerId === 'string' && body.bottlerId.trim() ? body.bottlerId.trim() : null

      if (distillerId) {
        const row = await db
          .select({ id: distillers.id })
          .from(distillers)
          .where(and(eq(distillers.id, distillerId), eq(distillers.isActive, 1), sql`${distillers.mergedIntoId} is null`))
          .limit(1)
        if (!row.length) return NextResponse.json({ error: 'Invalid distiller' }, { status: 400 })
      }

      if (bottlerId) {
        const row = await db
          .select({ id: bottlers.id })
          .from(bottlers)
          .where(and(eq(bottlers.id, bottlerId), eq(bottlers.isActive, 1), sql`${bottlers.mergedIntoId} is null`))
          .limit(1)
        if (!row.length) return NextResponse.json({ error: 'Invalid bottler' }, { status: 400 })
      }

      await db
        .update(whiskies)
        .set({
          name: nameCheck.value,
          slug: nextSlug,
          barcode,
          barcodeType: barcode ? 'EAN-13' : null,
          age,
          distilledYear,
          bottledYear,
          alcoholVolume,
          bottlingType,
          distillerId,
          bottlerId,
          countryId,
          region,
          type,
        })
        .where(eq(whiskies.id, id))

      if (existing.slug && existing.slug !== nextSlug) {
        await rememberOldSlug('whisky', id, existing.slug)
      }

      const actorId = session?.user?.id || 'system'
      if ((existing.distillerId || null) !== (distillerId || null)) {
        const logId = crypto.randomUUID()
        await db.insert(entityChangeLogs).values({
          id: logId,
          eventType: 'reassign_distiller',
          actorUserId: actorId,
          sourceEntityType: 'whisky',
          sourceEntityId: id,
          targetEntityType: 'distiller',
          targetEntityId: distillerId,
          payloadJson: JSON.stringify({
            whiskyId: id,
            oldDistillerId: existing.distillerId,
            newDistillerId: distillerId,
          }),
          createdAt: new Date(),
        })
        await db.insert(entityChangeLogItems).values({
          id: crypto.randomUUID(),
          logId,
          itemType: 'whisky',
          itemId: id,
          payloadJson: JSON.stringify({
            oldDistillerId: existing.distillerId,
            newDistillerId: distillerId,
          }),
        })
      }

      if ((existing.bottlerId || null) !== (bottlerId || null)) {
        const logId = crypto.randomUUID()
        await db.insert(entityChangeLogs).values({
          id: logId,
          eventType: 'reassign_bottler',
          actorUserId: actorId,
          sourceEntityType: 'whisky',
          sourceEntityId: id,
          targetEntityType: 'bottler',
          targetEntityId: bottlerId,
          payloadJson: JSON.stringify({
            whiskyId: id,
            oldBottlerId: existing.bottlerId,
            newBottlerId: bottlerId,
          }),
          createdAt: new Date(),
        })
        await db.insert(entityChangeLogItems).values({
          id: crypto.randomUUID(),
          logId,
          itemType: 'whisky',
          itemId: id,
          payloadJson: JSON.stringify({
            oldBottlerId: existing.bottlerId,
            newBottlerId: bottlerId,
          }),
        })
      }

      return NextResponse.json({ success: true, slug: nextSlug })
    }

    const rawName = typeof body?.name === 'string' ? normalizeProducerName(body.name) : ''
    if (!rawName) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    const nameCheck = await validateDisplayName(rawName, 80)
    if (!nameCheck.ok) return NextResponse.json({ error: nameCheck.message || 'Invalid name' }, { status: 400 })

    const region = typeof body?.region === 'string' && body.region.trim() ? body.region.trim() : null
    const descriptionFr = typeof body?.descriptionFr === 'string' && body.descriptionFr.trim() ? body.descriptionFr.trim() : null
    const descriptionEn = typeof body?.descriptionEn === 'string' && body.descriptionEn.trim() ? body.descriptionEn.trim() : null
    const countryId = typeof body?.countryId === 'string' && body.countryId.trim() ? body.countryId.trim() : null

    if (kind === 'distiller') {
      const existingRows = await db
        .select({ id: distillers.id, slug: distillers.slug, isActive: distillers.isActive, mergedIntoId: distillers.mergedIntoId })
        .from(distillers)
        .where(eq(distillers.id, id))
        .limit(1)
      const existing = existingRows?.[0]
      if (!existing) return NextResponse.json({ error: 'Distiller not found' }, { status: 404 })
      if (existing.isActive !== 1 || existing.mergedIntoId) {
        return NextResponse.json({ error: 'Distiller merged/inactive' }, { status: 400 })
      }

      const duplicate = await db
        .select({ id: distillers.id })
        .from(distillers)
        .where(and(
          sql`lower(${distillers.name}) = ${nameCheck.value.toLowerCase()}`,
          sql`${distillers.id} <> ${id}`,
          eq(distillers.isActive, 1),
          sql`${distillers.mergedIntoId} is null`
        ))
        .limit(1)
      if (duplicate.length) {
        return NextResponse.json({ error: 'A distiller with this name already exists' }, { status: 409 })
      }

      const baseSlug = slugifyProducerName(nameCheck.value)
      let nextSlug = baseSlug
      let counter = 2
      while (await isSlugReserved('distiller', nextSlug, id)) {
        nextSlug = `${baseSlug}-${counter}`
        counter += 1
      }

      await db
        .update(distillers)
        .set({
          name: nameCheck.value,
          slug: nextSlug,
          countryId,
          region,
          descriptionFr,
          descriptionEn,
        })
        .where(eq(distillers.id, id))

      if (existing.slug && existing.slug !== nextSlug) {
        await rememberOldSlug('distiller', id, existing.slug)
      }
      return NextResponse.json({ success: true })
    }

    const existingRows = await db
      .select({ id: bottlers.id, slug: bottlers.slug, isActive: bottlers.isActive, mergedIntoId: bottlers.mergedIntoId })
      .from(bottlers)
      .where(eq(bottlers.id, id))
      .limit(1)
    const existing = existingRows?.[0]
    if (!existing) return NextResponse.json({ error: 'Bottler not found' }, { status: 404 })
    if (existing.isActive !== 1 || existing.mergedIntoId) {
      return NextResponse.json({ error: 'Bottler merged/inactive' }, { status: 400 })
    }

    const duplicate = await db
      .select({ id: bottlers.id })
      .from(bottlers)
      .where(and(
        sql`lower(${bottlers.name}) = ${nameCheck.value.toLowerCase()}`,
        sql`${bottlers.id} <> ${id}`,
        eq(bottlers.isActive, 1),
        sql`${bottlers.mergedIntoId} is null`
      ))
      .limit(1)
    if (duplicate.length) {
      return NextResponse.json({ error: 'A bottler with this name already exists' }, { status: 409 })
    }

    const baseSlug = slugifyProducerName(nameCheck.value)
    let nextSlug = baseSlug
    let counter = 2
    while (await isSlugReserved('bottler', nextSlug, id)) {
      nextSlug = `${baseSlug}-${counter}`
      counter += 1
    }

    await db
      .update(bottlers)
      .set({
        name: nameCheck.value,
        slug: nextSlug,
        countryId,
        region,
        descriptionFr,
        descriptionEn,
      })
      .where(eq(bottlers.id, id))

    if (existing.slug && existing.slug !== nextSlug) {
      await rememberOldSlug('bottler', id, existing.slug)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ admin producers patch error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
