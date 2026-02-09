import { db, moderationTerms } from '@/lib/db'
import { eq } from 'drizzle-orm'

export type ModerationIssue = { field: string; message: string }

type TermRow = { term: string; category: string; lang: string; active: number }

const DEFAULT_TERMS: TermRow[] = [
  { term: 'fuck', category: 'insult', lang: 'en', active: 1 },
  { term: 'shit', category: 'insult', lang: 'en', active: 1 },
  { term: 'bitch', category: 'insult', lang: 'en', active: 1 },
  { term: 'asshole', category: 'insult', lang: 'en', active: 1 },
  { term: 'cunt', category: 'insult', lang: 'en', active: 1 },
  { term: 'dick', category: 'sexual', lang: 'en', active: 1 },
  { term: 'pussy', category: 'sexual', lang: 'en', active: 1 },
  { term: 'slut', category: 'sexual', lang: 'en', active: 1 },
  { term: 'whore', category: 'sexual', lang: 'en', active: 1 },
  { term: 'porn', category: 'sexual', lang: 'en', active: 1 },
  { term: 'rape', category: 'sexual', lang: 'en', active: 1 },
  { term: 'rapist', category: 'sexual', lang: 'en', active: 1 },
  { term: 'nazi', category: 'hate', lang: 'en', active: 1 },
  { term: 'hitler', category: 'hate', lang: 'en', active: 1 },
  { term: 'racist', category: 'hate', lang: 'en', active: 1 },
  { term: 'nigger', category: 'hate', lang: 'en', active: 1 },
  { term: 'faggot', category: 'hate', lang: 'en', active: 1 },
  { term: 'pute', category: 'insult', lang: 'fr', active: 1 },
  { term: 'putain', category: 'insult', lang: 'fr', active: 1 },
  { term: 'salope', category: 'insult', lang: 'fr', active: 1 },
  { term: 'connard', category: 'insult', lang: 'fr', active: 1 },
  { term: 'encule', category: 'insult', lang: 'fr', active: 1 },
  { term: 'merde', category: 'insult', lang: 'fr', active: 1 },
  { term: 'sexe', category: 'sexual', lang: 'fr', active: 1 },
  { term: 'porno', category: 'sexual', lang: 'fr', active: 1 },
  { term: 'viol', category: 'sexual', lang: 'fr', active: 1 },
  { term: 'violeur', category: 'sexual', lang: 'fr', active: 1 },
  { term: 'raciste', category: 'hate', lang: 'fr', active: 1 },
  { term: 'nazi', category: 'hate', lang: 'fr', active: 1 },
  { term: 'hitler', category: 'hate', lang: 'fr', active: 1 },
  { term: 'sale juif', category: 'hate', lang: 'fr', active: 1 },
  { term: 'sale arabe', category: 'hate', lang: 'fr', active: 1 },
  { term: 'sale noir', category: 'hate', lang: 'fr', active: 1 },
]

let cachedTerms: TermRow[] | null = null
let cachedAt = 0

async function loadTerms(): Promise<TermRow[]> {
  const now = Date.now()
  if (cachedTerms && now - cachedAt < 5 * 60 * 1000) return cachedTerms

  try {
    const rows = await db
      .select({ term: moderationTerms.term, category: moderationTerms.category, lang: moderationTerms.lang, active: moderationTerms.active })
      .from(moderationTerms)
      .where(eq(moderationTerms.active, 1))

    if (rows && rows.length > 0) {
      cachedTerms = rows as TermRow[]
      cachedAt = now
      return cachedTerms
    }
  } catch (err) {
    // fallback on default list
  }

  cachedTerms = DEFAULT_TERMS
  cachedAt = now
  return cachedTerms
}

export function sanitizeText(value: string, maxLength: number) {
  const trimmed = value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001F\u007F]/g, '').trim()
  const collapsed = trimmed.replace(/\s+/g, ' ')
  return collapsed.slice(0, maxLength)
}

function normalizeForModeration(value: string) {
  const lower = value.toLowerCase()
  const normalized = lower.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  const leet = normalized
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b')
  const cleaned = leet.replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim()
  return ` ${cleaned} `
}

async function hasBannedTerm(value: string) {
  const terms = await loadTerms()
  const normalized = normalizeForModeration(value)
  return terms.some((term) => {
    const needle = normalizeForModeration(term.term).trim()
    if (!needle) return false
    return normalized.includes(` ${needle} `)
  })
}

export async function validatePseudo(pseudo: string) {
  const cleaned = sanitizeText(pseudo, 20)
  if (cleaned.length < 3) return { ok: false, value: cleaned, message: 'Pseudo trop court' }
  if (!/^[a-zA-Z0-9_]+$/.test(cleaned)) return { ok: false, value: cleaned, message: 'Pseudo invalide' }
  if (await hasBannedTerm(cleaned)) return { ok: false, value: cleaned, message: 'Pseudo interdit' }
  return { ok: true, value: cleaned }
}

export async function validateTagName(tag: string) {
  const cleaned = sanitizeText(tag, 40)
  if (cleaned.length < 2) return { ok: false, value: cleaned, message: 'Tag trop court' }
  if (!/^[\p{L}0-9' -]+$/u.test(cleaned)) return { ok: false, value: cleaned, message: 'Tag invalide' }
  if (await hasBannedTerm(cleaned)) return { ok: false, value: cleaned, message: 'Tag interdit' }
  return { ok: true, value: cleaned }
}

export async function validateOverall(text: string) {
  const cleaned = sanitizeText(text, 500)
  if (cleaned.length < 1) return { ok: false, value: cleaned, message: 'Overall requis' }
  if (await hasBannedTerm(cleaned)) return { ok: false, value: cleaned, message: 'Texte interdit' }
  return { ok: true, value: cleaned }
}

export async function validateWhiskyName(text: string) {
  const cleaned = sanitizeText(text, 80)
  if (cleaned.length < 2) return { ok: false, value: cleaned, message: 'Nom invalide' }
  if (await hasBannedTerm(cleaned)) return { ok: false, value: cleaned, message: 'Nom interdit' }
  return { ok: true, value: cleaned }
}

export async function validateLocation(text: string) {
  const cleaned = sanitizeText(text, 120)
  if (cleaned.length < 2) return { ok: false, value: cleaned, message: 'Location invalide' }
  if (await hasBannedTerm(cleaned)) return { ok: false, value: cleaned, message: 'Location interdite' }
  return { ok: true, value: cleaned }
}

export async function validateDisplayName(text: string, max = 80) {
  const cleaned = sanitizeText(text, max)
  if (cleaned.length < 2) return { ok: false, value: cleaned, message: 'Valeur invalide' }
  if (await hasBannedTerm(cleaned)) return { ok: false, value: cleaned, message: 'Valeur interdite' }
  return { ok: true, value: cleaned }
}

export function normalizeSearch(value: string, max = 80) {
  return sanitizeText(value, max)
}
