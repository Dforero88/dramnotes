import { and, eq, or, sql } from 'drizzle-orm'
import { bottlers, countries, db, distillers, isMysql, whiskies, whiskyRelated } from '@/lib/db'

type WhiskyCore = {
  id: string
  name: string
  bottlingType: string | null
  distillerId: string | null
  bottlerId: string | null
  countryId: string | null
  region: string | null
  type: string | null
}

type DbClient = any

const DEFAULT_TOP_LIMIT = 20

function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null
  const clean = value.trim().toLowerCase()
  return clean.length ? clean : null
}

function scoreWhiskyPair(source: WhiskyCore, candidate: WhiskyCore): number {
  let score = 0

  if (normalizeText(source.type) && normalizeText(source.type) === normalizeText(candidate.type)) score += 4

  if (
    source.bottlingType === 'DB' &&
    source.distillerId &&
    candidate.distillerId &&
    source.distillerId === candidate.distillerId
  ) {
    score += 3
  }

  if (
    source.bottlingType === 'IB' &&
    source.bottlerId &&
    candidate.bottlerId &&
    source.bottlerId === candidate.bottlerId
  ) {
    score += 3
  }

  if (source.countryId && candidate.countryId && source.countryId === candidate.countryId) score += 2

  if (normalizeText(source.region) && normalizeText(source.region) === normalizeText(candidate.region)) score += 1

  return score
}

async function getWhiskyCoreById(whiskyId: string, qx: DbClient = db): Promise<WhiskyCore | null> {
  const rows = await qx
    .select({
      id: whiskies.id,
      name: whiskies.name,
      bottlingType: whiskies.bottlingType,
      distillerId: whiskies.distillerId,
      bottlerId: whiskies.bottlerId,
      countryId: whiskies.countryId,
      region: whiskies.region,
      type: whiskies.type,
    })
    .from(whiskies)
    .where(eq(whiskies.id, whiskyId))
    .limit(1)

  return rows?.[0] || null
}

async function getCandidateWhiskies(source: WhiskyCore, qx: DbClient = db): Promise<WhiskyCore[]> {
  const matchConditions: any[] = []
  if (source.type) matchConditions.push(eq(whiskies.type, source.type))
  if (source.countryId) matchConditions.push(eq(whiskies.countryId, source.countryId))
  if (normalizeText(source.region)) matchConditions.push(sql`lower(${whiskies.region}) = ${normalizeText(source.region)}`)
  if (source.bottlingType === 'DB' && source.distillerId) matchConditions.push(eq(whiskies.distillerId, source.distillerId))
  if (source.bottlingType === 'IB' && source.bottlerId) matchConditions.push(eq(whiskies.bottlerId, source.bottlerId))

  if (!matchConditions.length) return []

  const rows = await qx
    .select({
      id: whiskies.id,
      name: whiskies.name,
      bottlingType: whiskies.bottlingType,
      distillerId: whiskies.distillerId,
      bottlerId: whiskies.bottlerId,
      countryId: whiskies.countryId,
      region: whiskies.region,
      type: whiskies.type,
    })
    .from(whiskies)
    .where(and(sql`${whiskies.id} <> ${source.id}`, or(...matchConditions)))

  return rows as WhiskyCore[]
}

