'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { getTranslations, type Locale } from '@/lib/i18n'

export default function Navigation() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  
  // Détecter la locale depuis l'URL
  const detectLocale = (): Locale => {
    if (pathname.startsWith('/en')) return 'en'
    if (pathname.startsWith('/fr')) return 'fr'
    return 'fr' // default
  }
  
  const [locale, setLocale] = useState<Locale>(detectLocale())
  const [mobileOpen, setMobileOpen] = useState(false)
  const t = getTranslations(locale) // <-- Fonction maintenant !
  
  // Changer de langue
  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale)
    
    // Sauvegarder dans localStorage
    localStorage.setItem('preferred-locale', newLocale)
    
    // Changer l'URL
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`)
    router.push(newPath)
  }
  
  // Initialiser depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem('preferred-locale') as Locale
    if (saved && (saved === 'fr' || saved === 'en')) {
      setLocale(saved)
    }
  }, [])
  
  return (
    <header>
      {/* Barre supérieure */}
      <div className="bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="container mx-auto px-6 py-4 grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex items-center gap-4">
            <button
              className="md:hidden p-2.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition"
              style={{ color: 'var(--color-primary)' }}
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              ☰
            </button>

            <div className="hidden md:block">
              <select 
                value={locale}
                onChange={(e) => changeLocale(e.target.value as Locale)}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white"
              >
                <option value="fr">🇫🇷 Français</option>
                <option value="en">🇬🇧 English</option>
              </select>
            </div>

          </div>

          <div className="justify-self-center">
            <Link href={`/${locale}`}>
              <Image 
                src="/logo.webp" 
                alt="DramNotes" 
                width={150} 
                height={60}
                className="object-contain"
              />
            </Link>
          </div>

          <div className="flex items-center justify-end gap-4">
            <div className="hidden md:flex items-center gap-4">
              {session ? (
                <>
                  <span className="text-gray-600 hidden lg:inline">
                    {t('navigation.welcome')}, {session.user?.name || session.user?.email}
                  </span>
                  <button 
                    onClick={() => signOut()}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark-light"
                  >
                    {t('navigation.signOut')}
                  </button>
                </>
              ) : (
                <>
                  <Link 
                    href={`/${locale}/login`} 
                    className="px-4 py-2 text-primary hover:text-primary-dark-light"
                  >
                    {t('navigation.signIn')}
                  </Link>
                  <Link 
                    href={`/${locale}/register`} 
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark-light"
                  >
                    {t('navigation.signUp')}
                  </Link>
                </>
              )}
            </div>

            {session ? (
              <button
                onClick={() => signOut()}
                className="md:hidden p-2.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition"
                style={{ color: 'var(--color-primary)' }}
                aria-label="Logout"
                title={t('navigation.signOut')}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <path d="M10 17l5-5-5-5" />
                  <path d="M15 12H3" />
                </svg>
              </button>
            ) : (
              <Link
                href={`/${locale}/login`}
                className="md:hidden p-2.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition"
                style={{ color: 'var(--color-primary)' }}
                aria-label="Login"
                title={t('navigation.signIn')}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
                  <path d="M14 7l5 5-5 5" />
                  <path d="M19 12H9" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Barre de navigation principale */}
      <nav className="bg-primary hidden md:block">
        <div className="container mx-auto px-6">
          <div className="flex justify-center space-x-8 py-3">
            <Link 
              href={`/${locale}`} 
              className="text-primary-light hover:text-white py-2 transition-colors"
            >
              {t('navigation.home')}
            </Link>
            <Link 
              href={`/${locale}/catalogue`} 
              className="text-primary-light hover:text-white py-2 transition-colors"
            >
              {t('navigation.catalogue')}
            </Link>
            
            {session && (
              <>
                <Link 
                  href={`/${locale}/notebook`} 
                  className="text-primary-light hover:text-white py-2 transition-colors"
                >
                  {t('navigation.notebook')}
                </Link>
                <Link 
                  href={`/${locale}/explorer`} 
                  className="text-primary-light hover:text-white py-2 transition-colors"
                >
                  {t('navigation.explorer')}
                </Link>
                <Link 
                  href={`/${locale}/map`} 
                  className="text-primary-light hover:text-white py-2 transition-colors"
                >
                  {t('navigation.map')}
                </Link>
                <Link 
                  href={`/${locale}/aromatic`} 
                  className="text-primary-light hover:text-white py-2 transition-colors"
                >
                  {t('navigation.aromaticWheel')}
                </Link>
                <Link 
                  href={`/${locale}/account`} 
                  className="text-primary-light hover:text-white py-2 transition-colors"
                >
                  {t('navigation.myAccount')}
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="md:hidden bg-white border-b border-gray-100 shadow-sm">
          <div className="px-6 py-4 space-y-3">
            <select 
              value={locale}
              onChange={(e) => {
                changeLocale(e.target.value as Locale)
                setMobileOpen(false)
              }}
              className="border border-gray-200 rounded-lg px-2.5 py-2 text-sm w-full"
            >
              <option value="fr">🇫🇷 Français</option>
              <option value="en">🇬🇧 English</option>
            </select>
            <Link href={`/${locale}`} className="block text-primary" onClick={() => setMobileOpen(false)}>
              {t('navigation.home')}
            </Link>
            <Link href={`/${locale}/catalogue`} className="block text-primary" onClick={() => setMobileOpen(false)}>
              {t('navigation.catalogue')}
            </Link>
            {session && (
              <>
                <Link href={`/${locale}/notebook`} className="block text-primary" onClick={() => setMobileOpen(false)}>
                  {t('navigation.notebook')}
                </Link>
                <Link href={`/${locale}/explorer`} className="block text-primary" onClick={() => setMobileOpen(false)}>
                  {t('navigation.explorer')}
                </Link>
                <Link href={`/${locale}/map`} className="block text-primary" onClick={() => setMobileOpen(false)}>
                  {t('navigation.map')}
                </Link>
                <Link href={`/${locale}/aromatic`} className="block text-primary" onClick={() => setMobileOpen(false)}>
                  {t('navigation.aromaticWheel')}
                </Link>
                <Link href={`/${locale}/account`} className="block text-primary" onClick={() => setMobileOpen(false)}>
                  {t('navigation.myAccount')}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
