import crypto from 'crypto'

type MixpanelProperties = Record<string, unknown>

const MIXPANEL_EVENT_ALLOWLIST = new Set([
  'account_created',
  'account_completed',
  'user_login',
  'password_reset_requested',
  'password_reset_completed',
  'whisky_created',
  'distiller_created',
  'bottler_created',
  'tasting_note_draft_created',
  'tasting_note_published',
  'shelf_updated',
  'follow_created',
  'admin_job_run',
])

function getDistinctId(properties: MixpanelProperties) {
  const candidates = [
    properties.userId,
    properties.user_id,
    properties.actorUserId,
    properties.actor_user_id,
    properties.targetUserId,
    properties.target_user_id,
    properties.whiskyId,
    properties.whisky_id,
  ]
  for (const candidate of candidates) {
    if (candidate !== null && candidate !== undefined && String(candidate).trim()) {
      return String(candidate)
    }
  }
  return `server-${crypto.randomUUID()}`
}

export async function trackMixpanelEvent(event: string, properties: MixpanelProperties = {}) {
  if (process.env.NODE_ENV !== 'production') return
  if (!MIXPANEL_EVENT_ALLOWLIST.has(event)) return

  const token = (process.env.MIXPANEL_TOKEN || '').trim()
  if (!token) return

  const apiHost = (process.env.MIXPANEL_API_HOST || 'https://api.mixpanel.com').replace(/\/+$/, '')
  const payload = [
    {
      event,
      properties: {
        token,
        distinct_id: getDistinctId(properties),
        $insert_id: crypto.randomUUID(),
        time: Math.floor(Date.now() / 1000),
        ...properties,
      },
    },
  ]

  try {
    const response = await fetch(`${apiHost}/track?verbose=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.warn(`[mixpanel] failed "${event}"`, response.status, body)
    }
  } catch (error) {
    console.warn(`[mixpanel] failed "${event}"`, error)
  }
}
