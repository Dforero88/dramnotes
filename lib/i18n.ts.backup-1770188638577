// @/lib/i18n.ts

// Les traductions brutes
export const translations = {
  fr: {
    auth: {
      'accountActivated': 'Account Activated',
      'alreadyHaveAccount': 'Already Have Account',
      'browseCatalogue': 'Browse Catalogue',
      'checkEmail': 'Check Email',
      'confirmationSuccess': 'Confirmation Success',
      'goToLogin': 'Go To Login',
      'redirectLogin': 'Redirect Login',
      'register': 'Register',
      'registerSuccess': 'Register Success',
      'signInHere': 'Sign In Here',
      'termsAgreement': 'Terms Agreement',
      'thanksForConfirming': 'Thanks For Confirming'
    },
    form: {
      'email': 'Email',
      'emailPlaceholder': 'Email Placeholder',
      'password': 'Password',
      'passwordPlaceholder': 'Password Placeholder',
      'pseudo': 'Pseudo',
      'pseudoPlaceholder': 'Pseudo Placeholder'
    },
    navigation: {
      'aromaticWheel': 'Roue aromatique',
      'catalogue': 'Catalogue',
      'explorer': 'Explorer',
      'home': 'Home',
      'map': 'Map',
      'myAccount': 'My Account',
      'notebook': 'Notebook',
      'signIn': 'Sign In',
      'signOut': 'Sign Out',
      'signUp': 'Sign Up',
      'welcome': 'Welcome'
    },
    validation: {
      'passwordRules': 'Password Rules'
    }
  },
  en: {
    auth: {
      'accountActivated': 'Account Activated',
      'alreadyHaveAccount': 'Already Have Account',
      'browseCatalogue': 'Browse Catalogue',
      'checkEmail': 'Check Email',
      'confirmationSuccess': 'Confirmation Success',
      'goToLogin': 'Go To Login',
      'redirectLogin': 'Redirect Login',
      'register': 'Register',
      'registerSuccess': 'Register Success',
      'signInHere': 'Sign In Here',
      'termsAgreement': 'Terms Agreement',
      'thanksForConfirming': 'Thanks For Confirming'
    },
    form: {
      'email': 'Email',
      'emailPlaceholder': 'Email Placeholder',
      'password': 'Password',
      'passwordPlaceholder': 'Password Placeholder',
      'pseudo': 'Pseudo',
      'pseudoPlaceholder': 'Pseudo Placeholder'
    },
    navigation: {
      'aromaticWheel': 'my Aromatic Wheel',
      'catalogue': 'Catalogue',
      'explorer': 'Explorer',
      'home': 'Home',
      'map': 'Map',
      'myAccount': 'My Account',
      'notebook': 'Notebook',
      'signIn': 'Sign In',
      'signOut': 'Sign Out',
      'signUp': 'Sign Up',
      'welcome': 'Welcome'
    },
    validation: {
      'passwordRules': 'Password Rules'
    }
  },
}

export type Locale = keyof typeof translations
export type TranslationKey = string

// Fonction de traduction
export function t(locale: Locale, key: TranslationKey): string {
  const keys = key.split('.')
  let value: any = translations[locale]
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k]
    } else {
      console.warn(`Missing translation for key: ${key} in locale: ${locale}`)
      return key
    }
  }
  
  return typeof value === 'string' ? value : key
}

export function getTranslations(locale: Locale) {
  return (key: TranslationKey) => t(locale, key)
}
