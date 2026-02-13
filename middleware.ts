import { NextRequest, NextResponse } from 'next/server'

type RateRule = {
  id: string
  match: (path: string) => boolean
  windowMs: number
  max: number
}

const rules: RateRule[] = [
  {
    id: 'auth',
    match: (path) =>
      path.startsWith('/api/auth/register') ||
      path.startsWith('/api/auth/forgot-password') ||
      path.startsWith('/api/auth/reset-password'),
    windowMs: 60_000,
    max: 10,
  },
  {
    id: 'write',
    match: (path) =>
      path.startsWith('/api/tags/create') ||
      path.startsWith('/api/tasting-notes') ||
      path.startsWith('/api/follow') ||
      path.startsWith('/api/whisky/create') ||
      path.startsWith('/api/map/markers'),
    windowMs: 60_000,
    max: 30,
  },
]

const getStore = () => {
  const g = globalThis as unknown as { __rateLimitStore?: Map<string, { count: number; expiresAt: number }> }
  if (!g.__rateLimitStore) g.__rateLimitStore = new Map()
  return g.__rateLimitStore
}

function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'unknown'
}

function applyRateLimit(req: NextRequest) {
  const path = req.nextUrl.pathname
  const rule = rules.find((r) => r.match(path))
  if (!rule) return null

  const store = getStore()
  const now = Date.now()
  const key = `${rule.id}:${getClientIp(req)}:${Math.floor(now / rule.windowMs)}`

  const existing = store.get(key)
  if (!existing || existing.expiresAt < now) {
    store.set(key, { count: 1, expiresAt: now + rule.windowMs })
    return null
  }

  if (existing.count >= rule.max) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  existing.count += 1
  store.set(key, existing)
  return null
}

function withSecurityHeaders(res: NextResponse) {
  const csp = [
    "default-src 'self'",
    "img-src 'self' data: blob: https:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com https://cdnjs.cloudflare.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "connect-src 'self' https://api-free.deepl.com https://api.deepl.com https://maps.googleapis.com https://maps.gstatic.com https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://sentry.io",
    "frame-src https://www.google.com https://maps.google.com",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ')

  res.headers.set('Content-Security-Policy', csp)
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'SAMEORIGIN')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(self)')
  return res
}

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/_next/image')) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const rateLimited = applyRateLimit(req)
  if (rateLimited) return rateLimited

  const res = NextResponse.next()
  return withSecurityHeaders(res)
}

export const config = {
  matcher: ['/((?!_next/static|favicon.ico).*)'],
}
