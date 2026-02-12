const TRAILING_SUFFIXES = new Set([
  'dist',
  'distillery',
  'distillerie',
  'co',
  'company',
  'ltd',
  'limited',
  'inc',
  'corp',
  'corporation',
  'llc',
  'plc',
  'sa',
  'sas',
  'sarl',
  'gmbh',
  'ag',
  'bv',
])

const TRAILING_CONNECTORS = new Set(['&', 'and'])

function toTitleCaseWord(word: string) {
  if (!word) return word
  if (word.length <= 4 && word === word.toUpperCase()) return word
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

export function normalizeProducerName(input: string) {
  const raw = String(input || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\band\b/gi, '&')
    .replace(/[.,;:()[\]{}|/\\]+/g, ' ')
    .replace(/\s*&\s*/g, ' & ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!raw) return ''

  const words = raw.split(' ').filter(Boolean)
  while (words.length > 1) {
    const last = words[words.length - 1].toLowerCase()
    if (!TRAILING_SUFFIXES.has(last)) break
    words.pop()
  }

  while (words.length > 1) {
    const last = words[words.length - 1].toLowerCase()
    if (!TRAILING_CONNECTORS.has(last)) break
    words.pop()
  }

  if (words[0]?.toLowerCase() === 'the' && words.length > 1) {
    words.shift()
  }

  const normalized = words.map(toTitleCaseWord).join(' ').trim()
  return normalized || raw
}
