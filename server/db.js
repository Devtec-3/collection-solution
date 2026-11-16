'use strict';
/**
 * Database layer.
 *
 * Local development  -> node:sqlite (built into Node 22+, zero install)
 * Production (Render) -> Postgres via DATABASE_URL
 *
 * The SQL is written in one portable dialect:
 *   - IDs are app-generated UUIDs (TEXT PRIMARY KEY), never autoincrement
 *   - timestamps are ISO-8601 TEXT
 *   - money is INTEGER naira
 *   - placeholders are always '?' and are rewritten to $1..$n for Postgres
 */
const fs = require('node:fs');
const path = require('node:path');
const { SCHEMA } = require('./schema');

let mode = 'sqlite';
let pool = null;
let sqlite = null;

const toPg = (sql) => {
  let i = 0;
  return sql.replace(/\?/g, () => '$' + ++i);
};

async function init() {
  const url = process.env.DATABASE_URL || '';
  if (/^postgres(ql)?:\/\//i.test(url)) {
    mode = 'pg';
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: url,
      ssl: /sslmode=require/i.test(url) ? { rejectUnauthorized: false } : undefined,
      max: 5,
    });
    await pool.query(SCHEMA);
  } else {
    const { DatabaseSync } = require('node:sqlite');
    const file = process.env.SQLITE_PATH || path.join(__dirname, '..', '.data', 'store.db');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    sqlite = new DatabaseSync(file);
    sqlite.exec('PRAGMA journal_mode = WAL;');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    sqlite.exec(SCHEMA);
  }
  return mode;
}

async function all(sql, params = []) {
  if (mode === 'pg') return (await pool.query(toPg(sql), params)).rows;
  return sqlite.prepare(sql).all(...params);
}

async function one(sql, params = []) {
  const rows = await all(sql, params);
  return rows[0] || null;
}

async function run(sql, params = []) {
  if (mode === 'pg') return (await pool.query(toPg(sql), params)).rowCount;
  return sqlite.prepare(sql).run(...params).changes;
}

/**
 * Transaction helper. The callback receives an executor with the same
 * all/one/run shape, bound to the transaction, and MUST use it rather than
 * the module-level helpers.
 */
async function tx(fn) {
  if (mode === 'pg') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await fn(executor(client));
      await client.query('COMMIT');
      return r;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    const r = await fn(executor(sqlite));
    sqlite.exec('COMMIT');
    return r;
  } catch (err) {
    sqlite.exec('ROLLBACK');
    throw err;
  }
}

function executor(conn) {
  const isPg = typeof conn.query === 'function';
  return {
    all: async (sql, params = []) =>
      isPg ? (await conn.query(toPg(sql), params)).rows : conn.prepare(sql).all(...params),
    one: async (sql, params = []) => {
      const rows = isPg
        ? (await conn.query(toPg(sql), params)).rows
        : conn.prepare(sql).all(...params);
      return rows[0] || null;
    },
    run: async (sql, params = []) =>
      isPg ? (await conn.query(toPg(sql), params)).rowCount : conn.prepare(sql).run(...params).changes,
  };
}

module.exports = { init, all, one, run, tx, toPg, get mode() { return mode; } };
