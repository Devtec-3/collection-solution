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
| 1 | ~~Postgres URL~~ | **Done.** Neon `ep-restless-union-be04b263` is connected, migrated and seeded. | — |
| 2 | **Render API key** (`rnd_...`) | Optional now: `render.yaml` is in the repo, so the service can be created from the Render dashboard in one click. The key only lets me do it without you. | Render → Account Settings → API Keys → Create |
| 3 | **Meta / Facebook Business Portfolio** | WhatsApp Cloud API needs a verified business, a phone number not currently on WhatsApp, and a display name. Approval takes days, not minutes. | business.facebook.com |
| 4 | **Payment provider keys** | You said use the client's own. Needed only when we take payment links; until then staff mark payments manually. | Paystack or Flutterwave dashboard |
| 5 | **Voice number** | Either a new number (Twilio / Africa's Talking) or call-forwarding from an existing line. Costs money monthly, no free tier. | Twilio or Africa's Talking |
| 6 | **Cost prices + opening stock** | Without them profit and stock value are meaningless. | The client's Excel |
| 7 | **Gemini API key** | Powers real AI replies instead of the simulated ones. Free tier, no paid plan needed. | aistudio.google.com/apikey |
| 8 | **Storage keys** (optional) | Product photos. The snippet you sent is missing the endpoint and access keys, so uploads stay off until those arrive. | Provider dashboard → S3/R2 credentials |

Item 2 plus the blueprint is all that is needed to put this live on Render.
Items 3–8 follow without blocking the store: the shop runs on manual WhatsApp
replies while Meta approval is pending.

---

## 4. Render deployment

`render.yaml` describes the whole service, so Render does the setup itself.

1. Open **https://render.com/deploy?repo=https://github.com/Devtec-3/collection-solution**
   while signed in to your Render account (or **New → Blueprint** and pick the
   repo).
2. Render reads `render.yaml` and asks for the secret values:
   - `DATABASE_URL` — the Neon pooled string (already in `.env` locally)
   - `PAYMENT_ACCOUNT_NUMBER` — `9021905797`
   - `GEMINI_API_KEY` — once you have it (can be added later, the app runs without)
   `OWNER_EMAIL` / `OWNER_PASSWORD` are only used if the database is empty. It is
   already seeded, so you can skip them.
3. Apply. Build takes about a minute; the health check is `/api/health`.
4. The free plan sleeps after 15 idle minutes and takes ~1 minute to wake.
   Fine for testing with the client, not for a customer messaging at 11pm.
   Render Starter is $7/month and needs no code change.

### Alternative without a Render account step

`npm install && node server/index.js` runs the same server anywhere Node 22+ is
available. Nothing in `server/` is Render-specific.

### What the live server gives you today

A real API at `/api/*` with real login and real data in Neon: products,
customers, sales with part payments, dashboard totals, settings, audit log,
AI test console. The nine HTML screens are still the prototype front end and
are wired to the API next — see section 5.

### The free-tier trade-off, stated plainly

Render's free web service sleeps after 15 idle minutes and takes about a minute
to wake. Fine for testing with the client; not fine for a customer messaging at
11pm. When that moment comes, Render Starter is $7/month and a proper Postgres
about $6 — roughly ₦5,000 a month, and the app needs no code change.

---

## 4a. WhatsApp webhook — how it will switch on

The endpoint is live and already verified:

- Callback URL: `https://dheelarhs-collection.onrender.com/api/whatsapp/webhook`
- Verify token: `WHATSAPP_VERIFY_TOKEN` (currently `dheelarh-verify-2026` in Render)
- Subscribe to the `messages` field.

What happens today, without Meta credentials: an inbound message creates or
matches the customer, writes the conversation, writes an assistant reply and
flags it `whatsapp.reply_pending` for staff. The moment `WHATSAPP_TOKEN` and
`WHATSAPP_PHONE_NUMBER_ID` are set, the same code posts the reply to Meta and
nobody has to change the app.

Tested with a simulated Meta payload: verification returned the challenge with
the token and `403` without it, and the payload produced a customer record, a
conversation, two stored messages and a reply.

## 4b. Importing the existing Excel file

Inventory → **Import** accepts the client's sheet saved as CSV (Excel: *Save as
→ CSV*). Recognised columns, any order: `name, category, size, colour, grade,
cost_price, selling_price, quantity, low_stock`. Only `name` and
`selling_price` are required; a thousands separator like `9,500` is accepted and
unreadable rows are reported as skipped rather than failing the whole import.

