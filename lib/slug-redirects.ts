import crypto from 'crypto'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db, bottlers, distillers, slugRedirects, whiskies } from '@/lib/db'

export type RedirectEntityType = 'whisky' | 'distiller' | 'bottler'

async function getCurrentSlug(entityType: RedirectEntityType, entityId: string): Promise<string | null> {
  if (entityType === 'whisky') {
    const rows = await db.select({ slug: whiskies.slug }).from(whiskies).where(eq(whiskies.id, entityId)).limit(1)
    return rows?.[0]?.slug || null
  }
  if (entityType === 'distiller') {
    const rows = await db.select({ slug: distillers.slug }).from(distillers).where(eq(distillers.id, entityId)).limit(1)
    return rows?.[0]?.slug || null
  }
  const rows = await db.select({ slug: bottlers.slug }).from(bottlers).where(eq(bottlers.id, entityId)).limit(1)
  return rows?.[0]?.slug || null
}

export async function resolveCurrentSlugFromLegacy(entityType: RedirectEntityType, oldSlug: string): Promise<{ entityId: string; slug: string } | null> {
  const legacy = await db
    .select({ entityId: slugRedirects.entityId })
    .from(slugRedirects)
    .where(and(eq(slugRedirects.entityType, entityType), eq(slugRedirects.oldSlug, oldSlug)))
    .orderBy(desc(slugRedirects.createdAt))
    .limit(1)

  const entityId = legacy?.[0]?.entityId
  if (!entityId) return null

  const slug = await getCurrentSlug(entityType, entityId)
  if (!slug) return null

  return { entityId, slug }
}

export async function isSlugReserved(entityType: RedirectEntityType, slug: string, excludeEntityId?: string): Promise<boolean> {
  const cleanSlug = (slug || '').trim()
  if (!cleanSlug) return false

  if (entityType === 'whisky') {
    const rows = await db
      .select({ id: whiskies.id })
      .from(whiskies)
      .where(excludeEntityId ? and(eq(whiskies.slug, cleanSlug), sql`${whiskies.id} <> ${excludeEntityId}`) : eq(whiskies.slug, cleanSlug))
      .limit(1)
    if (rows.length) return true
  } else if (entityType === 'distiller') {
    const rows = await db
      .select({ id: distillers.id })
      .from(distillers)
      .where(excludeEntityId ? and(eq(distillers.slug, cleanSlug), sql`${distillers.id} <> ${excludeEntityId}`) : eq(distillers.slug, cleanSlug))
      .limit(1)
    if (rows.length) return true
  } else {
    const rows = await db
      .select({ id: bottlers.id })
      .from(bottlers)
      .where(excludeEntityId ? and(eq(bottlers.slug, cleanSlug), sql`${bottlers.id} <> ${excludeEntityId}`) : eq(bottlers.slug, cleanSlug))
      .limit(1)
    if (rows.length) return true
  }

  const legacyRows = await db
    .select({ id: slugRedirects.id })
    .from(slugRedirects)
    .where(
      excludeEntityId
        ? and(eq(slugRedirects.entityType, entityType), eq(slugRedirects.oldSlug, cleanSlug), sql`${slugRedirects.entityId} <> ${excludeEntityId}`)
        : and(eq(slugRedirects.entityType, entityType), eq(slugRedirects.oldSlug, cleanSlug))
    )
    .limit(1)

  return legacyRows.length > 0
}

export async function rememberOldSlug(entityType: RedirectEntityType, entityId: string, oldSlug: string) {
  const cleanOldSlug = (oldSlug || '').trim()
  if (!cleanOldSlug) return

  try {
    await db.insert(slugRedirects).values({
      id: crypto.randomUUID(),
      entityType,
      entityId,
      oldSlug: cleanOldSlug,
      createdAt: new Date(),
    })
  } catch {
    // unique collision means redirect already exists; safe to ignore
  }
}
