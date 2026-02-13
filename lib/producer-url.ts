import type { Locale } from '@/lib/i18n'

export function slugifyProducerName(name: string) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 160) || 'producer'
}

export function buildDistillerPath(locale: Locale | string, slug: string) {
  return `/${locale}/distiller/${slug}`
}

export function buildBottlerPath(locale: Locale | string, slug: string) {
  return `/${locale}/bottler/${slug}`
}