Customer book → **Import** takes `name, phone, location, tags, notes`. Duplicate
phone numbers are skipped, never overwritten — the second import of the same
file adds nothing.

## 5. What is not done yet

- **The nine screens are wired to the API** (`js/api.js`): login, dashboard,
  inventory, sales, customers, inbox, AI console, reports and activity all read
  and write the Neon database. Verified in headless Chrome, including creating
  a customer and recording a sale through the UI.
- The WhatsApp Cloud API webhook is not written yet. The AI engine itself is
  (`server/ai.js`): it calls Gemini or Claude with five tools, and every answer
  comes from the database. The test console in the app already talks to it.
- Product photo uploads wait on the missing storage endpoint and keys.
- No automated test suite yet; verification so far is the manual pass above.

---

## 5a. AI provider: the Anthropic key has no credit

The Anthropic key supplied is valid — it authenticates — but the account behind
it has a zero balance, so every call returns:

> `400 invalid_request_error` — "Your credit balance is too low to access the
> Anthropic API."

Two ways forward, both without touching code:

1. **Top up Anthropic** at console.anthropic.com → Billing (US$5 minimum). The
   key is already in Render as `ANTHROPIC_API_KEY`, so the assistant starts
   working on the next message after the balance lands.
2. **Use Gemini free instead** — see the next section. A `GEMINI_API_KEY` takes
   priority over Anthropic the moment it is set.

Until either happens the app is safe on purpose: `/api/ai/status` reports
`ready: false` with the provider's message, the customer is told a staff member
will reply, the conversation is flagged for a human, and the model is not called
again for five minutes.

## 5b. AI provider: Gemini free tier

Your Gemini **Pro subscription is not API access** — Google One AI Premium does
not include it. You do not need it anyway:

1. Go to **https://aistudio.google.com/apikey** with your Google account.
2. **Create API key** in a new or existing project. Copy it (starts `AIza…`).
3. Put it in `.env` as `GEMINI_API_KEY=…` and in Render's environment.
4. Restart. **Settings → AI** now reports `provider: gemini`.

That is the free tier: generous per-minute and per-day limits, no card. The
model is `gemini-2.5-flash` — fast and cheap enough for shop replies. Claude
still works if you ever prefer it: set `ANTHROPIC_API_KEY` and it takes
priority only when no Gemini key exists. No code changes either way.

Cost at real volume: a boutique answering ~40 conversations a day sits inside
Gemini's free tier. Above that it is fractions of a naira per message.

---

## 6. Credentials

No password is stored in this repository. The first owner account is created
from `OWNER_EMAIL` / `OWNER_PASSWORD` on the first boot; if the password is
left empty the server generates a strong one and prints it once.

- Owner sign-in for now: `muhammadabdulwadalata@gmail.com`. Swap to the
  client's before handover.
- The password `Ayinde2005` is written in this chat, in `.env` and in your
  notes. Change it from the Settings screen on day one, before real customer
  records go in.
- Staff test account `amaka@dheelarhs.test` is local-only and is not part of
  the seed; delete it before go-live.
- Payment: transfer only. Opay **9021905797**, account name Dheelarh's
  Collection, stored in `settings.payments` and given to the assistant as
  information. The AI can share those details; **only staff can mark a payment
  received.**

### Neon Auth and Neon Storage — what I did and did not use

- **Neon Auth** (`ep-restless-union-be04b263.neonauth…`): not connected. The app
already has its own login with scrypt hashes and server-side sessions, and Neon
Auth is still beta and would add a client library plus a rewrite of the login
screen. Worth revisiting when the client wants Google sign-in or password reset
by email; nothing else depends on it.
- **Neon / S3 storage**: the snippet you pasted is missing the endpoint, access
key and secret, so nothing could be wired. Send those four values and photo
uploads take about 20 minutes to add.
