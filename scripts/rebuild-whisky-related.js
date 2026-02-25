#!/usr/bin/env node

const databaseUrl = process.env.DATABASE_URL || ''
const isMysql = databaseUrl.startsWith('mysql://') || databaseUrl.startsWith('mariadb://')
const topLimitArg = process.argv.find((arg) => arg.startsWith('--top='))
const topLimit = Math.max(1, Number(topLimitArg?.split('=')[1] || '20'))
const minScore = 2

function normalizeText(value) {
  if (!value || typeof value !== 'string') return null
  const clean = value.trim().toLowerCase()
  return clean.length ? clean : null
}

function score(source, candidate) {
  let result = 0
  if (normalizeText(source.type) && normalizeText(source.type) === normalizeText(candidate.type)) result += 0
  if (source.bottling_type === 'DB' && source.distiller_id && source.distiller_id === candidate.distiller_id) result += 4
  if (source.bottling_type === 'IB' && source.bottler_id && source.bottler_id === candidate.bottler_id) result += 4
  if (source.country_id && source.country_id === candidate.country_id) result += 0
  if (normalizeText(source.region) && normalizeText(source.region) === normalizeText(candidate.region)) result += 2
  return result
}

function buildRows(whiskies) {
  const rows = []
  for (const source of whiskies) {
    const ranked = whiskies
      .filter((candidate) => candidate.id !== source.id)
      .map((candidate) => ({
        sourceId: source.id,
        relatedId: candidate.id,
        score: score(source, candidate),
      }))
      .filter((item) => item.score >= minScore)
      .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.relatedId.localeCompare(b.relatedId)))
      .slice(0, topLimit)

    rows.push(...ranked)
  }
  return rows
}

async function runMysql() {
  const mysql = require('mysql2/promise')
  const conn = await mysql.createConnection(databaseUrl)
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS whisky_related (
        whisky_id VARCHAR(36) NOT NULL,
        related_whisky_id VARCHAR(36) NOT NULL,
        score INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (whisky_id, related_whisky_id),
        KEY idx_whisky_related_whisky (whisky_id, score),
        KEY idx_whisky_related_related (related_whisky_id)
      )
    `)

    const [whiskies] = await conn.query(
      'SELECT id, bottling_type, distiller_id, bottler_id, country_id, region, type FROM whiskies'
    )
    const rows = buildRows(whiskies)

    await conn.beginTransaction()
    await conn.query('DELETE FROM whisky_related')

    if (rows.length) {
      const now = new Date()
      const values = rows.map((row) => [row.sourceId, row.relatedId, row.score, now, now])
      await conn.query(
        'INSERT INTO whisky_related (whisky_id, related_whisky_id, score, created_at, updated_at) VALUES ?',
        [values]
      )
    }

    await conn.commit()
    console.log(`Rebuild done (mysql): ${rows.length} relations for ${whiskies.length} whiskies.`)
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    await conn.end()
  }
}

function runSqlite() {
  const Database = require('better-sqlite3')
  const dbPath = databaseUrl.startsWith('file:') ? databaseUrl.replace(/^file:/, '') : './local.db'
  const conn = new Database(dbPath)

  conn.exec(`
    CREATE TABLE IF NOT EXISTS whisky_related (
      whisky_id TEXT NOT NULL,
      related_whisky_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      updated_at INTEGER DEFAULT (strftime('%s','now')),
      PRIMARY KEY (whisky_id, related_whisky_id)
    );
    CREATE INDEX IF NOT EXISTS idx_whisky_related_whisky ON whisky_related(whisky_id, score);
    CREATE INDEX IF NOT EXISTS idx_whisky_related_related ON whisky_related(related_whisky_id);
  `)

  const whiskies = conn
    .prepare('SELECT id, bottling_type, distiller_id, bottler_id, country_id, region, type FROM whiskies')
    .all()
  const rows = buildRows(whiskies)

  const insert = conn.prepare(
    `INSERT INTO whisky_related (whisky_id, related_whisky_id, score, created_at, updated_at)
     VALUES (?, ?, ?, strftime('%s','now'), strftime('%s','now'))`
  )

  const tx = conn.transaction(() => {
    conn.prepare('DELETE FROM whisky_related').run()
    for (const row of rows) {
      insert.run(row.sourceId, row.relatedId, row.score)
    }
  })
  tx()
  conn.close()
  console.log(`Rebuild done (sqlite): ${rows.length} relations for ${whiskies.length} whiskies.`)
}

async function main() {
  if (isMysql) {
    await runMysql()
    return
  }
  runSqlite()
}

main().catch((error) => {
  console.error('rebuild whisky_related failed:', error?.message || error)
  process.exit(1)
})
