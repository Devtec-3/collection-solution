'use strict';
/**
 * One schema, valid on both SQLite and Postgres.
 * Rules: TEXT/INTEGER only, no autoincrement, no dialect-specific types.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  role          TEXT NOT NULL,              -- owner | staff
  password_hash TEXT NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id            TEXT PRIMARY KEY,
  sku           TEXT,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  size          TEXT,
  colour        TEXT,
  grade         TEXT,
  cost_price    INTEGER NOT NULL DEFAULT 0,
  selling_price INTEGER NOT NULL DEFAULT 0,
  qty           INTEGER NOT NULL DEFAULT 0,
  low_stock_at  INTEGER NOT NULL DEFAULT 2,
  photo         TEXT,
  status        TEXT NOT NULL DEFAULT 'available',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  phone          TEXT NOT NULL,
  alt_phone      TEXT,
  location       TEXT,
  tags           TEXT,
  notes          TEXT,
  opt_out        INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS customers_phone ON customers (phone);

CREATE TABLE IF NOT EXISTS sales (
  id            TEXT PRIMARY KEY,
  invoice_no    TEXT NOT NULL,
  customer_id   TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  subtotal      INTEGER NOT NULL DEFAULT 0,
  discount      INTEGER NOT NULL DEFAULT 0,
  total         INTEGER NOT NULL DEFAULT 0,
  paid          INTEGER NOT NULL DEFAULT 0,
  profit        INTEGER NOT NULL DEFAULT 0,
  profit_known  INTEGER NOT NULL DEFAULT 1,   -- 0 when a line has no cost price yet
  status        TEXT NOT NULL,             -- draft | reserved | paid | part-paid | delivered | cancelled
  channel       TEXT NOT NULL DEFAULT 'counter',
  note          TEXT,
  created_by    TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS sales_invoice ON sales (invoice_no);

CREATE TABLE IF NOT EXISTS sale_items (
  id         TEXT PRIMARY KEY,
  sale_id    TEXT NOT NULL,
  product_id TEXT,
  name       TEXT NOT NULL,
  size       TEXT,
  unit_price INTEGER NOT NULL,
  unit_cost  INTEGER NOT NULL DEFAULT 0,
  qty        INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS sale_items_sale ON sale_items (sale_id);

CREATE TABLE IF NOT EXISTS payments (
  id         TEXT PRIMARY KEY,
  sale_id    TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  method     TEXT NOT NULL,
  reference  TEXT,
  taken_by   TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS payments_sale ON payments (sale_id);

CREATE TABLE IF NOT EXISTS conversations (
  id           TEXT PRIMARY KEY,
  customer_id  TEXT,
  channel      TEXT NOT NULL,              -- whatsapp | call | counter
  status       TEXT NOT NULL,              -- ai | staff | waiting | closed
  subject      TEXT,
  last_message TEXT,
  unread       INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  author          TEXT NOT NULL,           -- customer | ai | staff | system
  body            TEXT NOT NULL,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_conv ON messages (conversation_id);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         TEXT PRIMARY KEY,
  user_id    TEXT,
  actor      TEXT NOT NULL,                -- owner | staff | ai | system
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  detail     TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_created ON audit_log (created_at);

CREATE TABLE IF NOT EXISTS schema_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

module.exports = { SCHEMA };
