'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { getTranslations, type Locale } from '@/lib/i18n'

type JobRow = {
  jobKey: string
  lastRunAt: string | null
  lastStatus: string | null
  lastPreviewCount: number | null
  lastProcessedCount: number | null
  lastError: string | null
}

export default function AdminJobsPageClient() {
  const params = useParams()
  const locale = params.locale as Locale
  const t = getTranslations(locale)

  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('')
  const [previewMap, setPreviewMap] = useState<Record<string, number | null>>({})
  const [busyJobKey, setBusyJobKey] = useState<string | null>(null)

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
    [locale]
  )

  const getJobName = (jobKey: string) =>
    jobKey === 'first_note_reminder_7d' ? t('adminJobs.jobFirstNoteReminderName') : t('adminJobs.jobWhiskyRelatedName')

  const getJobDescription = (jobKey: string) =>
    jobKey === 'first_note_reminder_7d'
      ? t('adminJobs.jobFirstNoteReminderDescription')
      : t('adminJobs.jobWhiskyRelatedDescription')

  const loadJobs = async () => {
    setLoading(true)
    setFeedback('')
    try {
      const res = await fetch('/api/admin/jobs', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Error')
      setJobs(json?.jobs || [])
    } catch (error: any) {
      setFeedback(error?.message || t('common.error'))
      setJobs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadJobs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const previewJob = async (jobKey: string) => {
    setBusyJobKey(jobKey)
    setFeedback('')
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', jobKey }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Error')
      setPreviewMap((prev) => ({ ...prev, [jobKey]: Number(json?.count || 0) }))
    } catch (error: any) {
      setFeedback(error?.message || t('common.error'))
    } finally {
      setBusyJobKey(null)
    }
  }

  const runJob = async (jobKey: string) => {
    setBusyJobKey(jobKey)
    setFeedback('')
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run', jobKey }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Error')
      setFeedback(t('adminJobs.runDone').replace('{count}', String(Number(json?.processedCount || 0))))
      await loadJobs()
    } catch (error: any) {
      setFeedback(error?.message || t('common.error'))
    } finally {
      setBusyJobKey(null)
    }
  }

  const statusLabel = (value: string | null) => {
    if (value === 'success') return t('adminJobs.statusSuccess')
    if (value === 'running') return t('adminJobs.statusRunning')
    if (value === 'error') return t('adminJobs.statusError')
    return '—'
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('adminJobs.title')}</h1>
          <p className="mt-2 text-gray-600">{t('adminJobs.subtitle')}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-gray-600">
                  <th className="px-4 py-3 font-semibold">{t('adminJobs.jobLabel')}</th>
                  <th className="px-4 py-3 font-semibold">{t('adminJobs.descriptionLabel')}</th>
                  <th className="px-4 py-3 font-semibold">{t('adminJobs.lastRunLabel')}</th>
                  <th className="px-4 py-3 font-semibold">{t('adminJobs.lastStatusLabel')}</th>
                  <th className="px-4 py-3 font-semibold">{t('adminJobs.countLabel')}</th>
                  <th className="px-4 py-3 font-semibold">{t('adminJobs.processedLabel')}</th>
                  <th className="px-4 py-3 font-semibold">{t('adminJobs.lastErrorLabel')}</th>
                  <th className="px-4 py-3 font-semibold text-right">{t('adminJobs.actionsLabel')}</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.jobKey} className="border-b border-gray-100 align-top last:border-b-0">
                    <td className="px-4 py-4 font-semibold text-gray-900">{getJobName(job.jobKey)}</td>
                    <td className="px-4 py-4 text-gray-600 max-w-sm">{getJobDescription(job.jobKey)}</td>
                    <td className="px-4 py-4 text-gray-600">
                      {job.lastRunAt ? dateFormatter.format(new Date(job.lastRunAt)) : t('adminJobs.never')}
                    </td>
                    <td className="px-4 py-4 text-gray-600">{statusLabel(job.lastStatus)}</td>
                    <td className="px-4 py-4 text-gray-600">
                      {previewMap[job.jobKey] == null
                        ? job.lastPreviewCount == null
                          ? '—'
                          : job.lastPreviewCount
                        : previewMap[job.jobKey]}
                    </td>
                    <td className="px-4 py-4 text-gray-600">{job.lastProcessedCount == null ? '—' : job.lastProcessedCount}</td>
                    <td className="px-4 py-4 text-gray-600 max-w-xs">{job.lastError || '—'}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => previewJob(job.jobKey)}
                          disabled={busyJobKey === job.jobKey}
                          className="px-4 py-2 rounded-full border text-sm disabled:opacity-50"
                          style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                        >
                          {t('adminJobs.actionPreview')}
                        </button>
                        <button
                          type="button"
                          onClick={() => runJob(job.jobKey)}
                          disabled={busyJobKey === job.jobKey}
                          className="px-4 py-2 rounded-full text-sm text-white disabled:opacity-50"
                          style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                          {t('adminJobs.actionRun')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && jobs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                      {t('adminJobs.emptyCount')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {feedback ? <div className="text-sm text-gray-700">{feedback}</div> : null}
      </div>
    </div>
  )
}
