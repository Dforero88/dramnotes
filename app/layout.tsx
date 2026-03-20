import type { Metadata } from 'next'
import { Manrope, Space_Grotesk } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'
import SessionProvider from '@/components/providers/SessionProvider'
import Script from 'next/script'
import SiteFooter from '@/components/SiteFooter'
import GuestSignupNudge from '@/components/GuestSignupNudge'
import { cookies, headers } from 'next/headers'
import { getServerSession } from 'next-auth'
import AnalyticsConsentBanner from '@/components/AnalyticsConsentBanner'
import { ANALYTICS_CONSENT_COOKIE, isAnalyticsConsent } from '@/lib/analytics-consent'
import { authOptions } from '@/lib/auth'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-body' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-heading' })

const siteUrl = process.env.APP_URL || 'https://dramnotes.com'
const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'
const gitSha = (process.env.NEXT_PUBLIC_GIT_SHA || '').trim()
const buildLabel = gitSha ? `v${appVersion} (${gitSha})` : `v${appVersion}`
const gaId = process.env.NEXT_PUBLIC_GA_ID?.trim()
const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim()

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'DramNotes',
    template: '%s · DramNotes',
  },
  description: 'Cataloguez et partagez votre collection de whiskies',
  openGraph: {
    type: 'website',
    siteName: 'DramNotes',
    url: siteUrl,
    title: 'DramNotes',
    description: 'Cataloguez et partagez votre collection de whiskies',
  },
  alternates: {
    canonical: siteUrl,
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headerList = await headers()
  const cookieStore = await cookies()
  const requestLocale = headerList.get('x-dramnotes-locale')
  const htmlLang = requestLocale === 'en' ? 'en' : 'fr'
  const analyticsConsentRaw = cookieStore.get(ANALYTICS_CONSENT_COOKIE)?.value
  const analyticsConsent = isAnalyticsConsent(analyticsConsentRaw) ? analyticsConsentRaw : null
  const shouldLoadAnalytics = Boolean((gaId || googleAdsId) && analyticsConsent === 'accepted')
  const gtagBootstrapId = gaId || googleAdsId
  const session = await getServerSession(authOptions)

  return (
    <html lang={htmlLang}>
      <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>
        {shouldLoadAnalytics && (
          <>
            <Script
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${gtagBootstrapId}`}
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                ${gaId ? `gtag('config', '${gaId}', { anonymize_ip: true });` : ''}
                ${googleAdsId ? `gtag('config', '${googleAdsId}');` : ''}
              `}
            </Script>
          </>
        )}
        <SessionProvider session={session}>
          <Navigation />
          <main className="min-h-screen">
            {children}
          </main>
          {!analyticsConsent && <AnalyticsConsentBanner locale={htmlLang} />}
          <GuestSignupNudge />
          <SiteFooter buildLabel={buildLabel} />
        </SessionProvider>
      </body>
    </html>
  )
}
