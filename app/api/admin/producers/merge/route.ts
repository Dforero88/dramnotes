import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { and, eq } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'
import { db, bottlers, distillers, entityChangeLogItems, entityChangeLogs, isMysql, slugRedirects, whiskies } from '@/lib/db'

export const dynamic = 'force-dynamic'

type MergeKind = 'distiller' | 'bottler'

async function insertLegacySlug(qx: any, entityType: MergeKind, entityId: string, oldSlug: string | null | undefined) {
  const clean = (oldSlug || '').trim()
  if (!clean) return
  try {
    await qx.insert(slugRedirects).values({
      id: crypto.randomUUID(),
      entityType,
      entityId,
      oldSlug: clean,
      createdAt: new Date(),
    })
  } catch {
    // already exists
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const kind = body?.kind === 'bottler' ? 'bottler' : 'distiller'
    const sourceId = typeof body?.sourceId === 'string' ? body.sourceId.trim() : ''
    const targetId = typeof body?.targetId === 'string' ? body.targetId.trim() : ''
    const dryRun = Boolean(body?.dryRun)

    if (!sourceId || !targetId) return NextResponse.json({ error: 'Missing source/target' }, { status: 400 })
    if (sourceId === targetId) return NextResponse.json({ error: 'Source and target must be different' }, { status: 400 })

    if (kind === 'distiller') {
      const [sourceRows, targetRows] = await Promise.all([
        db
          .select({ id: distillers.id, name: distillers.name, slug: distillers.slug, isActive: distillers.isActive, mergedIntoId: distillers.mergedIntoId })
          .from(distillers)
          .where(eq(distillers.id, sourceId))
          .limit(1),
        db
          .select({ id: distillers.id, name: distillers.name, slug: distillers.slug, isActive: distillers.isActive, mergedIntoId: distillers.mergedIntoId })
          .from(distillers)
          .where(eq(distillers.id, targetId))
          .limit(1),
      ])

      const source = sourceRows?.[0]
      const target = targetRows?.[0]
      if (!source || !target) return NextResponse.json({ error: 'Distiller not found' }, { status: 404 })
      if (source.isActive !== 1 || source.mergedIntoId) return NextResponse.json({ error: 'Source distiller already merged/inactive' }, { status: 400 })
      if (target.isActive !== 1 || target.mergedIntoId) return NextResponse.json({ error: 'Target distiller is merged/inactive' }, { status: 400 })

      const movedWhiskies = await db
        .select({ id: whiskies.id, name: whiskies.name })
        .from(whiskies)
        .where(eq(whiskies.distillerId, sourceId))

      if (dryRun) {
        return NextResponse.json({
          success: true,
          kind,
          source: { id: source.id, name: source.name, slug: source.slug },
          target: { id: target.id, name: target.name, slug: target.slug },
          movedCount: movedWhiskies.length,
          whiskies: movedWhiskies,
        })
      }

      const executeDistillerMerge = async (qx: any) => {
        await qx.update(whiskies).set({ distillerId: targetId }).where(eq(whiskies.distillerId, sourceId))
        await qx.update(distillers).set({ isActive: 0, mergedIntoId: targetId }).where(eq(distillers.id, sourceId))
        await qx.update(slugRedirects).set({ entityId: targetId }).where(and(eq(slugRedirects.entityType, 'distiller'), eq(slugRedirects.entityId, sourceId)))
        await insertLegacySlug(qx, 'distiller', targetId, source.slug)

        const logId = crypto.randomUUID()
        await qx.insert(entityChangeLogs).values({
          id: logId,
          eventType: 'merge_distiller',
          actorUserId: session?.user?.id || 'system',
          sourceEntityType: 'distiller',
          sourceEntityId: sourceId,
          targetEntityType: 'distiller',
          targetEntityId: targetId,
          payloadJson: JSON.stringify({
            sourceName: source.name,
            targetName: target.name,
            sourceSlug: source.slug,
            targetSlug: target.slug,
            movedCount: movedWhiskies.length,
          }),
          createdAt: new Date(),
        })

        if (movedWhiskies.length) {
          await qx.insert(entityChangeLogItems).values(
            movedWhiskies.map((w: { id: string; name: string }) => ({
              id: crypto.randomUUID(),
              logId,
              itemType: 'whisky',
              itemId: w.id,
              payloadJson: JSON.stringify({ whiskyName: w.name, oldDistillerId: sourceId, newDistillerId: targetId }),
            }))
          )
        }
      }

      if (isMysql) {
        await db.transaction(async (tx: any) => {
          await executeDistillerMerge(tx)
        })
      } else {
        db.transaction((tx: any) => {
          tx.update(whiskies).set({ distillerId: targetId }).where(eq(whiskies.distillerId, sourceId)).run()
          tx.update(distillers).set({ isActive: 0, mergedIntoId: targetId }).where(eq(distillers.id, sourceId)).run()
          tx.update(slugRedirects).set({ entityId: targetId }).where(and(eq(slugRedirects.entityType, 'distiller'), eq(slugRedirects.entityId, sourceId))).run()
          if (source.slug) {
            try {
              tx.insert(slugRedirects).values({
                id: crypto.randomUUID(),
                entityType: 'distiller',
                entityId: targetId,
                oldSlug: source.slug,
                createdAt: new Date(),
              }).run()
            } catch {
              // already exists
            }
          }

          const logId = crypto.randomUUID()
          tx.insert(entityChangeLogs).values({
            id: logId,
            eventType: 'merge_distiller',
            actorUserId: session?.user?.id || 'system',
            sourceEntityType: 'distiller',
            sourceEntityId: sourceId,
            targetEntityType: 'distiller',
            targetEntityId: targetId,
            payloadJson: JSON.stringify({
              sourceName: source.name,
              targetName: target.name,
              sourceSlug: source.slug,
              targetSlug: target.slug,
              movedCount: movedWhiskies.length,
            }),
            createdAt: new Date(),
          }).run()

          for (const w of movedWhiskies) {
            tx.insert(entityChangeLogItems).values({
              id: crypto.randomUUID(),
              logId,
              itemType: 'whisky',
              itemId: w.id,
              payloadJson: JSON.stringify({ whiskyName: w.name, oldDistillerId: sourceId, newDistillerId: targetId }),
            }).run()
          }
        })
      }

      return NextResponse.json({ success: true, movedCount: movedWhiskies.length })
    }

    const [sourceRows, targetRows] = await Promise.all([
      db
        .select({ id: bottlers.id, name: bottlers.name, slug: bottlers.slug, isActive: bottlers.isActive, mergedIntoId: bottlers.mergedIntoId })
        .from(bottlers)
        .where(eq(bottlers.id, sourceId))
        .limit(1),
      db
        .select({ id: bottlers.id, name: bottlers.name, slug: bottlers.slug, isActive: bottlers.isActive, mergedIntoId: bottlers.mergedIntoId })
        .from(bottlers)
        .where(eq(bottlers.id, targetId))
        .limit(1),
    ])

    const source = sourceRows?.[0]
    const target = targetRows?.[0]
    if (!source || !target) return NextResponse.json({ error: 'Bottler not found' }, { status: 404 })
    if (source.isActive !== 1 || source.mergedIntoId) return NextResponse.json({ error: 'Source bottler already merged/inactive' }, { status: 400 })
    if (target.isActive !== 1 || target.mergedIntoId) return NextResponse.json({ error: 'Target bottler is merged/inactive' }, { status: 400 })

    const movedWhiskies = await db
      .select({ id: whiskies.id, name: whiskies.name })
      .from(whiskies)
      .where(eq(whiskies.bottlerId, sourceId))

    if (dryRun) {
      return NextResponse.json({
        success: true,
        kind,
        source: { id: source.id, name: source.name, slug: source.slug },
        target: { id: target.id, name: target.name, slug: target.slug },
        movedCount: movedWhiskies.length,
        whiskies: movedWhiskies,
      })
    }

    const executeBottlerMerge = async (qx: any) => {
      await qx.update(whiskies).set({ bottlerId: targetId }).where(eq(whiskies.bottlerId, sourceId))
      await qx.update(bottlers).set({ isActive: 0, mergedIntoId: targetId }).where(eq(bottlers.id, sourceId))
      await qx.update(slugRedirects).set({ entityId: targetId }).where(and(eq(slugRedirects.entityType, 'bottler'), eq(slugRedirects.entityId, sourceId)))
      await insertLegacySlug(qx, 'bottler', targetId, source.slug)

      const logId = crypto.randomUUID()
      await qx.insert(entityChangeLogs).values({
        id: logId,
        eventType: 'merge_bottler',
        actorUserId: session?.user?.id || 'system',
        sourceEntityType: 'bottler',
        sourceEntityId: sourceId,
        targetEntityType: 'bottler',
        targetEntityId: targetId,
        payloadJson: JSON.stringify({
          sourceName: source.name,
          targetName: target.name,
          sourceSlug: source.slug,
          targetSlug: target.slug,
          movedCount: movedWhiskies.length,
        }),
        createdAt: new Date(),
      })

      if (movedWhiskies.length) {
        await qx.insert(entityChangeLogItems).values(
          movedWhiskies.map((w: { id: string; name: string }) => ({
            id: crypto.randomUUID(),
            logId,
            itemType: 'whisky',
            itemId: w.id,
            payloadJson: JSON.stringify({ whiskyName: w.name, oldBottlerId: sourceId, newBottlerId: targetId }),
          }))
        )
      }
    }

    if (isMysql) {
      await db.transaction(async (tx: any) => {
        await executeBottlerMerge(tx)
      })
    } else {
      db.transaction((tx: any) => {
        tx.update(whiskies).set({ bottlerId: targetId }).where(eq(whiskies.bottlerId, sourceId)).run()
        tx.update(bottlers).set({ isActive: 0, mergedIntoId: targetId }).where(eq(bottlers.id, sourceId)).run()
        tx.update(slugRedirects).set({ entityId: targetId }).where(and(eq(slugRedirects.entityType, 'bottler'), eq(slugRedirects.entityId, sourceId))).run()
        if (source.slug) {
          try {
            tx.insert(slugRedirects).values({
              id: crypto.randomUUID(),
              entityType: 'bottler',
              entityId: targetId,
              oldSlug: source.slug,
              createdAt: new Date(),
            }).run()
          } catch {
            // already exists
          }
        }

        const logId = crypto.randomUUID()
        tx.insert(entityChangeLogs).values({
          id: logId,
          eventType: 'merge_bottler',
          actorUserId: session?.user?.id || 'system',
          sourceEntityType: 'bottler',
          sourceEntityId: sourceId,
          targetEntityType: 'bottler',
          targetEntityId: targetId,
          payloadJson: JSON.stringify({
            sourceName: source.name,
            targetName: target.name,
            sourceSlug: source.slug,
            targetSlug: target.slug,
            movedCount: movedWhiskies.length,
          }),
          createdAt: new Date(),
        }).run()

        for (const w of movedWhiskies) {
          tx.insert(entityChangeLogItems).values({
            id: crypto.randomUUID(),
            logId,
            itemType: 'whisky',
            itemId: w.id,
            payloadJson: JSON.stringify({ whiskyName: w.name, oldBottlerId: sourceId, newBottlerId: targetId }),
          }).run()
        }
      })
    }

    return NextResponse.json({ success: true, movedCount: movedWhiskies.length })
  } catch (error) {
    console.error('❌ admin producers merge error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
