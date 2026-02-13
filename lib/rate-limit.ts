import { NextRequest } from 'next/server'

type LimitState = { count: number; resetAt: number }

const buckets = new Map<string, LimitState>()

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return 'unknown'
}

export function buildRateLimitKey(
  request: NextRequest,
  userId?: string | null,
  bucket?: string
) {
  const path = request.nextUrl.pathname
  const subject = userId || getClientIp(request)
  return `${bucket || path}:${subject}`
}

export function rateLimit(
  request: NextRequest,
  options: { key: string; windowMs: number; max: number }
) {
  const now = Date.now()
  const current = buckets.get(options.key)

  if (!current || now > current.resetAt) {
    buckets.set(options.key, { count: 1, resetAt: now + options.windowMs })
    return { ok: true, retryAfter: 0 }
  }

  if (current.count >= options.max) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    return { ok: false, retryAfter }
  }

  current.count += 1
  buckets.set(options.key, current)
  return { ok: true, retryAfter: 0 }
}
