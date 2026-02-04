const fs = require('fs')
const path = require('path')

// ==================== CONFIGURATION ====================
const DEBUG = true
const SOURCE_DIRS = ['./app', './components']
const I18N_FILE = './lib/i18n.ts'
// ======================================================

// Log avec timestamp
function log(...args) {
  if (DEBUG) {
    const time = new Date().toLocaleTimeString()
    console.log(`[${time}]`, ...args)
  }
}

// Trouve tous les fichiers .tsx et .ts
function getAllFiles(dirs) {
  const fileList = []
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      log(`⚠️  Dossier ${dir} non trouvé`)
      return
    }
    
    function scan(currentDir) {
      try {
        const files = fs.readdirSync(currentDir)
        
        files.forEach(file => {
          const filePath = path.join(currentDir, file)
          
          try {
            const stat = fs.statSync(filePath)
            
            if (stat.isDirectory()) {
              // Ignore certains dossiers
              if (!filePath.includes('node_modules') && 
                  !filePath.includes('.next') &&
                  !filePath.includes('.git')) {
                scan(filePath)
              }
            } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
              fileList.push(filePath)
            }
          } catch (err) {
            log(`⚠️  Erreur sur ${filePath}:`, err.message)
          }
        })
      } catch (err) {
        log(`❌ Erreur lecture dossier ${currentDir}:`, err.message)
      }
    }
    
    scan(dir)
  })
  
  return fileList
}

// Extrait les clés t('...') d'un fichier
function extractKeysFromFile(filePath) {
  const keys = new Set()
  
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    
    // Cherche t('ma.clé') avec ou sans accolades
    // - évite d'accrocher des "Default(...)" ou autres appels non t(...)
    const regex = /\bt\(['"]([^'"]+)['"]\)/g
    let match
    
    while ((match = regex.exec(content)) !== null) {
      const key = match[1]
      
      // Validation basique
      if (key.length > 0 && key.length < 100) {
        keys.add(key)
      }
    }
    
    if (keys.size > 0) {
      log(`📄 ${filePath} → ${keys.size} clé(s)`)
    }
    
    return Array.from(keys)
  } catch (err) {
    log(`❌ Erreur lecture ${filePath}:`, err.message)
    return []
  }
}

// Parse le i18n.ts existant - VERSION SIMPLIFIÉE ET FIABLE
function parseExistingI18n() {
  try {
    if (!fs.existsSync(I18N_FILE)) {
      log('📝 Fichier i18n.ts non trouvé')
      return { fr: {}, en: {} }
    }
    
    const content = fs.readFileSync(I18N_FILE, 'utf8')
    
    // APPROCHE SIMPLE : Exécuter le fichier TypeScript pour extraire l'objet
    // On va extraire seulement la partie entre "export const translations = {" et "};"
    const start = content.indexOf('export const translations = {')
    if (start === -1) {
      return { fr: {}, en: {} }
    }
    
    let braceCount = 0
    let i = start + 'export const translations = {'.length
    let end = -1
    
    for (; i < content.length; i++) {
      if (content[i] === '{') braceCount++
      if (content[i] === '}') {
        if (braceCount === 0) {
          end = i
          break
        }
        braceCount--
      }
    }
    
    if (end === -1) {
      return { fr: {}, en: {} }
    }
    
    const translationsText = content.substring(start + 'export const translations = '.length, end + 1)
    
    // Évaluer l'objet (méthode simple mais attention aux injections si le fichier est compromis)
    try {
      // Nettoyer les commentaires
      const cleaned = translationsText
        .replace(/\/\/.*$/gm, '') // Commentaires de ligne
        .replace(/\/\*[\s\S]*?\*\//g, '') // Commentaires multilignes
      
      // Évaluer comme objet JavaScript
      const evalFn = new Function(`return ${cleaned}`)
      const translations = evalFn()
      
      log(`📖 i18n.ts chargé: ${Object.keys(translations.fr || {}).length} catégories FR, ${Object.keys(translations.en || {}).length} catégories EN`)
      return translations
    } catch (evalErr) {
      log('❌ Erreur évaluation objet:', evalErr.message)
      return { fr: {}, en: {} }
    }
  } catch (err) {
    log('❌ Erreur parsing i18n.ts:', err.message)
    return { fr: {}, en: {} }
  }
}

// Structure les clés par catégorie
function organizeKeys(keys) {
  const organized = {}
  
  keys.forEach(key => {
    // Sépare category.key
    const parts = key.split('.')
    if (parts.length > 1) {
      const category = parts[0]
      const subKey = parts.slice(1).join('.')
      
      if (!organized[category]) organized[category] = {}
      organized[category][subKey] = true // true signifie "cette clé existe dans le code"
    } else {
      // Pas de point = catégorie "common"
      if (!organized.common) organized.common = {}
      organized.common[key] = true
    }
  })
  
  return organized
}

// Fonction pour créer une version "humaine" d'une clé
function humanizeKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1') // Ajouter espace avant majuscule
    .replace(/^./, str => str.toUpperCase()) // Première lettre en majuscule
    .replace(/_/g, ' ') // Remplacer les underscores par des espaces
    .trim()
}