export async function rebuildWhiskyRelatedForOne(
  whiskyId: string,
  opts?: { topLimit?: number; qx?: DbClient }
): Promise<void> {
  const qx = opts?.qx || db
  const topLimit = opts?.topLimit || DEFAULT_TOP_LIMIT
  const source = await getWhiskyCoreById(whiskyId, qx)

  await qx.delete(whiskyRelated).where(eq(whiskyRelated.whiskyId, whiskyId))
  if (!source) return

  const candidates = await getCandidateWhiskies(source, qx)
  const ranked = candidates
    .map((candidate) => ({ candidate, score: scoreWhiskyPair(source, candidate) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.candidate.name.localeCompare(b.candidate.name)))
    .slice(0, topLimit)

  if (!ranked.length) return

  const now = new Date()
  await qx.insert(whiskyRelated).values(
    ranked.map((entry) => ({
      whiskyId: whiskyId,
      relatedWhiskyId: entry.candidate.id,
      score: entry.score,
      createdAt: now,
      updatedAt: now,
    }))
  )
}

async function collectPotentiallyImpactedIds(whiskyId: string, qx: DbClient = db): Promise<string[]> {
  const source = await getWhiskyCoreById(whiskyId, qx)
  if (!source) return [whiskyId]

  const matchConditions: any[] = []
  if (source.type) matchConditions.push(eq(whiskies.type, source.type))
  if (source.countryId) matchConditions.push(eq(whiskies.countryId, source.countryId))
  if (normalizeText(source.region)) matchConditions.push(sql`lower(${whiskies.region}) = ${normalizeText(source.region)}`)
  if (source.distillerId) matchConditions.push(eq(whiskies.distillerId, source.distillerId))
  if (source.bottlerId) matchConditions.push(eq(whiskies.bottlerId, source.bottlerId))

  if (!matchConditions.length) return [whiskyId]

  const rows = await qx
    .select({ id: whiskies.id })
    .from(whiskies)
    .where(or(...matchConditions))

  const uniq = new Set<string>([whiskyId, ...rows.map((r: { id: string }) => r.id)])
  return Array.from(uniq)
}

export async function rebuildWhiskyRelatedForImpactCluster(
  whiskyId: string,
  opts?: { topLimit?: number; qx?: DbClient }
): Promise<number> {
  const qx = opts?.qx || db
  const ids = await collectPotentiallyImpactedIds(whiskyId, qx)
  for (const id of ids) {
    await rebuildWhiskyRelatedForOne(id, { topLimit: opts?.topLimit, qx })
  }
  return ids.length
}

export async function rebuildWhiskyRelatedForMany(
  whiskyIds: string[],
  opts?: { topLimit?: number; qx?: DbClient }
): Promise<number> {
  const qx = opts?.qx || db
  const seeds = Array.from(new Set(whiskyIds.filter(Boolean)))
  const impacted = new Set<string>()

  for (const id of seeds) {
    const cluster = await collectPotentiallyImpactedIds(id, qx)
    for (const clusterId of cluster) impacted.add(clusterId)
  }

  for (const id of impacted) {
    await rebuildWhiskyRelatedForOne(id, { topLimit: opts?.topLimit, qx })
  }

  return impacted.size
}

export async function rebuildWhiskyRelatedForAll(opts?: { topLimit?: number; qx?: DbClient }): Promise<number> {
  const qx = opts?.qx || db
  const allWhiskies = await qx.select({ id: whiskies.id }).from(whiskies)
  for (const row of allWhiskies) {
    await rebuildWhiskyRelatedForOne(row.id, { topLimit: opts?.topLimit, qx })
  }
  return allWhiskies.length
}

export async function getRelatedWhiskiesForDisplay(
  whiskyId: string,
  locale: 'fr' | 'en',
  limit = 4
): Promise<
  {
    id: string
    slug: string
    name: string
    imageUrl: string | null
    type: string | null
    score: number
    distillerName: string | null
    bottlerName: string | null
    bottlingType: string | null
    countryName: string | null
  }[]
> {
  const rows = await db
    .select({
      id: whiskies.id,
      slug: whiskies.slug,
      name: whiskies.name,
      imageUrl: sql<string | null>`coalesce(${whiskies.bottleImageUrl}, ${whiskies.imageUrl})`,
      type: whiskies.type,
      score: whiskyRelated.score,
      distillerName: distillers.name,
      bottlerName: bottlers.name,
      bottlingType: whiskies.bottlingType,
      countryName: sql<string | null>`${locale === 'fr' ? countries.nameFr : countries.name}`,
    })
    .from(whiskyRelated)
    .innerJoin(
      whiskies,
      isMysql
        ? sql`binary ${whiskies.id} = binary ${whiskyRelated.relatedWhiskyId}`
        : eq(whiskies.id, whiskyRelated.relatedWhiskyId)
    )
    .leftJoin(distillers, eq(distillers.id, whiskies.distillerId))
    .leftJoin(bottlers, eq(bottlers.id, whiskies.bottlerId))
    .leftJoin(countries, eq(countries.id, whiskies.countryId))
    .where(eq(whiskyRelated.whiskyId, whiskyId))
    .orderBy(sql`${whiskyRelated.score} desc`, sql`lower(${whiskies.name}) asc`)
    .limit(limit)

  return rows.map((row: any) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    imageUrl: row.imageUrl,
    type: row.type,
    score: Number(row.score || 0),
    distillerName: row.distillerName,
    bottlerName: row.bottlerName,
    bottlingType: row.bottlingType,
    countryName: row.countryName,
  }))
}
