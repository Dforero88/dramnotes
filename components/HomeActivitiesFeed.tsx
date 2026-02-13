'use client'

import Link from 'next/link'
import { trackEvent } from '@/lib/analytics-client'
import type { Locale } from '@/lib/i18n'
import { buildWhiskyPath } from '@/lib/whisky-url'

type ActivityItem = {
  id: string
  type: string
  createdAt: string | number | Date | null
  actorPseudo: string | null
  targetId: string
  whiskyName: string | null
  whiskyImageUrl: string | null
  whiskyType: string | null
  countryName: string | null
  bottlingType: string | null
  distillerName: string | null
  bottlerName: string | null
  location: string | null
  rating: number | null
  shelfStatus: string | null
}

function buildAvatar(pseudo: string) {
  const colors = [
    '#3498db', '#2ecc71', '#e74c3c', '#f39c12',
    '#9b59b6', '#1abc9c', '#d35400', '#c0392b',
    '#8e44ad', '#27ae60', '#2980b9', '#f1c40f',
  ]
  let hash = 0
  for (let i = 0; i < pseudo.length; i += 1) {
    hash = ((hash << 5) - hash) + pseudo.charCodeAt(i)
    hash |= 0
  }
  const color = colors[Math.abs(hash) % colors.length]
  const initial = pseudo.charAt(0).toUpperCase()
  return { color, initial }
}

function normalizeImage(url?: string | null) {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('/')) return url
  return `/${url}`
}

type Props = {
  locale: Locale
  activities: ActivityItem[]
  labels: {
    noActivity: string
    activityNote: string
    activityWhiskyAdded: string
    activityShelfAdded: string
    activityShelfWishlist: string
  }
}

function normalizeActivityDate(value: string | number | Date | null) {
  if (!value) return null
  if (value instanceof Date) {
    const time = value.getTime()
    if (!Number.isFinite(time)) return null
    if (time > Date.now() + 1000 * 60 * 60 * 24 * 365) {
      return new Date(Math.floor(time / 1000))
    }
    return value
  }
  if (typeof value === 'number') {
    return new Date(value < 1e12 ? value * 1000 : value)
  }
  if (typeof value === 'string') {
    const numeric = Number(value)
    if (!Number.isNaN(numeric)) {
      return new Date(numeric < 1e12 ? numeric * 1000 : numeric)
    }
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

function formatRelativeDate(date: Date | null, locale: Locale) {
  if (!date) return ''
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const diffMs = date.getTime() - Date.now()
  const diffSeconds = Math.round(diffMs / 1000)
  const divisions: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.34524, unit: 'week' },
    { amount: 12, unit: 'month' },
  ]

  let duration = diffSeconds
  for (let i = 0; i < divisions.length; i += 1) {
    const division = divisions[i]
    if (Math.abs(duration) < division.amount) {
      return rtf.format(duration, division.unit)
    }
    duration = Math.round(duration / division.amount)
  }

  return rtf.format(duration, 'year')
}

export default function HomeActivitiesFeed({ locale, activities, labels }: Props) {
  const onActivityClick = (activity: ActivityItem, pseudo: string) => {
    trackEvent('activity_click', {
      activity_type: activity.type,
      whisky_id: activity.targetId,
      profile_pseudo: pseudo,
    })

    if (activity.type === 'new_note') {
      trackEvent('activity_new_note_click', {
        whisky_id: activity.targetId,
        profile_pseudo: pseudo,
      })
    }
    if (activity.type === 'new_whisky') {
      trackEvent('activity_new_whisky_click', {
        whisky_id: activity.targetId,
        profile_pseudo: pseudo,
      })
    }
    if (activity.type === 'shelf_add') {
      trackEvent('activity_shelf_add_click', {
        whisky_id: activity.targetId,
        profile_pseudo: pseudo,
      })
    }
  }

  if (activities.length === 0) {
    return <div className="text-sm text-gray-500">{labels.noActivity}</div>
  }

  return (
    <>
      {activities.map((activity) => {
        const pseudo = activity.actorPseudo || 'User'
        const avatar = buildAvatar(pseudo)
        const isNewWhisky = activity.type === 'new_whisky'
        const isShelfAdd = activity.type === 'shelf_add'
        const title = isNewWhisky
          ? labels.activityWhiskyAdded
          : isShelfAdd
            ? activity.shelfStatus === 'wishlist'
              ? `${labels.activityShelfAdded} (${labels.activityShelfWishlist})`
              : labels.activityShelfAdded
            : labels.activityNote
        const href = `${buildWhiskyPath(locale, activity.targetId, activity.whiskyName || undefined)}?user=${encodeURIComponent(pseudo)}`
        const whiskyImage = normalizeImage(activity.whiskyImageUrl)
        const rawProducerName = activity.bottlingType === 'DB'
          ? activity.distillerName
          : activity.bottlerName
        const producerName = (() => {
          const cleaned = rawProducerName?.trim()
          if (cleaned && cleaned !== '-') return cleaned
          const fallback = (activity.distillerName || activity.bottlerName || '').trim()
          return fallback && fallback !== '-' ? fallback : ''
        })()
        const noteLocation = (() => {
          const cleaned = (activity.location || '').trim()
          return cleaned && cleaned !== '-' ? cleaned : ''
        })()
        const activityDate = formatRelativeDate(normalizeActivityDate(activity.createdAt), locale)

        return (
          <Link
            key={activity.id}
            href={href}
            onClick={() => onActivityClick(activity, pseudo)}
            className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 hover:border-gray-200 hover:shadow-sm transition"
          >
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                style={{ backgroundColor: avatar.color }}
              >
                {avatar.initial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-gray-500 flex items-center gap-1">
                  <span className="font-medium text-gray-700">{pseudo}</span>
                  <span>{title}</span>
                </div>
                <div className="mt-2 flex items-stretch gap-3 min-w-0">
                  <div className="w-14 h-20 sm:w-20 sm:min-h-[96px] rounded-lg border border-gray-200 bg-white overflow-hidden flex items-center justify-center shrink-0">
                    {whiskyImage ? (
                      <img
                        src={whiskyImage}
                        alt={activity.whiskyName || ''}
                        className="w-full h-full object-contain"
                        style={{ backgroundColor: '#fff' }}
                      />
                    ) : (
                      <span className="text-[10px] text-gray-400">—</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <div className="text-base font-semibold text-gray-900 min-w-0 flex-1 leading-tight break-words" style={{ fontFamily: 'var(--font-heading)' }}>
                        {activity.whiskyName || '—'}
                      </div>
                      {!isNewWhisky && !isShelfAdd && activity.rating ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-2 py-1 text-xs leading-none font-semibold shrink-0">
                          ★ {activity.rating}/10
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                      {activity.whiskyType ? <span>{activity.whiskyType}</span> : null}
                      {activity.countryName ? <span>· {activity.countryName}</span> : null}
                    </div>
                    {isNewWhisky || isShelfAdd ? (
                      producerName ? (
                        <div className="text-xs text-gray-500 break-words">{producerName}</div>
                      ) : null
                    ) : noteLocation ? (
                      <div className="text-xs text-gray-500 break-words">{noteLocation}</div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-400 leading-none whitespace-nowrap shrink-0 self-end sm:self-start">
              {activityDate}
            </div>
          </Link>
        )
      })}
    </>
  )
}
