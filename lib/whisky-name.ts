function formatAgeToken(value: number): string {
  if (!Number.isFinite(value) || value < 0) return ''
  return value === 1 ? '1 Year Old' : `${value} Years Old`
}

export function normalizeWhiskyName(input: string): string {
  const raw = String(input || '').trim()
  if (!raw) return ''

  const normalized = raw
    // Normalize variants like: 12y, 12 yo, 12 years, 12 years old -> 12 Years Old
    .replace(/\b(\d{1,3})\s*(?:y(?:\.?\s*o\.?)?|years?|yrs?)\b(?:\s*old)?/gi, (_match, age) =>
      formatAgeToken(Number(age))
    )
    .replace(/\s+/g, ' ')
    .trim()

  return normalized
}

export function isWhiskyNameAgeNormalized(input: string): boolean {
  const source = String(input || '').trim()
  if (!source) return true
  return normalizeWhiskyName(source) === source
}
