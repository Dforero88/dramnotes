import crypto from 'crypto'

type DbSchema = {
  countries: any
  users: any
  distillers: any
  bottlers: any
  whiskies: any
}

const databaseUrl = process.env.DATABASE_URL || ''
const isMysqlUrl = databaseUrl.startsWith('mysql://') || databaseUrl.startsWith('mariadb://')
const isProduction = process.env.NODE_ENV === 'production'

if (isProduction && !isMysqlUrl) {
  throw new Error('DATABASE_URL doit être une URL MySQL/MariaDB en production')
}

const useMysql = isMysqlUrl || isProduction

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

  return { countries, users, distillers, bottlers, whiskies }
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

  return { countries, users, distillers, bottlers, whiskies }
}

const schema: DbSchema = useMysql ? createMysqlSchema() : createSqliteSchema()
export const { countries, users, distillers, bottlers, whiskies } = schema

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
