import { NextRequest, NextResponse } from 'next/server'
import { buildRateLimitKey, rateLimit } from '@/lib/rate-limit'
import { sanitizeText, validateDisplayName } from '@/lib/moderation'
import { sendEmail } from '@/lib/email/sender'

export const dynamic = 'force-dynamic'

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(request, {
    key: buildRateLimitKey(request, null, 'contact-form'),
    windowMs: 10 * 60 * 1000,
    max: 10,
  })
  if (!limit.ok) {
    return NextResponse.json({ error: 'Trop de requêtes. Réessayez plus tard.' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const locale = body?.locale === 'en' ? 'en' : 'fr'
    const website = String(body?.website || '').trim()
    if (website) {
      return NextResponse.json({ success: true })
    }

    const rawName = sanitizeText(String(body?.name || ''), 80)
    const nameCheck = await validateDisplayName(rawName, 80)
    if (!nameCheck.ok) {
      return NextResponse.json({ error: locale === 'en' ? 'Invalid name' : 'Nom invalide' }, { status: 400 })
    }

    const email = sanitizeText(String(body?.email || ''), 140)
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: locale === 'en' ? 'Invalid email' : 'Email invalide' }, { status: 400 })
    }

    const subject = sanitizeText(String(body?.subject || ''), 140)
    if (!subject) {
      return NextResponse.json({ error: locale === 'en' ? 'Subject is required' : 'Sujet obligatoire' }, { status: 400 })
    }

    const message = sanitizeText(String(body?.message || ''), 4000)
    if (message.length < 5) {
      return NextResponse.json({ error: locale === 'en' ? 'Message too short' : 'Message trop court' }, { status: 400 })
    }

    const to = process.env.CONTACT_TO || process.env.SMTP_FROM || 'forerodavid88@gmail.com'
    const html = `
      <div style="font-family:Arial,sans-serif">
        <h2>Nouveau message de contact</h2>
        <p><strong>Nom:</strong> ${nameCheck.value}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Sujet:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <pre style="white-space:pre-wrap;font-family:Arial,sans-serif">${message}</pre>
      </div>
    `
    const ok = await sendEmail({
      to,
      subject: `[DramNotes Contact] ${subject}`,
      html,
    })
    if (!ok) {
      return NextResponse.json({ error: locale === 'en' ? 'Unable to send message' : 'Impossible d’envoyer le message' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ contact form error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

