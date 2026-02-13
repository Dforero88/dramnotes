export const ADMIN_FALLBACK_EMAIL = 'forerodavid88@gmail.com'

export function getAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || ''
  const envEmails = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (envEmails.length > 0) return envEmails
  return [ADMIN_FALLBACK_EMAIL]
}

export function isAdminEmail(email?: string | null) {
  if (!email) return false
  return getAdminEmails().includes(String(email).trim().toLowerCase())
}

