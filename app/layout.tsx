import type { Metadata } from 'next'
import { Manrope, Space_Grotesk } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'
import SessionProvider from '@/components/providers/SessionProvider'
import Script from 'next/script'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-body' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-heading' })

export const dynamic = 'force-dynamic'
export const revalidate = 0

const siteUrl = process.env.APP_URL || 'https://dramnotes.com'
const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'
const gitSha = (process.env.NEXT_PUBLIC_GIT_SHA || '').trim()
const buildLabel = gitSha ? `v${appVersion} (${gitSha})` : `v${appVersion}`

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <Script
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', { anonymize_ip: true });
              `}
            </Script>
          </>
        )}
        <SessionProvider>
          <Navigation />
          <main className="min-h-screen">
            {children}
          </main>
          <footer
            className="border-t"
            style={{ backgroundColor: 'var(--color-primary-light)' }}
          >
            <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 text-center text-sm text-gray-600">
              DramNotes © 2026 · {buildLabel}
            </div>
          </footer>
        </SessionProvider>
      </body>
    </html>
  )
}
