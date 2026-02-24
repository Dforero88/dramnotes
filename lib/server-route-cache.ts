type CacheEntry<T> = {
  expiresAt: number
  value: T
}

const routeCache = new Map<string, CacheEntry<unknown>>()
const MAX_ENTRIES = 800

function cleanupExpired(now: number) {
  for (const [key, entry] of routeCache.entries()) {
    if (entry.expiresAt <= now) {
      routeCache.delete(key)
    }
  }
}

function enforceMaxEntries() {
  if (routeCache.size <= MAX_ENTRIES) return
  const overflow = routeCache.size - MAX_ENTRIES
  const keys = routeCache.keys()
  for (let i = 0; i < overflow; i += 1) {
    const next = keys.next()
    if (next.done) break
    routeCache.delete(next.value)
  }
}

export function getRouteCache<T>(key: string): T | null {
  const now = Date.now()
  const entry = routeCache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= now) {
    routeCache.delete(key)
    return null
  }
  return entry.value as T
}

export function setRouteCache<T>(key: string, value: T, ttlSeconds: number) {
  const now = Date.now()
  if (ttlSeconds <= 0) return
  cleanupExpired(now)
  routeCache.set(key, {
    value,
    expiresAt: now + ttlSeconds * 1000,
  })
  enforceMaxEntries()
}

