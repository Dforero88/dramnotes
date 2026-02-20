'use client'

import Link from 'next/link'
import { trackEvent } from '@/lib/analytics-client'

export default function SignupCtaLink({
  href,
  sourceContext,
  className,
  style,
  children,
}: {
  href: string
  sourceContext: string
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={() => {
        trackEvent('cta_signup_click', { source_context: sourceContext })
      }}
      className={className}
      style={style}
    >
      {children}
    </Link>
  )
}

