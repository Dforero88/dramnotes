import crypto from 'crypto'

type DbSchema = {
  countries: any
  users: any
  distillers: any
  bottlers: any
  whiskies: any
  tastingNotes: any
  tags: any
  tagLang: any
  tastingNoteTags: any
  follows: any
  activities: any
  whiskyAnalyticsCache: any
  whiskyTagStats: any
  userAromaProfile: any
}

const databaseUrl = process.env.DATABASE_URL || ''
const isMysqlUrl = databaseUrl.startsWith('mysql://') || databaseUrl.startsWith('mariadb://')
const isProduction = process.env.NODE_ENV === 'production'

if (isProduction && !isMysqlUrl) {
  throw new Error('DATABASE_URL doit être une URL MySQL/MariaDB en production')
}

const useMysql = isMysqlUrl || isProduction
export const isMysql = useMysql

function createSqliteSchema(): DbSchema {
  const { sqliteTable, text, integer, real } = require('drizzle-orm/sqlite-core')

  const countries = sqliteTable('countries', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    nameFr: text('name_fr'),
  })

  const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    password: text('password').notNull(),
    pseudo: text('pseudo').notNull().unique(),
    visibility: text('visibility').default('private'),
    address: text('address'),
    zipCode: text('zip_code'),
    town: text('town'),
    countryId: text('country_id'),
    confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
    confirmationToken: text('confirmation_token'),
    tokenExpiry: integer('token_expiry', { mode: 'timestamp' }),
    resetPasswordToken: text('reset_password_token'),
    resetPasswordExpiry: integer('reset_password_expiry', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
  })

  const distillers = sqliteTable('distillers', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    countryId: text('country_id'),
  })

  const bottlers = sqliteTable('bottlers', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
  })

  const whiskies = sqliteTable('whiskies', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    distillerId: text('distiller_id'),
    bottlerId: text('bottler_id'),
    countryId: text('country_id'),
    addedById: text('added_by_id'),
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
    barcodeImageUrl: text('barcode_image_url'),
    labelImageUrl: text('label_image_url'),
    bottleImageUrl: text('bottle_image_url'),
    createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
  })

  const tastingNotes = sqliteTable('tasting_notes', {
    id: text('id').primaryKey(),
    whiskyId: text('whisky_id').notNull(),
    userId: text('user_id').notNull(),
    tastingDate: text('tasting_date').notNull(),
    location: text('location'),
    latitude: real('latitude'),
    longitude: real('longitude'),
    country: text('country'),
    city: text('city'),
    overall: text('overall'),
    rating: integer('rating'),
    createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
  })

  const tags = sqliteTable('tags', {
    id: text('id').primaryKey(),
    createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
  })

  const tagLang = sqliteTable('tag_lang', {
    tagId: text('tag_id').notNull(),
    lang: text('lang').notNull(),
    name: text('name').notNull(),
  })

  const tastingNoteTags = sqliteTable('tasting_note_tags', {
    noteId: text('note_id').notNull(),
    tagId: text('tag_id').notNull(),
    type: text('type').notNull(),
  })

  const follows = sqliteTable('follows', {
    followerId: text('follower_id').notNull(),
    followedId: text('followed_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
  })

  const activities = sqliteTable('activities', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    type: text('type').notNull(),
    targetId: text('target_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
  })

  const whiskyAnalyticsCache = sqliteTable('whisky_analytics_cache', {
    whiskyId: text('whisky_id').primaryKey(),
    avgRating: real('avg_rating'),
    totalReviews: integer('total_reviews'),
    lastCalculated: integer('last_calculated', { mode: 'timestamp' }),
  })

  const whiskyTagStats = sqliteTable('whisky_tag_stats', {
    whiskyId: text('whisky_id').notNull(),
    tagId: text('tag_id').notNull(),
    section: text('section').notNull(),
    count: integer('count').notNull(),
  })

  const userAromaProfile = sqliteTable('user_aroma_profile', {
    userId: text('user_id').primaryKey(),
    avgRating: real('avg_rating'),
    totalNotes: integer('total_notes'),
    aromaProfile: text('aroma_profile'),
    lastUpdated: integer('last_updated', { mode: 'timestamp' }),
  })

  return {
    countries,
    users,
    distillers,
    bottlers,
    whiskies,
    tastingNotes,
    tags,
    tagLang,
    tastingNoteTags,
    follows,
    activities,
    whiskyAnalyticsCache,
    whiskyTagStats,
    userAromaProfile,
  }
}

