'use strict';
/**
 * First-run seed.
 *
 * Everything in here comes from the client's own WhatsApp catalogue, price
 * list and policy poster. Nothing is invented: where a number is unknown
 * (cost price, opening stock) it is left at 0 so the owner fills it in.
 *
 * Run automatically on boot only when the users table is empty.
 */
const crypto = require('node:crypto');
const db = require('./db');
const { hashPassword } = require('./auth');

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

const BUSINESS = {
  name: "Dheelarh's Collection",
  tagline: 'Home of Varieties',
  address:
    'No. 80/11, Along Zololo Junction, beside Skynet Café, Murtala Mohammed Way, Jos 930105, Plateau State',
  phones: ['0902105797', '0814875502'],
  whatsapp: '0902105797',
  hours: 'Open 24 hours',
  currency: 'NGN',
  delivery: 'Nationwide delivery. Delivery attracts charges; urgent orders attract extra charges.',
  pickup: 'Pick-up at the shop in Jos, or send someone — please tag your item so we hand over complete items.',
  social: {
    tiktok: 'dheelarh_22',
    instagram: 'dheelarhs collection',
    facebook: 'Amoo Fadheelat Adelodapo',
  },
};

const POLICIES = [
  'No order without payment.',
  'No "keep for me" without payment.',
  'Half payment / instalment is allowed based on agreement.',
  'Only full payment validates delivery or pick-up.',
  'No change of order after payment.',
  'Make proper enquiries before payment — we do not refund.',
  'No change or return of order after payment.',
  'Always confirm availability before payment. No refund.',
  'Delivery attracts charges. Urgent orders attract extra charges.',
  'No voice notes and no WhatsApp calls — please send a text message.',
  'Always confirm your items before leaving the shop; complaints are not attended to after you have left.',
  'Tag your item when collecting, or when sending someone, so the complete order is handed over.',
];

const CATEGORIES = [
  'Bags',
  'Shoes & Sneakers',
  'Abaya',
  'Veil & Shaddah',
  'Atampa (Ankara)',
  'Jalabiya',
  'Laces',
  'Kitchen Utensils',
  'Household Items',
  'Smart Watches',
  'Hair & Beauty Tools',
];

// Straight from the client's WhatsApp catalogue. Cost price is 0 (unknown).
const PRODUCTS = [
  { name: 'Straight comb', category: 'Hair & Beauty Tools', price: 5500, qty: 12, size: '', colour: 'Black', grade: 'Standard' },
  { name: 'Bubu gown', category: 'Abaya', price: 6500, qty: 8, size: 'Free', colour: 'Green print', grade: 'Standard' },
  { name: 'Dior bag', category: 'Bags', price: 15000, qty: 6, size: 'Medium', colour: 'Mixed', grade: 'Premium' },
  { name: 'Phone stand', category: 'Household Items', price: 2000, qty: 20, size: '', colour: 'Pink', grade: 'Standard' },
  { name: 'Selfie stick', category: 'Household Items', price: 4500, qty: 0, size: '', colour: 'Black', grade: 'Standard' },
];

async function seed() {
  const existing = await db.one('SELECT id FROM users LIMIT 1');
  if (existing) return { seeded: false };

  // Credentials are never hard-coded: they come from the environment. If the
  // password is missing a strong one is generated and printed once.
  const ownerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
  if (!ownerEmail) throw new Error('OWNER_EMAIL is not set. Add it to .env or to the host environment.');
  let ownerPassword = process.env.OWNER_PASSWORD || '';
  let generated = false;
  if (!ownerPassword) {
    ownerPassword = crypto.randomBytes(9).toString('base64url');
    generated = true;
  }

  await txSeed(ownerEmail, ownerPassword);
  return { seeded: true, ownerEmail, generatedPassword: generated ? ownerPassword : null };
}

async function txSeed(ownerEmail, ownerPassword) {
  const stamp = now();

  await db.tx(async (t) => {
    await t.run(
      'INSERT INTO users (id, name, email, phone, role, password_hash, active, created_at) VALUES (?,?,?,?,?,?,1,?)',
      [
        uid(),
        'Store owner',
        ownerEmail,
        BUSINESS.phones[0],
        'owner',
        hashPassword(ownerPassword),
        stamp,
      ]
    );

    const settings = {
      business: BUSINESS,
      policies: POLICIES,
      categories: CATEGORIES,
      ai: {
        enabled: true,
        schedule: { mode: 'always', after: '18:00', weekends: true },
        greeting: `Welcome to ${BUSINESS.name} (${BUSINESS.tagline}). You are chatting with our virtual assistant. How can we help you today?`,
        tone: 'Polite, short and friendly. English, or simple Nigerian Pidgin if the customer uses it.',
        maxDiscountPct: 0,
        escalateTopics: ['complaint', 'refund', 'bulk order', 'custom order', 'payment confirmation', 'anything unclear'],
        humanApprovalItems: [],
        brandVoiceNote: 'No voice notes and no WhatsApp calls — the assistant always replies by text.',
      },
      payments: { provider: null, note: 'Manual confirmation only until a payment provider is connected.' },
    };

    for (const [key, value] of Object.entries(settings)) {
      await t.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
    }

    for (const p of PRODUCTS) {
      await t.run(
        `INSERT INTO products (id, sku, name, category, size, colour, grade, cost_price, selling_price, qty, low_stock_at, photo, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,0,?,?,2,NULL,?,?,?)`,
        [
          uid(),
          null,
          p.name,
          p.category,
          p.size,
          p.colour,
          p.grade,
          p.price,
          p.qty,
          p.qty > 0 ? 'available' : 'sold out',
          stamp,
          stamp,
        ]
      );
    }

    await t.run('INSERT INTO audit_log (id, user_id, actor, action, detail, created_at) VALUES (?,?,?,?,?,?)', [
      uid(),
      null,
      'system',
      'seed.initial',
      'Store created with catalogue, policies and owner account from the client’s WhatsApp catalogue.',
      stamp,
    ]);
  });
}

module.exports = { seed, BUSINESS, POLICIES, CATEGORIES };
