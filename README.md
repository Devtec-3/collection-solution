# Dheelarh's Collection — Store System

The shop's real system: stock, sales, part payments and the customer book live in a database, and the AI sales assistant answers customers from that live stock — never from imagination.

**Live:** https://dheelarhs-collection.onrender.com
**Business:** Dheelarh's Collection · "Home of Varieties" · Jos, Plateau State
**Currency:** Naira (₦)

| Live app | Database | Source |
|---|---|---|
| [dheelarhs-collection.onrender.com](https://dheelarhs-collection.onrender.com) | Neon Postgres (persistent) | this repo, `main` |

---

## Sign in

| Account | Email | Notes |
|---|---|---|
| Owner | `muhammadabdulwadalata@gmail.com` | full access: profit, settings, staff, AI, audit log |

The password is not in this repository. It is set in the Render environment as `OWNER_PASSWORD` and used once, on the first boot of an empty database. **Change it from Settings on day one** and hand the account to the client at launch.

Staff accounts are created by the owner (Settings → Staff). Server-side rules mean a staff login physically cannot read cost price, profit, settings or the audit log, and cannot give a discount.

---

## What is live today

| Module | State |
|---|---|
| Login | Real accounts, scrypt password hashes, database sessions, httpOnly cookie, login rate limit |
| Dashboard | Revenue, stock value, items sold, low stock, top sellers, needs-attention — computed from the database |
| Inventory | Add, edit, delete, restock, search, filter, sort, CSV export |
| Sales & payments | Record a sale, part payment, balance, receipt, delete (owner), stock decremented in a transaction |
| Customer book | Add, edit, delete, tags, notes, purchase history — contacts survive a lost phone |
| Inbox | Conversations and messages stored against the customer; staff reply takes over from the assistant |
| AI assistant | Gemini or Claude with five tools: stock lookup, alternatives, business details, draft order, escalate. Every fact comes from a SQL query |
| Activity log | Written by the server on every change, including AI actions |
| Settings | Business profile, policies, AI limits, alerts, privacy |
| Payments | Bank transfer only: Opay **9021905797**, Dheelarh's Collection. Only staff can mark money received |

**Profit is honest:** until cost prices are entered, the dashboard says *Unknown — add cost prices* instead of showing takings as profit. The database stores `profit_known = 0` for those sales.

---

## What is not connected yet

| Piece | Status | What unblocks it |
|---|---|---|
| AI API key | Engine is built; without a key every chat is handed to a human | `GEMINI_API_KEY` from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (free, no card) |
| WhatsApp replies | Not wired | Meta Business Portfolio approval for the Cloud API |
| Voice calls | Not built | Twilio / Africa's Talking number (note: the shop's policy says **no WhatsApp calls**, so voice is a normal phone line) |
| Product photos | URL field only | S3-compatible endpoint + access key + secret |
| Automatic backups | Neon keeps point-in-time history; scheduled dumps not set up | Neon paid plan or a nightly export job |
| Cost prices & opening stock | Unknown by design | The client's Excel |

---

## Run it locally

```bash
npm install          # only dependency: pg
cp .env.example .env # then fill DATABASE_URL and OWNER_* 
node server/index.js # http://localhost:3000
```

Without `DATABASE_URL` the server falls back to SQLite in `.data/` for development. Nothing else changes.

## Deploy

`render.yaml` describes the whole service, so Render can create it from this repo in one click. Environment variables: `DATABASE_URL`, `PAYMENT_ACCOUNT_NUMBER`, and optionally `GEMINI_API_KEY`. Pushing to `main` redeploys automatically.

---

## Structure

```
index.html          the shell: sign-in screen and app chrome
styles.css          design system, light and dark
js/data.js          shape of the in-memory store the views read
js/api.js           API layer: loads the database into that store, and every write
js/core.js          formatting, spreadsheet-accurate calculations, UI primitives
js/charts.js        dependency-free SVG charts
js/ai.js            browser-side assistant simulation (test console fallback)
js/views-*.js       dashboard, inventory, sales, customers, inbox, AI, reports, settings
js/app.js           boot, sign-in, routing, events
server/index.js     HTTP server: static files + /api
server/api.js       every endpoint, all validation and role rules
server/ai.js        Gemini / Claude tool calling with guardrails
server/db.js        Postgres (production) or SQLite (local), one SQL dialect
server/schema.js    tables
server/seed.js      first-run data: the client's catalogue, prices and policies
LIVE-SETUP.md       go-live checklist, credentials, what is still missing
```

## Guardrails the assistant cannot break

- No invented products, prices or stock — a tool call or nothing.
- Never reveals cost price, profit, margins or another customer's record.
- Never confirms a payment; it may only give the account details.
- No discount beyond the owner's limit (currently 0%).
- Complaints, refunds, bulk or custom orders, payment confirmations and anything unclear go to a human, flagged on the dashboard.
- Says it is the store's virtual assistant, and replies by text only.

---

## Verified

Manual end-to-end pass against the live Neon database: login and session, wrong password refused, unauthenticated requests refused, staff blocked from cost/profit/settings/audit, sale with part payment recorded (`part-paid`, balance kept), stock decremented, customer auto-created from the sale, over-selling refused, payment added to an existing sale, product create/edit/restock/delete, customer create/edit/delete, settings saved, AI fallback when no key is set. Front end driven in headless Chrome with no console errors beyond the expected 401 on the guest `/api/me` call.
