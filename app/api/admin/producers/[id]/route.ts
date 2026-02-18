import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { and, eq, sql } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import { db, bottlers, distillers, whiskies } from '@/lib/db'
import { isAdminEmail } from '@/lib/admin'
import { normalizeProducerName } from '@/lib/producer-name'
import { validateDisplayName, validateWhiskyName } from '@/lib/moderation'
import { normalizeWhiskyName } from '@/lib/whisky-name'
import { slugifyWhiskyName } from '@/lib/whisky-url'

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
      const nameRaw = typeof body?.name === 'string' ? body.name.trim() : ''
      if (!nameRaw) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
      const normalizedName = normalizeWhiskyName(nameRaw)
      const nameCheck = await validateWhiskyName(normalizedName)
      if (!nameCheck.ok) return NextResponse.json({ error: nameCheck.message || 'Invalid name' }, { status: 400 })

      const baseSlug = slugifyWhiskyName(nameCheck.value)
      let nextSlug = baseSlug
      let counter = 2
      while (true) {
        const duplicate = await db
          .select({ id: whiskies.id })
          .from(whiskies)
          .where(and(eq(whiskies.slug, nextSlug), sql`${whiskies.id} <> ${id}`))
          .limit(1)
        if (!duplicate.length) break
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
          countryId,
          region,
          type,
        })
        .where(eq(whiskies.id, id))

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
      const duplicate = await db
        .select({ id: distillers.id })
        .from(distillers)
        .where(and(sql`lower(${distillers.name}) = ${nameCheck.value.toLowerCase()}`, sql`${distillers.id} <> ${id}`))
        .limit(1)
      if (duplicate.length) {
        return NextResponse.json({ error: 'A distiller with this name already exists' }, { status: 409 })
      }

      await db
        .update(distillers)
        .set({
          name: nameCheck.value,
          countryId,
          region,
          descriptionFr,
          descriptionEn,
        })
        .where(eq(distillers.id, id))
      return NextResponse.json({ success: true })
    }

    const duplicate = await db
      .select({ id: bottlers.id })
      .from(bottlers)
      .where(and(sql`lower(${bottlers.name}) = ${nameCheck.value.toLowerCase()}`, sql`${bottlers.id} <> ${id}`))
      .limit(1)
    if (duplicate.length) {
      return NextResponse.json({ error: 'A bottler with this name already exists' }, { status: 409 })
    }

    await db
      .update(bottlers)
      .set({
        name: nameCheck.value,
        countryId,
        region,
        descriptionFr,
        descriptionEn,
      })
      .where(eq(bottlers.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ admin producers patch error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
