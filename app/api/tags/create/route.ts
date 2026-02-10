import { NextRequest, NextResponse } from 'next/server'
import { db, tags, tagLang } from '@/lib/db'
import { and, eq, sql } from 'drizzle-orm'
import { generateId } from '@/lib/db'
import { validateTagName } from '@/lib/moderation'
import { buildRateLimitKey, rateLimit } from '@/lib/rate-limit'

async function translateWithDeepL(text: string, sourceLang: string, targetLang: string) {
  const apiKey = process.env.DEEPL_API_KEY
  if (!apiKey) return null
  const url = process.env.DEEPL_API_URL || 'https://api-free.deepl.com/v2/translate'
  const params = new URLSearchParams()
  params.set('text', text)
  params.set('source_lang', sourceLang.toUpperCase())
  params.set('target_lang', targetLang.toUpperCase())

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `DeepL-Auth-Key ${apiKey}`,
    },
    body: params.toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('❌ DeepL error:', res.status, err)
    return null
  }
  const json = await res.json()
  return json?.translations?.[0]?.text || null
}

export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(request, {
      key: buildRateLimitKey(request, null, 'tags-create'),
      windowMs: 60 * 60 * 1000,
      max: 30,
    })
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Trop de requêtes. Réessayez plus tard.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      )
    }

    const body = await request.json()
    const nameRaw = String(body?.name || '').trim()
    const rawLang = (body?.lang || 'fr').trim()
    const lang = rawLang.split('-')[0].split('_')[0].toLowerCase()

    const tagCheck = await validateTagName(nameRaw)
    if (!tagCheck.ok) {
      return NextResponse.json({ error: tagCheck.message || 'Tag invalide' }, { status: 400 })
    }

    const name = tagCheck.value.toLowerCase()

    const existing = await db
      .select({ id: tagLang.tagId, name: tagLang.name })
      .from(tagLang)
      .where(and(eq(tagLang.lang, lang), sql`lower(${tagLang.name}) = ${name}`))
      .limit(1)

    if (existing.length > 0) {
      return NextResponse.json({ tag: existing[0] })
    }

    const id = generateId()
    await db.insert(tags).values({ id })
    await db.insert(tagLang).values({ tagId: id, lang, name })

    const targetLang = lang === 'fr' ? 'en' : 'fr'
    const translated = await translateWithDeepL(name, lang, targetLang)
    if (translated) {
      await db.insert(tagLang).values({
        tagId: id,
        lang: targetLang,
        name: translated.toLowerCase(),
      })
    }

    return NextResponse.json({ tag: { id, name } })
  } catch (error) {
    console.error('❌ Erreur create tag:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