function createMysqlSchema(): DbSchema {
  const { mysqlTable, varchar, text, int, double, datetime } = require('drizzle-orm/mysql-core')
  const { sql } = require('drizzle-orm')

  const countries = mysqlTable('countries', {
    id: varchar('id', { length: 36 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    nameFr: varchar('name_fr', { length: 255 }),
  })

  const users = mysqlTable('users', {
    id: varchar('id', { length: 36 }).primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    password: varchar('password', { length: 255 }).notNull(),
    pseudo: varchar('pseudo', { length: 50 }).notNull().unique(),
    visibility: varchar('visibility', { length: 20 }).default('private'),
    address: varchar('address', { length: 255 }),
    zipCode: varchar('zip_code', { length: 20 }),
    town: varchar('town', { length: 100 }),
    countryId: varchar('country_id', { length: 36 }),
    confirmedAt: datetime('confirmed_at', { mode: 'date' }),
    confirmationToken: text('confirmation_token'),
    tokenExpiry: datetime('token_expiry', { mode: 'date' }),
    resetPasswordToken: text('reset_password_token'),
    resetPasswordExpiry: datetime('reset_password_expiry', { mode: 'date' }),
    createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at', { mode: 'date' }).$onUpdate(() => new Date()),
  })

  const distillers = mysqlTable('distillers', {
    id: varchar('id', { length: 36 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    countryId: varchar('country_id', { length: 36 }),
  })

  const bottlers = mysqlTable('bottlers', {
    id: varchar('id', { length: 36 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
  })

  const whiskies = mysqlTable('whiskies', {
    id: varchar('id', { length: 36 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    distillerId: varchar('distiller_id', { length: 36 }),
    bottlerId: varchar('bottler_id', { length: 36 }),
    countryId: varchar('country_id', { length: 36 }),
    addedById: varchar('added_by_id', { length: 36 }),
    barcode: varchar('barcode', { length: 64 }),
    barcodeType: varchar('barcode_type', { length: 32 }),
    bottlingType: varchar('bottling_type', { length: 64 }),
    distilledYear: int('distilled_year'),
    bottledYear: int('bottled_year'),
    age: int('age'),
    caskType: varchar('cask_type', { length: 100 }),
    batchId: varchar('batch_id', { length: 100 }),
    alcoholVolume: double('alcohol_volume'),
    bottledFor: varchar('bottled_for', { length: 255 }),
    region: varchar('region', { length: 100 }),
    type: varchar('type', { length: 100 }),
    description: text('description'),
    imageUrl: text('image_url'),
    barcodeImageUrl: text('barcode_image_url'),
    labelImageUrl: text('label_image_url'),
    bottleImageUrl: text('bottle_image_url'),
    createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at', { mode: 'date' }).$onUpdate(() => new Date()),
  })

  const tastingNotes = mysqlTable('tasting_notes', {
    id: varchar('id', { length: 36 }).primaryKey(),
    whiskyId: varchar('whisky_id', { length: 36 }).notNull(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    tastingDate: varchar('tasting_date', { length: 10 }).notNull(),
    location: varchar('location', { length: 255 }),
    latitude: double('latitude'),
    longitude: double('longitude'),
    country: varchar('country', { length: 100 }),
    city: varchar('city', { length: 100 }),
    overall: text('overall'),
    rating: int('rating'),
    createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at', { mode: 'date' }).$onUpdate(() => new Date()),
  })

  const tags = mysqlTable('tags', {
    id: varchar('id', { length: 36 }).primaryKey(),
    createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
  })

  const tagLang = mysqlTable('tag_lang', {
    tagId: varchar('tag_id', { length: 36 }).notNull(),
    lang: varchar('lang', { length: 5 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
  })

  const tastingNoteTags = mysqlTable('tasting_note_tags', {
    noteId: varchar('note_id', { length: 36 }).notNull(),
    tagId: varchar('tag_id', { length: 36 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(),
  })

  const follows = mysqlTable('follows', {
    followerId: varchar('follower_id', { length: 36 }).notNull(),
    followedId: varchar('followed_id', { length: 36 }).notNull(),
    createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
  })

  const activities = mysqlTable('activities', {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(),
    targetId: varchar('target_id', { length: 36 }).notNull(),
    createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
  })

  const whiskyAnalyticsCache = mysqlTable('whisky_analytics_cache', {
    whiskyId: varchar('whisky_id', { length: 36 }).primaryKey(),
    avgRating: double('avg_rating'),
    totalReviews: int('total_reviews'),
    lastCalculated: datetime('last_calculated', { mode: 'date' }),
  })

  const whiskyTagStats = mysqlTable('whisky_tag_stats', {
    whiskyId: varchar('whisky_id', { length: 36 }).notNull(),
    tagId: varchar('tag_id', { length: 36 }).notNull(),
    section: varchar('section', { length: 20 }).notNull(),
    count: int('count').notNull(),
  })

  const userAromaProfile = mysqlTable('user_aroma_profile', {
    userId: varchar('user_id', { length: 36 }).primaryKey(),
    avgRating: double('avg_rating'),
    totalNotes: int('total_notes'),
    aromaProfile: text('aroma_profile'),
    lastUpdated: datetime('last_updated', { mode: 'date' }),
  })

  return {
    countries,
    users,
    distillers,
    bottlers,
    whiskies,
    tastingNotes,
    tags,
    tagLang,
    tastingNoteTags,
    follows,
    activities,
    whiskyAnalyticsCache,
    whiskyTagStats,
    userAromaProfile,
  }
}

const schema: DbSchema = useMysql ? createMysqlSchema() : createSqliteSchema()
export const {
  countries,
  users,
  distillers,
  bottlers,
  whiskies,
  tastingNotes,
  tags,
  tagLang,
  tastingNoteTags,
  follows,
  activities,
  whiskyAnalyticsCache,
  whiskyTagStats,
  userAromaProfile,
} = schema

let dbInstance: any
let sqliteInitialized = false

function getDatabaseUrlForMysql(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL manquant pour MySQL/MariaDB')
  }
  return url
}

function getSqliteFilePath(): string {
  if (databaseUrl.startsWith('file:')) {
    return databaseUrl.replace(/^file:/, '')
  }
  return './local.db'
}

function initSqlite(sqlite: any) {
  if (process.env.NODE_ENV === 'production') return
  if (sqliteInitialized) return

  const usersTableExists = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    .get()

  if (!usersTableExists) {
    sqlite.prepare(`
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
    `).run()
  } else {
    const userColumns = sqlite.prepare("PRAGMA table_info(users)").all()
    const userColumnNames = userColumns.map((col: any) => col.name)

    const usersColumnsToAdd = [
      'confirmed_at',
      'confirmation_token',
      'token_expiry',
      'reset_password_token',
      'reset_password_expiry',
    ]

    usersColumnsToAdd.forEach((column) => {
      if (!userColumnNames.includes(column)) {
        const type = column.includes('token') ? 'TEXT' : 'INTEGER'
        sqlite.prepare(`ALTER TABLE users ADD COLUMN ${column} ${type}`).run()
      }
    })
  }

  const whiskiesTableExists = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='whiskies'")
    .get()

  if (!whiskiesTableExists) {
    sqlite.prepare(`
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
    `).run()
  } else {
    const whiskyColumns = sqlite.prepare("PRAGMA table_info(whiskies)").all()
    const whiskyColumnNames = whiskyColumns.map((col: any) => col.name)

    const whiskiesColumnsToAdd = [
      'barcode',
      'barcode_type',
      'barcode_image_url',
      'label_image_url',
      'bottle_image_url',
    ]

    whiskiesColumnsToAdd.forEach((column) => {
      if (!whiskyColumnNames.includes(column)) {
        const type = column.includes('url') || column.includes('type') || column === 'barcode' ? 'TEXT' : 'INTEGER'
        sqlite.prepare(`ALTER TABLE whiskies ADD COLUMN ${column} ${type}`).run()
      }
    })
  }

  sqlite.prepare(`
    CREATE TABLE IF NOT EXISTS countries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      name_fr TEXT
    )
  `).run()

  sqlite.prepare(`
    CREATE TABLE IF NOT EXISTS distillers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      country_id TEXT
    )
  `).run()

  sqlite.prepare(`
    CREATE TABLE IF NOT EXISTS bottlers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )
  `).run()

  sqlite.prepare(`
    CREATE TABLE IF NOT EXISTS tasting_notes (
      id TEXT PRIMARY KEY,
      whisky_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      tasting_date TEXT NOT NULL,
      location TEXT,
      latitude REAL,
      longitude REAL,
      country TEXT,
      city TEXT,
      overall TEXT,
      rating INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `).run()

  sqlite.prepare(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `).run()

  sqlite.prepare(`
    CREATE TABLE IF NOT EXISTS tag_lang (
      tag_id TEXT NOT NULL,
      lang TEXT NOT NULL,
      name TEXT NOT NULL
    )
  `).run()

  sqlite.prepare(`
    CREATE TABLE IF NOT EXISTS tasting_note_tags (
      note_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      type TEXT NOT NULL
    )
  `).run()

  sqlite.prepare(`
    CREATE TABLE IF NOT EXISTS whisky_tag_stats (
      whisky_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      section TEXT NOT NULL,
      count INTEGER NOT NULL
    )
  `).run()

  sqliteInitialized = true
}

function getDb() {
  if (dbInstance) return dbInstance

  if (useMysql) {
    const { drizzle } = require('drizzle-orm/mysql2')
    const mysql = require('mysql2/promise')
    const pool = mysql.createPool(getDatabaseUrlForMysql())
    dbInstance = drizzle(pool, { schema, mode: 'default' })
    return dbInstance
  }

  const { drizzle } = require('drizzle-orm/better-sqlite3')
  const Database = require('better-sqlite3')
  const sqlite = new Database(getSqliteFilePath())
  initSqlite(sqlite)
  dbInstance = drizzle(sqlite, { schema })
  return dbInstance
}

export const db = new Proxy(
  {},
  {
    get(_target, prop) {
      const real = getDb()
      const value = real[prop as keyof typeof real]
      return typeof value === 'function' ? value.bind(real) : value
    },
  }
) as any

export function generateId() {
  return crypto.randomUUID()
}
