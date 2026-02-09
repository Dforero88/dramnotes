import type { Metadata } from 'next'
import { Manrope, Space_Grotesk } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'
import SessionProvider from '@/components/providers/SessionProvider'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-body' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-heading' })

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'DramNotes - Votre cave à whisky',
  description: 'Cataloguez et partagez votre collection de whiskies',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>
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
              DramNotes © 2026
            </div>
          </footer>
        </SessionProvider>
      </body>
    </html>
  )
}
