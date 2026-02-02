import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// 1. DÉFINIR LES TABLES
export const countries = sqliteTable('countries', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nameFr: text('name_fr'),
})

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  pseudo: text('pseudo').notNull().unique(),
  visibility: text('visibility').default('private'),
  address: text('address'),
  zipCode: text('zip_code'),
  town: text('town'),
  countryId: text('country_id'),
  
  // CHAMPS POUR CONFIRMATION EMAIL
  confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
  confirmationToken: text('confirmation_token'),
  tokenExpiry: integer('token_expiry', { mode: 'timestamp' }),
  
  // NOUVEAUX CHAMPS POUR RESET MOT DE PASSE
  resetPasswordToken: text('reset_password_token'),
  resetPasswordExpiry: integer('reset_password_expiry', { mode: 'timestamp' }),
  
  // CHAMPS MÉTADONNÉES
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
})

export const distillers = sqliteTable('distillers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  countryId: text('country_id'),
})

export const bottlers = sqliteTable('bottlers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
})

export const whiskies = sqliteTable('whiskies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  distillerId: text('distiller_id'),
  bottlerId: text('bottler_id'),
  countryId: text('country_id'),
  addedById: text('added_by_id'),
  
  // NOUVEAUX CHAMPS POUR CODE-BARRE
  barcode: text('barcode'),
  barcodeType: text('barcode_type'),
  
  bottlingType: text('bottling_type'),
  distilledYear: integer('distilled_year'),
  bottledYear: integer('bottled_year'),
  age: integer('age'),
  caskType: text('cask_type'),
  batchId: text('batch_id'),
  alcoholVolume: real('alcohol_volume'),
  bottledFor: text('bottled_for'),
  region: text('region'),
  type: text('type'),
  description: text('description'),
  imageUrl: text('image_url'),
  
  // NOUVEAUX CHAMPS POUR PHOTOS
  barcodeImageUrl: text('barcode_image_url'),
  labelImageUrl: text('label_image_url'),
  bottleImageUrl: text('bottle_image_url'),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
})

// 2. CRÉER LA CONNEXION
const sqlite = new Database('./local.db')
export const db = drizzle(sqlite)

// 3. INITIALISER LA BASE
export async function initDB() {
  // Vérifier si la table users existe déjà
  const usersTableExists = await db.get<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
  )
  
  if (!usersTableExists) {
    await db.run(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        pseudo TEXT NOT NULL UNIQUE,
        visibility TEXT DEFAULT 'private',
        address TEXT,
        zip_code TEXT,
        town TEXT,
        country_id TEXT,
        confirmed_at INTEGER,
        confirmation_token TEXT,
        token_expiry INTEGER,
        reset_password_token TEXT,
        reset_password_expiry INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `)
    console.log('✅ Table users créée avec tous les champs')
  } else {
    const userColumns = await db.all<{ name: string }>("PRAGMA table_info(users)")
    const userColumnNames = userColumns.map(col => col.name)
    
    const usersColumnsToAdd = [
      'confirmed_at',
      'confirmation_token', 
      'token_expiry',
      'reset_password_token',
      'reset_password_expiry'
    ]
    
    usersColumnsToAdd.forEach(async (column) => {
      if (!userColumnNames.includes(column)) {
        const type = column.includes('token') ? 'TEXT' : 'INTEGER'
        await db.run(`ALTER TABLE users ADD COLUMN ${column} ${type}`)
        console.log(`✅ Colonne ${column} ajoutée à users`)
      }
    })
  }
  
  // Vérifier si la table whiskies existe
  const whiskiesTableExists = await db.get<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='whiskies'"
  )
  
  if (!whiskiesTableExists) {
    await db.run(`
      CREATE TABLE whiskies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        distiller_id TEXT,
        bottler_id TEXT,
        country_id TEXT,
        added_by_id TEXT,
        barcode TEXT,
        barcode_type TEXT,
        bottling_type TEXT,
        distilled_year INTEGER,
        bottled_year INTEGER,
        age INTEGER,
        cask_type TEXT,
        batch_id TEXT,
        alcohol_volume REAL,
        bottled_for TEXT,
        region TEXT,
        type TEXT,
        description TEXT,
        image_url TEXT,
        barcode_image_url TEXT,
        label_image_url TEXT,
        bottle_image_url TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `)
    console.log('✅ Table whiskies créée avec tous les champs')
  } else {
    const whiskyColumns = await db.all<{ name: string }>("PRAGMA table_info(whiskies)")
    const whiskyColumnNames = whiskyColumns.map(col => col.name)
    
    const whiskiesColumnsToAdd = [
      'barcode',
      'barcode_type',
      'barcode_image_url',
      'label_image_url',
      'bottle_image_url'
    ]
    
    whiskiesColumnsToAdd.forEach(async (column) => {
      if (!whiskyColumnNames.includes(column)) {
        const type = column.includes('url') || column.includes('type') || column === 'barcode' ? 'TEXT' : 'INTEGER'
        await db.run(`ALTER TABLE whiskies ADD COLUMN ${column} ${type}`)
        console.log(`✅ Colonne ${column} ajoutée à whiskies`)
      }
    })
  }
  
  // Créer les autres tables
  await db.run(`
    CREATE TABLE IF NOT EXISTS countries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      name_fr TEXT
    )
  `)
  
  await db.run(`
    CREATE TABLE IF NOT EXISTS distillers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      country_id TEXT
    )
  `)
  
  await db.run(`
    CREATE TABLE IF NOT EXISTS bottlers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )
  `)
  
  console.log('✅ Base de données initialisée avec code-barre et photos')
}

// 4. FONCTION UTILITAIRE POUR GÉNÉRER LES IDs
export function generateId() {
  return crypto.randomUUID()
}

// 5. EXÉCUTER L'INITIALISATION
initDB().catch(console.error)