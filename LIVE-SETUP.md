# Go-live setup — Dheelarh's Collection

This is the checklist for turning the prototype into the system your client
actually runs the shop on. It is split into **what is built and verified**,
**what is still missing**, and **what happens on Render**.

---

## 1. Business details already captured (from the client's own posts)

| Field | Value |
|---|---|
| Business name | Dheelarh's Collection — "Home of Varieties" |
| Address | No. 80/11, Along Zololo Junction, beside Skynet Café, Murtala Mohammed Way, Jos 930105, Plateau State |
| Phone / WhatsApp | 0902105797 · 0814875502 |
| Hours | Open 24 hours |
| Trade | Wholesale and retail |
| Delivery | Nationwide; delivery and urgent orders attract extra charges |
| Socials | TikTok `dheelarh_22` · Instagram `dheelarhs collection` · Facebook Amoo Fadheelat Adelodapo |

**Policy text already loaded into the assistant's settings**, word for word in
spirit: no order without payment, no "keep for me" without payment, half
payment by agreement, only full payment validates delivery or pick-up, no change
of order after payment, no refunds, confirm availability before payment,
delivery and urgent orders attract extra charges, **no voice notes and no
WhatsApp calls** — text only, confirm your items before leaving the shop, tag
your item when sending someone to collect.

**Catalogue loaded:** straight comb ₦5,500 · bubu gown ₦6,500 · Dior bag
₦15,000 · phone stand ₦2,000 · selfie stick ₦4,500 (sold out, to show the
sold-out state).

**Categories loaded:** Bags · Shoes & Sneakers · Abaya · Veil & Shaddah ·
Atampa (Ankara) · Jalabiya · Laces · Kitchen Utensils · Household Items ·
Smart Watches · Hair & Beauty Tools.

---

## 2. What is built and verified

`server/` is a real backend — no framework, no build step, runs on Node 22+.

| Piece | State |
|---|---|
| Database schema (users, products, customers, sales, sale_items, payments, conversations, messages, settings, audit_log) | done, portable SQLite/Postgres |
| Real login — scrypt password hashing, DB-backed sessions, httpOnly cookie | done |
| Role rules enforced **server-side** — staff never receive cost price, profit, settings or the audit log | done |
| Sales with part payments, invoice numbers, stock decrement in a transaction | done |
| Automatic customer creation from a sale (no contact ever lost again) | done |
| Audit log written on every change | done |
| Dashboard totals computed from the database | done |
| Path-traversal and private-file protection, security headers, login rate limit | done |

Verified against the running server: wrong password rejected, correct password
issues a session, a ₦11,000 sale with ₦5,000 paid became `part-paid` with a
₦6,000 balance and dropped stock 12 → 10, over-selling 999 units was refused,
a zero-payment sale became `awaiting payment`, staff requests for profit, cost,
audit, discounts and settings were all refused, and unauthenticated requests
were refused.

### The honest bit about profit

Your client has not given cost prices yet, so **profit is deliberately shown as
"unknown" instead of a fake number.** A test sale of ₦11,000 was briefly
reporting ₦11,000 profit because cost was 0 — that is now fixed: the sale
carries `profit_known = 0`, the dashboard reports `profit_unknown_sales: 1` and
`products_without_cost: 4`, and stock shows retail value (₦237,000) until real
costs arrive. Nothing is invented to look good.

---

## 3. What is still missing (this is the blocking list)

| # | Needed | Why it blocks | Where it comes from |
|---|---|---|---|
| 1 | **Render API key** (`rnd_...`) | I cannot sign in to your Render account, only you can create the key. With it I create the service, set env vars and deploy. | Render → Account Settings → API Keys → Create |
| 2 | **Postgres URL** | Render's free Postgres deletes itself 30 days after creation. A Neon free database persists. | neon.tech free project, or Render paid Postgres |
| 3 | **Meta / Facebook Business Portfolio** | WhatsApp Cloud API needs a verified business, a phone number not currently on WhatsApp, and a display name. Approval takes days, not minutes. | business.facebook.com |
| 4 | **Payment provider keys** | You said use the client's own. Needed only when we take payment links; until then staff mark payments manually. | Paystack or Flutterwave dashboard |
| 5 | **Voice number** | Either a new number (Twilio / Africa's Talking) or call-forwarding from an existing line. Costs money monthly, no free tier. | Twilio or Africa's Talking |
| 6 | **Cost prices + opening stock** | Without them profit and stock value are meaningless. | The client's Excel |
| 7 | **Claude API key** | Powers real AI replies instead of the simulated ones. | console.anthropic.com |

Items 1 and 2 are all I need to put this live on Render tonight. Items 3–7 can
follow without blocking the store going live — the shop can run on manual
WhatsApp replies while the API is approved.

---

## 4. Render deployment (once I have the API key)

1. Create the Postgres database first (Neon free tier, or Render Postgres).
2. Create a **Web Service** from `github.com/Devtec-3/collection-solution`.
   - Build command: `npm install --omit=dev`
   - Start command: `npm start`
   - Health check path: `/api/health`
3. Environment variables:
   - `DATABASE_URL` — the Postgres connection string
   - `NODE_ENV=production`
   - `OWNER_EMAIL` / `OWNER_PASSWORD` — the first sign-in, changed afterwards
4. First boot seeds the store, the catalogue and the policy text.
5. **Sign in and immediately change the password.** `Ayinde2005` is a
   placeholder for setup, not a production password, and it is written in this
   file and in `.env.example`.

### The free-tier trade-off, stated plainly

Render's free web service sleeps after 15 idle minutes and takes about a minute
to wake. Fine for testing with the client; not fine for a customer messaging at
11pm. When that moment comes, Render Starter is $7/month and a proper Postgres
about $6 — roughly ₦5,000 a month, and the app needs no code change.

---

## 5. What is not done yet

- The nine screens still read the in-memory demo data. Wiring them to this API
  is the next chunk of work, screen by screen.
- The AI assistant is still the scripted simulation; the Claude tool-calling
  version and the WhatsApp webhook come after the screens are wired.
- No automated test suite yet; verification so far is the manual pass above.

---

## 6. Credentials in this build

- Owner sign-in: `muhammadabdulwadudalata@gmail.com` / `Ayinde2005`
  (yours for now, to be replaced with the client's own before handover).
- Staff test account: `amaka@dheelarhs.test` / `staffpass1` — created for
  permission testing only, delete it before go-live.
- Payment: the client's own provider, per your instruction. Nothing is
  connected yet.