// Générateur de contenu - VERSION CORRECTE qui préserve les traductions
function generateI18nContent(existingTranslations, newKeys) {
  let output = `// @/lib/i18n.ts

// Les traductions brutes
export const translations = {
`

  // ========== FRANÇAIS ==========
  output += `  fr: {\n`
  
  // Toutes les catégories: existantes + nouvelles
  const allCategories = new Set([
    ...Object.keys(existingTranslations.fr || {}),
    ...Object.keys(newKeys)
  ])
  
  const sortedCategories = Array.from(allCategories).sort()
  
  sortedCategories.forEach((category, catIndex) => {
    output += `    ${category}: {\n`
    
    // Traductions existantes pour cette catégorie
    const existingCategory = existingTranslations.fr[category] || {}
    // Nouvelles clés pour cette catégorie
    const newCategoryKeys = newKeys[category] || {}
    
    // Fusionner intelligemment: garder l'existant, ajouter le nouveau
    const allKeysMap = new Map()
    
    // 1. Ajouter toutes les clés existantes
    Object.entries(existingCategory).forEach(([key, value]) => {
      allKeysMap.set(key, { value, isNew: false })
    })
    
    // 2. Ajouter les nouvelles clés (seulement si elles n'existent pas déjà)
    Object.keys(newCategoryKeys).forEach(key => {
      if (!allKeysMap.has(key)) {
        allKeysMap.set(key, { value: null, isNew: true })
      }
    })
    
    // Convertir en tableau et trier
    const allKeys = Array.from(allKeysMap.entries())
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    
    // Générer le contenu
    allKeys.forEach(([key, data], keyIndex) => {
      let value = data.value
      
      // Si c'est une nouvelle clé (sans valeur), on génère une valeur par défaut
      if (data.isNew && value === null) {
        value = humanizeKey(key)
      }
      
      // Échapper les apostrophes
      const escapedValue = value.replace(/'/g, "\\'")
      
      output += `      '${key}': '${escapedValue}'${keyIndex < allKeys.length - 1 ? ',' : ''}\n`
    })
    
    output += `    }${catIndex < sortedCategories.length - 1 ? ',' : ''}\n`
  })
  
  output += `  },\n`
  
  // ========== ANGLAIS ==========
  output += `  en: {\n`
  
  sortedCategories.forEach((category, catIndex) => {
    output += `    ${category}: {\n`
    
    // Traductions existantes pour cette catégorie
    const existingCategory = existingTranslations.en?.[category] || {}
    // Nouvelles clés pour cette catégorie
    const newCategoryKeys = newKeys[category] || {}
    
    // Fusionner intelligemment
    const allKeysMap = new Map()
    
    // 1. Ajouter toutes les clés existantes
    Object.entries(existingCategory).forEach(([key, value]) => {
      allKeysMap.set(key, { value, isNew: false })
    })
    
    // 2. Ajouter les nouvelles clés (seulement si elles n'existent pas déjà)
    Object.keys(newCategoryKeys).forEach(key => {
      if (!allKeysMap.has(key)) {
        allKeysMap.set(key, { value: null, isNew: true })
      }
    })
    
    // Convertir en tableau et trier
    const allKeys = Array.from(allKeysMap.entries())
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    
    // Générer le contenu
    allKeys.forEach(([key, data], keyIndex) => {
      let value = data.value
      let comment = ''
      
      // Si c'est une nouvelle clé (sans valeur), on génère une valeur par défaut
      if (data.isNew && value === null) {
        value = humanizeKey(key)
      }
      // Si la valeur existe mais est vide, on garde vide avec commentaire
      else if (value === '') {
        comment = ' // TODO: translate'
      }
      
      // Échapper les apostrophes
      const escapedValue = value ? value.replace(/'/g, "\\'") : ''
      
      output += `      '${key}': '${escapedValue}'${keyIndex < allKeys.length - 1 ? ',' : ''}${comment}\n`
    })
    
    output += `    }${catIndex < sortedCategories.length - 1 ? ',' : ''}\n`
  })
  
  output += `  },\n`
  
  output += `}

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
      console.warn(\`Missing translation for key: \${key} in locale: \${locale}\`)
      return key
    }
  }
  
  return typeof value === 'string' ? value : key
}

export function getTranslations(locale: Locale) {
  return (key: TranslationKey) => t(locale, key)
}
`
  
  return output
}

// ========== MAIN ==========
console.log('🚀 Extraction des traductions...')
console.log('='.repeat(50))

// 1. Scanner les fichiers
log(`🔍 Scan des dossiers: ${SOURCE_DIRS.join(', ')}`)
const files = getAllFiles(SOURCE_DIRS)
log(`📁 ${files.length} fichiers trouvés`)

if (files.length === 0) {
  console.log('❌ Aucun fichier trouvé, vérifie les dossiers source')
  process.exit(1)
}

// 2. Extraire les clés
const allKeys = new Set()
files.forEach(file => {
  const keys = extractKeysFromFile(file)
  keys.forEach(key => allKeys.add(key))
})

const uniqueKeys = Array.from(allKeys).sort()
log(`📦 ${uniqueKeys.length} clés uniques trouvées`)

if (uniqueKeys.length === 0) {
  console.log('ℹ️  Aucune clé t(...) trouvée dans le code')
  process.exit(0)
}

// 3. Lire l'existant
const existingTranslations = parseExistingI18n()
log(`📊 Traductions existantes chargées: FR=${JSON.stringify(existingTranslations.fr).length} octets, EN=${JSON.stringify(existingTranslations.en).length} octets`)

// 4. Organiser les nouvelles clés
const organizedNewKeys = organizeKeys(uniqueKeys)

// 5. Générer le nouveau contenu
const newContent = generateI18nContent(existingTranslations, organizedNewKeys)

// 6. Écrire le fichier
try {
  // Faire une backup du fichier existant
  if (fs.existsSync(I18N_FILE)) {
    const backupFile = I18N_FILE + '.backup-' + Date.now()
    fs.copyFileSync(I18N_FILE, backupFile)
    log(`💾 Backup créé: ${backupFile}`)
  }
  
  fs.writeFileSync(I18N_FILE, newContent)
  console.log('✅ Fichier i18n.ts généré avec succès!')
  
  // Statistiques
  console.log('\n📊 Statistiques:')
  console.log(`   Fichiers scannés: ${files.length}`)
  console.log(`   Clés détectées dans le code: ${uniqueKeys.length}`)
  
  // Calculer les nouvelles clés
  let newKeyCount = 0
  const existingKeySet = new Set()
  
  // Compter toutes les clés existantes
  Object.values(existingTranslations.fr || {}).forEach(category => {
    Object.keys(category || {}).forEach(key => {
      existingKeySet.add(key)
    })
  })
  
  // Vérifier quelles clés sont nouvelles
  uniqueKeys.forEach(key => {
    const parts = key.split('.')
    if (parts.length > 1) {
      const subKey = parts.slice(1).join('.')
      if (!existingKeySet.has(subKey)) {
        newKeyCount++
      }
    }
  })
  
  if (newKeyCount > 0) {
    console.log(`   Nouvelles clés ajoutées: ${newKeyCount}`)
    console.log('\n⚠️  Note: Les NOUVELLES clés ont reçu une valeur par défaut')
    console.log('   Les traductions EXISTANTES ont été préservées')
  } else {
    console.log('   ✅ Aucune nouvelle clé, fichier mis à jour sans perte')
  }
  
  console.log('\n🔧 Fichier:', I18N_FILE)
} catch (err) {
  console.log('❌ Erreur écriture fichier:', err.message)
  process.exit(1)
}

console.log('='.repeat(50))
console.log('🎯 Extraction terminée!')
