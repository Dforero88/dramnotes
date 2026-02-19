import { db, distillers, bottlers } from '@/lib/db'
import { and, eq, sql } from 'drizzle-orm'
import { normalizeProducerName } from '@/lib/producer-name'

type Confidence = 'high' | 'medium' | 'low'

export type ProducerResolution = {
  input: string
  normalized: string
  resolvedName: string | null
  confidence: Confidence
  suggestions: string[]
}

function canonicalize(name: string) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string) {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i += 1) dp[i][0] = i
  for (let j = 0; j <= n; j += 1) dp[0][j] = j
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }
  return dp[m][n]
}

function evaluateMatch(input: string, candidate: string): { distance: number; contains: boolean } {
  const a = canonicalize(input)
  const b = canonicalize(candidate)
  return {
    distance: levenshtein(a, b),
    contains: a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a)),
  }
}

function classifyConfidence(input: string, candidate: string, distance: number, contains: boolean): Confidence {
  const a = canonicalize(input)
  const b = canonicalize(candidate)
  const minLen = Math.min(a.length, b.length)

  if (distance === 0) return 'high'
  if (distance === 1 && minLen >= 5) return 'high'
  if (contains && minLen >= 6) return 'medium'
  if (distance === 2 && minLen >= 8) return 'medium'
  return 'low'
}

async function resolveAgainst(names: string[], rawValue: string): Promise<ProducerResolution> {
  const input = String(rawValue || '').trim()
  const normalized = normalizeProducerName(input)

  if (!normalized) {
    return {
      input,
      normalized,
      resolvedName: null,
      confidence: 'low',
      suggestions: [],
    }
  }

  const uniqueNames = Array.from(new Set(names.map((n) => String(n || '').trim()).filter(Boolean)))
  if (uniqueNames.length === 0) {
    return {
      input,
      normalized,
      resolvedName: null,
      confidence: 'low',
      suggestions: [],
    }
  }

  const ranked = uniqueNames
    .map((name) => {
      const { distance, contains } = evaluateMatch(normalized, name)
      return { name, distance, contains }
    })
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance
      if (a.contains !== b.contains) return a.contains ? -1 : 1
      return a.name.length - b.name.length
    })

  const best = ranked[0]
  const confidence = classifyConfidence(normalized, best.name, best.distance, best.contains)

  const suggestions = ranked
    .filter((r) => r.distance <= Math.max(3, Math.floor(canonicalize(normalized).length / 3)) || r.contains)
    .slice(0, 3)
    .map((r) => r.name)

  return {
    input,
    normalized,
    resolvedName: confidence === 'low' ? null : best.name,
    confidence,
    suggestions,
  }
}

export async function resolveDistillerName(rawValue: string) {
  const rows = await db
    .select({ name: distillers.name })
    .from(distillers)
    .where(and(eq(distillers.isActive, 1), sql`${distillers.mergedIntoId} is null`))
  return resolveAgainst(rows.map((r: { name: string | null }) => String(r.name || '')), rawValue)
}

export async function resolveBottlerName(rawValue: string) {
  const rows = await db
    .select({ name: bottlers.name })
    .from(bottlers)
    .where(and(eq(bottlers.isActive, 1), sql`${bottlers.mergedIntoId} is null`))
  return resolveAgainst(rows.map((r: { name: string | null }) => String(r.name || '')), rawValue)
}
