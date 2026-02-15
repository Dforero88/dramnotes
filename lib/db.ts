import crypto from 'crypto'

type DbSchema = {
  countries: any
  users: any
  userShelf: any
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
  userTagStats: any
  moderationTerms: any
}

const databaseUrl = process.env.DATABASE_URL || ''
const isMysqlUrl = databaseUrl.startsWith('mysql://') || databaseUrl.startsWith('mariadb://')
const isProduction = process.env.NODE_ENV === 'production'
const isBuildPhase =
  process.env.DRAMNOTES_BUILD === '1' || process.env.NEXT_PHASE === 'phase-production-build'

if (isProduction && !isMysqlUrl && !isBuildPhase) {
  throw new Error('DATABASE_URL doit être une URL MySQL/MariaDB en production')
}

const useMysql = isMysqlUrl
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
    shelfVisibility: text('shelf_visibility').default('private'),
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
    slug: text('slug').notNull(),
    descriptionFr: text('description_fr'),
    descriptionEn: text('description_en'),
    imageUrl: text('image_url'),
    countryId: text('country_id'),
    region: text('region'),
  })

  const bottlers = sqliteTable('bottlers', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    descriptionFr: text('description_fr'),
    descriptionEn: text('description_en'),
    imageUrl: text('image_url'),
    countryId: text('country_id'),
    region: text('region'),
  })

  const whiskies = sqliteTable('whiskies', {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
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
    status: text('status').notNull(),
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

  const userShelf = sqliteTable('user_shelf', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    whiskyId: text('whisky_id').notNull(),
    status: text('status').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).defaultNow(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
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
    lastUpdated: integer('last_updated', { mode: 'timestamp' }),
  })

  const userTagStats = sqliteTable('user_tag_stats', {
    userId: text('user_id').notNull(),
    tagId: text('tag_id').notNull(),
    section: text('section').notNull(),
    avgScore: real('avg_score').notNull(),
    count: integer('count').notNull(),
  })

  const moderationTerms = sqliteTable('moderation_terms', {
    id: text('id').primaryKey(),
    term: text('term').notNull(),
    category: text('category').notNull(),
    lang: text('lang').notNull(),
    active: integer('active').notNull(),
  })

  return {
    countries,
    users,
    userShelf,
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
    userTagStats,
    moderationTerms,
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
    shelfVisibility: varchar('shelf_visibility', { length: 20 }).default('private'),
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
    slug: varchar('slug', { length: 160 }).notNull(),
    descriptionFr: text('description_fr'),
    descriptionEn: text('description_en'),
    imageUrl: text('image_url'),
    countryId: varchar('country_id', { length: 36 }),
    region: varchar('region', { length: 100 }),
  })

  const bottlers = mysqlTable('bottlers', {
    id: varchar('id', { length: 36 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 160 }).notNull(),
    descriptionFr: text('description_fr'),
    descriptionEn: text('description_en'),
    imageUrl: text('image_url'),
    countryId: varchar('country_id', { length: 36 }),
    region: varchar('region', { length: 100 }),
  })

  const whiskies = mysqlTable('whiskies', {
    id: varchar('id', { length: 36 }).primaryKey(),
    slug: varchar('slug', { length: 160 }).notNull(),
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
    status: varchar('status', { length: 16 }).notNull(),
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

  const userShelf = mysqlTable('user_shelf', {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    whiskyId: varchar('whisky_id', { length: 36 }).notNull(),
    status: varchar('status', { length: 32 }).notNull(),
    createdAt: datetime('created_at', { mode: 'date' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: datetime('updated_at', { mode: 'date' }).$onUpdate(() => new Date()),
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
    lastUpdated: datetime('last_updated', { mode: 'date' }),
  })

  const userTagStats = mysqlTable('user_tag_stats', {
    userId: varchar('user_id', { length: 36 }).notNull(),
    tagId: varchar('tag_id', { length: 36 }).notNull(),
    section: varchar('section', { length: 20 }).notNull(),
    avgScore: double('avg_score').notNull(),
    count: int('count').notNull(),
  })

  const moderationTerms = mysqlTable('moderation_terms', {
    id: varchar('id', { length: 36 }).primaryKey(),
    term: varchar('term', { length: 128 }).notNull(),
    category: varchar('category', { length: 32 }).notNull(),
    lang: varchar('lang', { length: 8 }).notNull(),
    active: int('active').notNull(),
  })

  return {
    countries,
    users,
    userShelf,
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
    userTagStats,
    moderationTerms,
  }
}

const schema: DbSchema = useMysql ? createMysqlSchema() : createSqliteSchema()
export const {
  countries,
  users,
  userShelf,
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
  userTagStats,
  moderationTerms,
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
      'shelf_visibility',
      'confirmed_at',
      'confirmation_token',
      'token_expiry',
      'reset_password_token',
      'reset_password_expiry',
    ]

    usersColumnsToAdd.forEach((column) => {
      if (!userColumnNames.includes(column)) {
        const type =
          column === 'shelf_visibility'
            ? "TEXT DEFAULT 'private'"
            : column.includes('token')
              ? 'TEXT'
              : 'INTEGER'
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
        slug TEXT NOT NULL,
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
      'slug',
      'barcode',
      'barcode_type',
      'barcode_image_url',
      'label_image_url',
      'bottle_image_url',
    ]

    whiskiesColumnsToAdd.forEach((column) => {
      if (!whiskyColumnNames.includes(column)) {
        const type = column === 'slug' || column.includes('url') || column.includes('type') || column === 'barcode' ? 'TEXT' : 'INTEGER'
        sqlite.prepare(`ALTER TABLE whiskies ADD COLUMN ${column} ${type}`).run()
      }
    })
  }
  try {
    sqlite.prepare('CREATE UNIQUE INDEX IF NOT EXISTS uniq_whiskies_slug ON whiskies(slug)').run()
  } catch (_e) {
    // ignore
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
      slug TEXT,
      description_fr TEXT,
      description_en TEXT,
      image_url TEXT,
      country_id TEXT,
      region TEXT
    )
  `).run()

  sqlite.prepare(`
    CREATE TABLE IF NOT EXISTS bottlers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT,
      description_fr TEXT,
      description_en TEXT,
      image_url TEXT,
      country_id TEXT,
      region TEXT
    )
  `).run()

  const distillerColumns = sqlite.prepare("PRAGMA table_info(distillers)").all()
  const distillerColumnNames = distillerColumns.map((col: any) => col.name)
  const distillerColumnsToAdd = [
    { name: 'slug', type: 'TEXT' },
    { name: 'description_fr', type: 'TEXT' },
    { name: 'description_en', type: 'TEXT' },
    { name: 'image_url', type: 'TEXT' },
    { name: 'country_id', type: 'TEXT' },
    { name: 'region', type: 'TEXT' },
  ]
  distillerColumnsToAdd.forEach((column) => {
    if (!distillerColumnNames.includes(column.name)) {
      sqlite.prepare(`ALTER TABLE distillers ADD COLUMN ${column.name} ${column.type}`).run()
    }
  })

  const bottlerColumns = sqlite.prepare("PRAGMA table_info(bottlers)").all()
  const bottlerColumnNames = bottlerColumns.map((col: any) => col.name)
  const bottlerColumnsToAdd = [
    { name: 'slug', type: 'TEXT' },
    { name: 'description_fr', type: 'TEXT' },
    { name: 'description_en', type: 'TEXT' },
    { name: 'image_url', type: 'TEXT' },
    { name: 'country_id', type: 'TEXT' },
    { name: 'region', type: 'TEXT' },
  ]
  bottlerColumnsToAdd.forEach((column) => {
    if (!bottlerColumnNames.includes(column.name)) {
      sqlite.prepare(`ALTER TABLE bottlers ADD COLUMN ${column.name} ${column.type}`).run()
    }
  })

  try {
    sqlite.prepare('CREATE UNIQUE INDEX IF NOT EXISTS uniq_distillers_slug ON distillers(slug)').run()
    sqlite.prepare('CREATE UNIQUE INDEX IF NOT EXISTS uniq_bottlers_slug ON bottlers(slug)').run()
    sqlite.prepare('CREATE INDEX IF NOT EXISTS idx_distillers_name ON distillers(name)').run()
    sqlite.prepare('CREATE INDEX IF NOT EXISTS idx_bottlers_name ON bottlers(name)').run()
    sqlite.prepare('CREATE INDEX IF NOT EXISTS idx_distillers_country ON distillers(country_id)').run()
    sqlite.prepare('CREATE INDEX IF NOT EXISTS idx_bottlers_country ON bottlers(country_id)').run()
    sqlite.prepare('CREATE INDEX IF NOT EXISTS idx_distillers_region ON distillers(region)').run()
    sqlite.prepare('CREATE INDEX IF NOT EXISTS idx_bottlers_region ON bottlers(region)').run()
  } catch (_e) {
    // ignore
  }

  sqlite.prepare(`
    CREATE TABLE IF NOT EXISTS user_shelf (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      whisky_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `).run()

  try {
    sqlite.prepare('CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_shelf ON user_shelf(user_id, whisky_id)').run()
    sqlite.prepare('CREATE INDEX IF NOT EXISTS idx_user_shelf_user_updated ON user_shelf(user_id, updated_at)').run()
    sqlite.prepare('CREATE INDEX IF NOT EXISTS idx_user_shelf_status ON user_shelf(status)').run()
  } catch (_e) {
    // ignore
  }

  sqlite.prepare(`
    CREATE TABLE IF NOT EXISTS tasting_notes (
      id TEXT PRIMARY KEY,
      whisky_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published',
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

  const tastingNotesColumns = sqlite.prepare('PRAGMA table_info(tasting_notes)').all()
  const tastingNotesColumnNames = tastingNotesColumns.map((col: any) => col.name)
  if (!tastingNotesColumnNames.includes('status')) {
    sqlite.prepare(`ALTER TABLE tasting_notes ADD COLUMN status TEXT NOT NULL DEFAULT 'published'`).run()
  }

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

  sqlite.prepare(`
    CREATE TABLE IF NOT EXISTS user_aroma_profile (
      user_id TEXT PRIMARY KEY,
      avg_rating REAL,
      total_notes INTEGER,
      last_updated INTEGER
    )
  `).run()

  sqlite.prepare(`
    CREATE TABLE IF NOT EXISTS user_tag_stats (
      user_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      section TEXT NOT NULL,
      avg_score REAL NOT NULL,
      count INTEGER NOT NULL
    )
  `).run()

  sqlite.prepare(`
    CREATE TABLE IF NOT EXISTS moderation_terms (
      id TEXT PRIMARY KEY,
      term TEXT NOT NULL,
      category TEXT NOT NULL,
      lang TEXT NOT NULL,
      active INTEGER NOT NULL
    )
  `).run()

  const moderationCount = sqlite
    .prepare('SELECT COUNT(*) as count FROM moderation_terms')
    .get() as { count: number }

  if (!moderationCount || moderationCount.count === 0) {
    const seed = [
      { term: 'fuck', category: 'insult', lang: 'en' },
      { term: 'shit', category: 'insult', lang: 'en' },
      { term: 'bitch', category: 'insult', lang: 'en' },
      { term: 'asshole', category: 'insult', lang: 'en' },
      { term: 'cunt', category: 'insult', lang: 'en' },
      { term: 'dick', category: 'sexual', lang: 'en' },
      { term: 'pussy', category: 'sexual', lang: 'en' },
      { term: 'slut', category: 'sexual', lang: 'en' },
      { term: 'whore', category: 'sexual', lang: 'en' },
      { term: 'porn', category: 'sexual', lang: 'en' },
      { term: 'rape', category: 'sexual', lang: 'en' },
      { term: 'rapist', category: 'sexual', lang: 'en' },
      { term: 'nazi', category: 'hate', lang: 'en' },
      { term: 'hitler', category: 'hate', lang: 'en' },
      { term: 'racist', category: 'hate', lang: 'en' },
      { term: 'nigger', category: 'hate', lang: 'en' },
      { term: 'faggot', category: 'hate', lang: 'en' },
      { term: 'pute', category: 'insult', lang: 'fr' },
      { term: 'putain', category: 'insult', lang: 'fr' },
      { term: 'salope', category: 'insult', lang: 'fr' },
      { term: 'connard', category: 'insult', lang: 'fr' },
      { term: 'encule', category: 'insult', lang: 'fr' },
      { term: 'merde', category: 'insult', lang: 'fr' },
      { term: 'sexe', category: 'sexual', lang: 'fr' },
      { term: 'porno', category: 'sexual', lang: 'fr' },
      { term: 'viol', category: 'sexual', lang: 'fr' },
      { term: 'violeur', category: 'sexual', lang: 'fr' },
      { term: 'raciste', category: 'hate', lang: 'fr' },
      { term: 'nazi', category: 'hate', lang: 'fr' },
      { term: 'hitler', category: 'hate', lang: 'fr' },
      { term: 'sale juif', category: 'hate', lang: 'fr' },
      { term: 'sale arabe', category: 'hate', lang: 'fr' },
      { term: 'sale noir', category: 'hate', lang: 'fr' },
    ]

    const insert = sqlite.prepare(`
      INSERT INTO moderation_terms (id, term, category, lang, active)
      VALUES (@id, @term, @category, @lang, @active)
    `)

    const now = Date.now().toString(36)
    seed.forEach((row, index) => {
      insert.run({
        id: `${now}-${index}`,
        term: row.term,
        category: row.category,
        lang: row.lang,
        active: 1,
      })
    })
  }

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
