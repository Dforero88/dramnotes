export function slugifyWhiskyName(name: string): string {
  const slug = (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return slug || 'whisky'
}

export function extractWhiskyUuidFromParam(param: string): string | null {
  const value = (param || '').trim()
  const match = value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  return match ? value : null
}

export function buildWhiskyPath(locale: string, _id: string, name?: string | null, slug?: string | null): string {
  const finalSlug = (slug || '').trim() || slugifyWhiskyName(name || '')
  return `/${locale}/whisky/${finalSlug}`
}
