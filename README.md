# Adeola Collections — Store System (prototype)

A working, single-page store system for a fashion dealer selling clothes, shoes, bags and accessories. It replaces a loose Excel sheet with inventory, sales, part payments, a customer book that survives a lost phone, and an AI sales assistant that answers from live stock only.

**Open `index.html` in a browser.** No install, no build, no account. All data is clearly-labelled sample data held in memory; refreshing restores the sample business.

Sign-in offers two demo accounts:

| Account | What they can see |
| --- | --- |
| **Admin / Owner** — Adeola | Everything, including cost, profit, settings, staff, AI controls |
| **Staff** — Amaka | Sales, stock, customers, inbox. No cost, profit, settings or activity log |

The password field is pre-filled; this is a role demonstration, not real authentication.

---

## 1. Workflow analysis

The business runs on a simple chain, and every step should leave a record:

```
stock in → pricing → customer enquiry (message or call)
        → AI or staff reply → hold / draft order
        → payment → sale recorded → stock reduced → reports
```

**Where each step lives in this prototype**

| Step | Screen | What is recorded |
| --- | --- | --- |
| Stock in | Inventory → Add product / Restock | Cost, selling price, quantity, size, colour, grade, low-stock level |
| Pricing | Inventory | One selling price per product — the only price the assistant may quote |
| Enquiry | Inbox | Channel (WhatsApp or call), customer, full message history |
| Reply | Inbox / AI console | Who replied (AI or named staff), every tool call the AI made |
| Hold | AI assistant → Orders | Draft order, expiry time, own approval step |
| Payment | Sales → Record payment | Amount, method, who confirmed it |
| Sale | Sales → Record sale | Line items, discount, paid, balance, cost at time of sale |
| Stock down | automatic | Quantity reduced when the sale is saved |
| Reports | Reports | Sales, stock valuation, balances, profit by item |

**Assumptions**

1. One shop, one stock location (Ikeja). No warehouse transfers.
2. Naira only, prices include no VAT; tax is not modelled.
3. Customers are individuals or small resellers; wholesale pricing is decided by the owner, never the assistant.
4. A sale can be part-paid; the balance is tracked against the customer.
5. Stock is owned outright (no consignment).
6. WhatsApp is the main channel; phone calls are secondary but must be logged.
7. The person using this is not technical and will mostly use a phone.
8. History in the demo is already reflected in opening stock; only sales you record now reduce stock further.

**Risks worth naming**

| Risk | Why it matters | Mitigation in the design |
| --- | --- | --- |
| Another WhatsApp ban | Unofficial automation is the usual cause | Official Business Platform only, opt-in, templates, no scraping |
| AI invents a product or price | Customer is told something false | Tool-calling reads live inventory; no match → say so and escalate |
| AI confirms payment | Money is released without being received | Hard-coded: assistant can never mark a payment received |
| Overselling a held item | Two customers promised the same piece | Holds are counted against available stock; all-held → escalate |
| Contact loss | The original problem | Customer book stored server-side, CSV import/export, scheduled backups |
| Cost price leaked | Destroys margin in a small market | Cost and profit never leave the owner account or reach the assistant |
| Staff adoption | Software that is not used protects nothing | Plain language, big buttons, quick actions, one screen per job |
| Network / power | Shop internet is unreliable | Production must queue outgoing messages and work offline-first at the till (phase 2) |

---

## 2. What is in the prototype

**Dashboard** — revenue, gross profit (owner), stock value, items sold, low stock, new customers, top sellers, pending AI orders, AI conversations handled, and a “needs human attention” list. Period switch 7/30/90 days.

**Inventory** — add, edit, delete, restock, search, filter by category/status, sort on any column. Cost column hidden from staff. CSV import (paste or file, with column preview) and export. Per-product low-stock threshold and a `held` count from AI reservations.

**Sales & accounts** — record multi-item sales against a saved customer or a new one created at the till, discounts (owner only), part payments, receipts that print or copy for WhatsApp, and “record payment”. A plain-language **How this is calculated** panel maps every figure to its Excel formula.

**Customer book** — name, WhatsApp number, area, tags (VIP / Wholesale / Retail), notes, purchase history, total spent, outstanding balance, last purchase. CSV import/export, profile with purchase history, and JSON backup/restore.

**Unified inbox** — WhatsApp and call conversations in one list, filtered by AI / staff / needs human. Full transcript, AI tool-call traces, take over, hand back to AI, “suggest a reply”, and a click-to-chat link with QR.

