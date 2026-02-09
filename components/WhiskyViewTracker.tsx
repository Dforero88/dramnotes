'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics-client'

export default function WhiskyViewTracker({ whiskyId }: { whiskyId: string }) {
  useEffect(() => {
    if (!whiskyId) return
    trackEvent('whisky_viewed', { whisky_id: whiskyId })
  }, [whiskyId])

  return null
}
