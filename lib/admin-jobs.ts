import { desc, eq, isNotNull } from 'drizzle-orm'
import { adminJobRuns, db, generateId, tastingNotes, userEngagementEmails, users, whiskies } from '@/lib/db'
import { getFirstNoteReminderEmailTemplate, sendEmail } from '@/lib/email/sender'
import { rebuildWhiskyRelatedForAll } from '@/lib/whisky-related'

export type AdminJobKey = 'first_note_reminder_7d' | 'whisky_related_rebuild'

type JobRunRow = {
  jobKey: string
  startedAt: Date | null
  finishedAt: Date | null
  status: string
  previewCount: number
  processedCount: number
  error: string | null
}

export type AdminJobSummary = {
  jobKey: AdminJobKey
  lastRunAt: string | null
  lastStatus: string | null
  lastPreviewCount: number | null
  lastProcessedCount: number | null
  lastError: string | null
}

type EligibleReminderUser = {
  id: string
  email: string
  pseudo: string | null
  preferredLocale: 'fr' | 'en'
}

const JOBS: AdminJobKey[] = ['first_note_reminder_7d', 'whisky_related_rebuild']

async function getEligibleFirstNoteReminderUsers(): Promise<EligibleReminderUser[]> {
  const allConfirmedUsers = await db
    .select({
      id: users.id,
      email: users.email,
      pseudo: users.pseudo,
      preferredLocale: users.preferredLocale,
      createdAt: users.createdAt,
      confirmedAt: users.confirmedAt,
    })
    .from(users)
    .where(isNotNull(users.confirmedAt))

  const publishedNotes = await db
    .select({ userId: tastingNotes.userId })
    .from(tastingNotes)
    .where(eq(tastingNotes.status, 'published'))

  const alreadyReminded = await db
    .select({ userId: userEngagementEmails.userId })
    .from(userEngagementEmails)
    .where(eq(userEngagementEmails.emailType, 'first_note_reminder_7d'))

  const publishedSet = new Set(publishedNotes.map((row: any) => String(row.userId)))
  const remindedSet = new Set(alreadyReminded.map((row: any) => String(row.userId)))
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  return allConfirmedUsers
    .filter((user: any) => {
      if (!user.createdAt || user.createdAt > cutoff) return false
      if (publishedSet.has(String(user.id))) return false
      if (remindedSet.has(String(user.id))) return false
      return true
    })
    .map((user: any) => ({
      id: String(user.id),
      email: String(user.email),
      pseudo: user.pseudo ? String(user.pseudo) : null,
      preferredLocale: user.preferredLocale === 'en' ? 'en' : 'fr',
    }))
}

async function getLatestRuns(): Promise<Map<string, JobRunRow>> {
  const rows = await db
    .select({
      jobKey: adminJobRuns.jobKey,
      startedAt: adminJobRuns.startedAt,
      finishedAt: adminJobRuns.finishedAt,
      status: adminJobRuns.status,
      previewCount: adminJobRuns.previewCount,
      processedCount: adminJobRuns.processedCount,
      error: adminJobRuns.error,
    })
    .from(adminJobRuns)
    .orderBy(desc(adminJobRuns.startedAt))

  const map = new Map<string, JobRunRow>()
  for (const row of rows as any[]) {
    if (!map.has(row.jobKey)) map.set(row.jobKey, row as JobRunRow)
  }
  return map
}

async function startRun(jobKey: AdminJobKey, previewCount: number) {
  const id = generateId()
  await db.insert(adminJobRuns).values({
    id,
    jobKey,
    status: 'running',
    previewCount,
    processedCount: 0,
    startedAt: new Date(),
  })
  return id
}

async function finishRun(runId: string, status: 'success' | 'error', processedCount: number, error?: string | null) {
  await db
    .update(adminJobRuns)
    .set({
      status,
      processedCount,
      error: error || null,
      finishedAt: new Date(),
    })
    .where(eq(adminJobRuns.id, runId))
}

export async function listAdminJobs(): Promise<AdminJobSummary[]> {
  const latestRuns = await getLatestRuns()
  return JOBS.map((jobKey) => {
    const run = latestRuns.get(jobKey)
    return {
      jobKey,
      lastRunAt: run?.startedAt ? new Date(run.startedAt).toISOString() : null,
      lastStatus: run?.status || null,
      lastPreviewCount: typeof run?.previewCount === 'number' ? Number(run.previewCount) : null,
      lastProcessedCount: typeof run?.processedCount === 'number' ? Number(run.processedCount) : null,
      lastError: run?.error || null,
    }
  })
}

export async function previewAdminJob(jobKey: AdminJobKey): Promise<number> {
  if (jobKey === 'first_note_reminder_7d') {
    const usersToRemind = await getEligibleFirstNoteReminderUsers()
    return usersToRemind.length
  }

  const whiskyRows = await db.select({ id: whiskies.id }).from(whiskies)
  return whiskyRows.length
}

async function runFirstNoteReminderJob(previewCount: number): Promise<number> {
  const usersToRemind = await getEligibleFirstNoteReminderUsers()
  if (!usersToRemind.length) return 0

  const appUrl = (process.env.APP_URL || 'https://dramnotes.com').replace(/\/+$/, '')
  let sent = 0

  for (const user of usersToRemind) {
    const locale = user.preferredLocale === 'en' ? 'en' : 'fr'
    const actionUrl = `${appUrl}/${locale}/login`
    const ok = await sendEmail({
      to: user.email,
      subject: locale === 'en' ? 'Your first tasting note is waiting on DramNotes' : 'Votre première note vous attend sur DramNotes',
      html: getFirstNoteReminderEmailTemplate(user.pseudo, actionUrl, locale),
    })

    if (!ok) continue

    await db.insert(userEngagementEmails).values({
      id: generateId(),
      userId: user.id,
      emailType: 'first_note_reminder_7d',
      sentAt: new Date(),
    })
    sent += 1
  }

  return Math.min(sent, previewCount)
}

async function runWhiskyRelatedRebuildJob(): Promise<number> {
  return rebuildWhiskyRelatedForAll()
}

export async function runAdminJob(jobKey: AdminJobKey): Promise<{ processedCount: number }> {
  const previewCount = await previewAdminJob(jobKey)
  const runId = await startRun(jobKey, previewCount)

  try {
    const processedCount =
      jobKey === 'first_note_reminder_7d'
        ? await runFirstNoteReminderJob(previewCount)
        : await runWhiskyRelatedRebuildJob()

    await finishRun(runId, 'success', processedCount)
    return { processedCount }
  } catch (error: any) {
    await finishRun(runId, 'error', 0, error?.message || 'Unknown error')
    throw error
  }
}

export function isAdminJobKey(value: string): value is AdminJobKey {
  return value === 'first_note_reminder_7d' || value === 'whisky_related_rebuild'
}
