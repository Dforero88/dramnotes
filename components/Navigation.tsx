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
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-4 flex items-center">
          
          {/* Logo centré */}
          <div className="absolute left-1/2 transform -translate-x-1/2">
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

          {/* Sélecteur langue + auth */}
          <div className="ml-auto flex items-center space-x-4">
            {/* Sélecteur de langue */}
            <select 
              value={locale}
              onChange={(e) => changeLocale(e.target.value as Locale)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="fr">🇫🇷 Français</option>
              <option value="en">🇬🇧 English</option>
            </select>

            {/* Boutons auth */}
            {session ? (
              <>
                <span className="text-gray-600 hidden md:inline">
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
          
        </div>
      </div>

      {/* Barre de navigation principale */}
      <nav className="bg-primary">
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
    </header>
  )
}