**AI assistant** — overview and guardrails, behaviour settings (on/off, schedule, hours, discount limit, approval threshold, escalation, tone, policies), AI order approval queue, **chat and voice test consoles**, and analytics listing which tools it used and which questions it could not answer.

**Reports** — sales summary, stock valuation, customer balances, profit by item. Period selector, CSV export, print / save as PDF (print stylesheet removes all app chrome).

**Activity log** — every change with actor and time, including AI actions and guardrail refusals. Exportable.

**Settings** — business profile, default low-stock level, staff accounts, a permissions matrix, alerts, backup schedule, privacy controls and a demo reset.

Also: light/dark mode, keyboard shortcuts (`S` new sale, `I` inbox, `⌘/Ctrl K` search), global search across products, customers, sales and conversations, responsive layout down to 390px, and empty states with guidance.

---

## 3. AI rules, as implemented

**It can**
- Look up live stock by product, size, colour or category and quote the saved selling price.
- Say an item is sold out and suggest in-stock alternatives.
- Answer delivery, opening hours, address and payment-method questions from settings.
- Create a hold (24h) and a draft order, and save a new contact with name and phone.
- Reply in English or simple Nigerian Pidgin, briefly and politely.

**It cannot**
- Invent a product, size, price, discount or policy. No match → says so.
- Give a discount beyond the owner’s limit. At 0% it refuses and escalates; above 0% it names the maximum and still asks staff to confirm.
- Confirm a payment, mark an order paid, or release goods.
- Reveal cost price, profit, or another customer’s details.
- Approve its own draft order, or convert a hold into a sale.
- Hide that it is a virtual assistant.

**It escalates** on: complaints and returns, refunds, wholesale/bulk pricing, custom or made-to-measure orders, discount requests, payment claims, questions it cannot answer confidently, all units already on hold, and any request for a human.

Every escalation appears on the dashboard, in the inbox as “needs human”, and in the activity log with a reason.

**How the numbers work** — one calculation module is used by every screen, receipt and report:

```
line total   = qty × selling price
subtotal     = Σ line totals
total        = subtotal − discount
balance      = total − paid
cost of goods= Σ qty × cost price at time of sale
gross profit = total − cost of goods
stock value  = Σ qty × cost price
```

---

## 4. What I need from you next

Nothing here is invented in production — these are the inputs that turn the prototype into your shop:

1. **Your Excel file** (or a screenshot of its columns). I need the real column names so the import maps exactly. Ideally: product name, category, size, colour, quality/grade, cost price, selling price, quantity.
2. **Your category list** — the demo uses Dresses, Tops, Trousers, Shoes, Bags, Accessories. Yours may be different.
3. **Opening stock count** and how you value it (cost or selling price).
4. **Business hours**, shop address, delivery zones and fees, returns/exchange policy.
5. **Discount policy** — is any discount allowed, and up to what percentage? Who can approve it?
6. **Payment details** — bank account(s), whether you use POS, and later a Paystack/Flutterwave account.
7. **Staff** — names, roles, who may see profit, who may delete records.
8. **WhatsApp** — the number you want customers to use, whether you have a Facebook Business portfolio, and your preferred display name.
9. **Voice** — do you want a new local number for calls, or to forward your existing line after hours?
10. **Brand voice** — three words for how the assistant should sound, plus any phrases you always use.

For the production plan, costs, WhatsApp/voice setup, Excel import, training notes and testing checklist, see **[ROADMAP.md](ROADMAP.md)**.

---

## Files

```
index.html          app shell, login, layout
styles.css          design system, components, responsive, print
js/data.js          labelled sample data + seeded history
js/core.js          state, formatting, calculations, icons, modals, CSV
js/charts.js        dependency-free SVG charts
js/ai.js            assistant engine: intents, tool calls, guardrails
js/views-a.js       dashboard, inventory, sales
js/views-b.js       customers, inbox, AI console
js/views-c.js       reports, activity, settings
js/app.js           routing, roles, search, quick actions, events
```

Design direction is grounded in patterns from Stripe (tables and layered disclosure), Linear (restraint, one accent), Mercury (trust through a single number) and Attio (AI as a designed surface): one typeface family, Geist with Geist Mono for figures, a warm neutral canvas, ink as the primary action colour, and a single pine accent. Type scale: 10–11px labels with tracking, 12.5–14px body, 19px page titles, 26px metrics with tabular figures.
