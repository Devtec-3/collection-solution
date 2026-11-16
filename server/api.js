'use strict';
/**
 * JSON API. Every write is validated and recorded in the audit log.
 * The browser is never trusted: prices, costs and stock are read from the
 * database, never taken from the request.
 */
const crypto = require('node:crypto');
const db = require('./db');
const auth = require('./auth');
const ai = require('./ai');

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const isOwner = (u) => u && u.role === 'owner';

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/* ---------------- serializers ---------------- */

function product(p, user) {
  const owner = isOwner(user);
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category,
    size: p.size,
    colour: p.colour,
    grade: p.grade,
    selling_price: p.selling_price,
    cost_price: owner ? p.cost_price : undefined,
    qty: p.qty,
    low_stock_at: p.low_stock_at,
    photo: p.photo,
    status: p.status,
    low: p.qty <= p.low_stock_at,
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

function customer(c) {
  return { ...c, tags: c.tags ? c.tags.split(',').filter(Boolean) : [] };
}

/* ---------------- audit ---------------- */

async function audit(user, action, entity, entityId, detail) {
  await db.run(
    'INSERT INTO audit_log (id, user_id, actor, action, entity, entity_id, detail, created_at) VALUES (?,?,?,?,?,?,?,?)',
    [uid(), user ? user.id : null, user ? user.role : 'system', action, entity || null, entityId || null, detail || null, now()]
  );
}

/* ---------------- invoice numbers ---------------- */

async function nextInvoice(t) {
  const row = await t.one("SELECT value FROM settings WHERE key = 'invoice_seq'");
  const seq = row ? Number(JSON.parse(row.value)) + 1 : 1;
  if (row) await t.run("UPDATE settings SET value = ? WHERE key = 'invoice_seq'", [JSON.stringify(seq)]);
  else await t.run("INSERT INTO settings (key, value) VALUES ('invoice_seq', ?)", [JSON.stringify(seq)]);
  return 'DC-' + String(seq).padStart(4, '0');
}

/* ---------------- validation helpers ---------------- */

const int = (v, field, { min = 0, max = 1e12, required = true } = {}) => {
  if (v === undefined || v === null || v === '') {
    if (required) throw new HttpError(400, `${field} is required`);
    return undefined;
  }
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `${field} is not a valid number`);
  return n;
};

const text = (v, field, { max = 500, required = true } = {}) => {
  if (v === undefined || v === null) {
    if (required) throw new HttpError(400, `${field} is required`);
    return undefined;
  }
  const s = String(v).trim();
  if (!s && required) throw new HttpError(400, `${field} is required`);
  if (s.length > max) throw new HttpError(400, `${field} is too long`);
  return s;
};

const normalisePhone = (p) => {
  const digits = String(p || '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+234')) return '0' + digits.slice(4);
  if (digits.startsWith('234')) return '0' + digits.slice(3);
  return digits;
};

/* ---------------- handlers ---------------- */

const routes = [];
const route = (method, pattern, handler, opts = {}) =>
  routes.push({ method, pattern, handler, auth: opts.auth !== false, owner: !!opts.owner });

/* --- session --- */

route('POST', /^\/api\/login$/, async (req, res, { body, ip }) => {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) throw new HttpError(400, 'Email and password are required');
  if (auth.tooManyAttempts(ip)) throw new HttpError(429, 'Too many attempts. Try again in 15 minutes.');

  const user = await db.one('SELECT * FROM users WHERE lower(email) = ?', [email]);
  if (!user || !user.active || !auth.verifyPassword(password, user.password_hash)) {
    auth.recordFailure(ip);
    throw new HttpError(401, 'That email and password do not match');
  }
  auth.clearFailures(ip);

  const { token, maxAge } = await auth.createSession(user.id);
  res.setHeader('Set-Cookie', auth.sessionCookie(token, maxAge));
  await audit(
    { id: user.id, role: user.role },
    'auth.login',
    'user',
    user.id,
    `${user.name} signed in`
  );
  return { user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } };
}, { auth: false });

route('POST', /^\/api\/logout$/, async (req, res, { user }) => {
  await auth.destroySession(user.token);
  res.setHeader('Set-Cookie', auth.sessionCookie('', 0));
  return { ok: true };
});

route('GET', /^\/api\/me$/, async (req, res, { user }) => ({
  user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
}));

route('POST', /^\/api\/password$/, async (req, res, { body, user }) => {
  const current = String(body.current || '');
  const next = String(body.next || '');
  if (next.length < 8) throw new HttpError(400, 'New password must be at least 8 characters');
  const row = await db.one('SELECT password_hash FROM users WHERE id = ?', [user.id]);
  if (!auth.verifyPassword(current, row.password_hash)) throw new HttpError(400, 'Current password is wrong');
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [auth.hashPassword(next), user.id]);
  await db.run('DELETE FROM sessions WHERE user_id = ?', [user.id]);
  await audit(user, 'user.password_changed', 'user', user.id, 'Password changed; all sessions ended');
  res.setHeader('Set-Cookie', auth.sessionCookie('', 0));
  return { ok: true };
});

/* --- products --- */

route('GET', /^\/api\/products$/, async (req, res, { user, query }) => {
  const q = (query.get('q') || '').trim();
  const category = (query.get('category') || '').trim();
  const where = [];
  const params = [];
  if (q) {
    where.push('(name LIKE ? OR category LIKE ? OR colour LIKE ? OR sku LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  const sql = `SELECT * FROM products ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
  const rows = await db.all(sql, params);
  return { products: rows.map((p) => product(p, user)) };
});

route('POST', /^\/api\/products$/, async (req, res, { body, user }) => {
  const nowIso = now();
  const values = {
    id: uid(),
    sku: text(body.sku, 'SKU', { required: false, max: 60 }) || null,
    name: text(body.name, 'Product name', { max: 160 }),
    category: text(body.category, 'Category', { max: 80 }),
    size: text(body.size, 'Size', { required: false, max: 40 }) || null,
    colour: text(body.colour, 'Colour', { required: false, max: 60 }) || null,
    grade: text(body.grade, 'Grade', { required: false, max: 40 }) || null,
    cost_price: isOwner(user) ? int(body.cost_price, 'Cost price', { required: false }) || 0 : 0,
    selling_price: int(body.selling_price, 'Selling price', { min: 1 }),
    qty: int(body.qty, 'Quantity', { required: false }) || 0,
    low_stock_at: int(body.low_stock_at, 'Low stock level', { required: false }) ?? 2,
    photo: text(body.photo, 'Photo', { required: false, max: 500 }) || null,
    created_at: nowIso,
    updated_at: nowIso,
  };
  if (!isOwner(user) && body.cost_price) throw new HttpError(403, 'Only the owner can set cost price');
  values.status = values.qty > 0 ? 'available' : 'sold out';

  await db.run(
    `INSERT INTO products (id, sku, name, category, size, colour, grade, cost_price, selling_price, qty, low_stock_at, photo, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      values.id, values.sku, values.name, values.category, values.size, values.colour, values.grade,
      values.cost_price, values.selling_price, values.qty, values.low_stock_at, values.photo,
      values.status, values.created_at, values.updated_at,
    ]
  );
  await audit(user, 'product.created', 'product', values.id, `${values.name} @ ₦${values.selling_price}`);
  return { product: product(await db.one('SELECT * FROM products WHERE id = ?', [values.id]), user) };
});

route('PATCH', /^\/api\/products\/([^/]+)$/, async (req, res, { body, user, params }) => {
  const existing = await db.one('SELECT * FROM products WHERE id = ?', [params[0]]);
  if (!existing) throw new HttpError(404, 'Product not found');

  const next = { ...existing };
  for (const key of ['sku', 'name', 'category', 'size', 'colour', 'grade', 'photo']) {
    if (body[key] !== undefined) next[key] = String(body[key]).slice(0, 200);
  }
  for (const key of ['selling_price', 'qty', 'low_stock_at']) {
    if (body[key] !== undefined) next[key] = int(body[key], key);
  }
  if (body.cost_price !== undefined) {
    if (!isOwner(user)) throw new HttpError(403, 'Only the owner can change cost price');
    next.cost_price = int(body.cost_price, 'Cost price');
  }
  next.status = next.qty > 0 ? 'available' : 'sold out';
  next.updated_at = now();

  await db.run(
    `UPDATE products SET sku=?, name=?, category=?, size=?, colour=?, grade=?, photo=?, cost_price=?, selling_price=?, qty=?, low_stock_at=?, status=?, updated_at=? WHERE id=?`,
    [
      next.sku, next.name, next.category, next.size, next.colour, next.grade, next.photo,
      next.cost_price, next.selling_price, next.qty, next.low_stock_at, next.status, next.updated_at, next.id,
    ]
  );
  await audit(user, 'product.updated', 'product', next.id, next.name);
  return { product: product(next, user) };
});

route('DELETE', /^\/api\/products\/([^/]+)$/, async (req, res, { user, params }) => {
  const existing = await db.one('SELECT * FROM products WHERE id = ?', [params[0]]);
  if (!existing) throw new HttpError(404, 'Product not found');
  const used = await db.one('SELECT COUNT(*) AS n FROM sale_items WHERE product_id = ?', [params[0]]);
  if (Number(used.n) > 0) throw new HttpError(409, 'This product appears on past sales, so it cannot be deleted. Set its quantity to 0 instead.');
  await db.run('DELETE FROM products WHERE id = ?', [params[0]]);
  await audit(user, 'product.deleted', 'product', params[0], existing.name);
  return { ok: true };
});

/* --- customers --- */

route('GET', /^\/api\/customers$/, async (req, res, { user, query }) => {
  const q = (query.get('q') || '').trim();
  const rows = q
    ? await db.all(
        'SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? OR location LIKE ? OR tags LIKE ? ORDER BY updated_at DESC',
        [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]
      )
    : await db.all('SELECT * FROM customers ORDER BY updated_at DESC');
  const stats = await db.all(
    `SELECT customer_id, COUNT(*) AS orders, SUM(total) AS spent, MAX(created_at) AS last
       FROM sales WHERE customer_id IS NOT NULL AND status IN ('paid','part-paid','delivered')
      GROUP BY customer_id`
  );
  const byId = Object.fromEntries(stats.map((s) => [s.customer_id, s]));
  return {
    customers: rows.map((c) => {
      const s = byId[c.id];
      return {
        ...customer(c),
        orders: s ? Number(s.orders) : 0,
        total_spent: s ? Number(s.spent) : 0,
        last_purchase: s ? s.last : null,
      };
    }),
  };
});

route('POST', /^\/api\/customers$/, async (req, res, { body, user }) => {
  const phone = normalisePhone(text(body.phone, 'Phone number', { max: 20 }));
  if (phone.length < 7) throw new HttpError(400, 'That phone number looks too short');
  const exists = await db.one('SELECT id FROM customers WHERE phone = ?', [phone]);
  if (exists) throw new HttpError(409, 'A customer with that number is already saved');
  const row = {
    id: uid(),
    name: text(body.name, 'Name', { max: 120 }),
    phone,
    alt_phone: normalisePhone(body.alt_phone || '') || null,
    location: text(body.location, 'Location', { required: false, max: 160 }) || null,
    tags: Array.isArray(body.tags) ? body.tags.join(',') : String(body.tags || '').slice(0, 120),
    notes: text(body.notes, 'Notes', { required: false, max: 1000 }) || null,
    opt_out: body.opt_out ? 1 : 0,
    created_at: now(),
    updated_at: now(),
  };
  await db.run(
    'INSERT INTO customers (id, name, phone, alt_phone, location, tags, notes, opt_out, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [row.id, row.name, row.phone, row.alt_phone, row.location, row.tags, row.notes, row.opt_out, row.created_at, row.updated_at]
  );
  await audit(user, 'customer.created', 'customer', row.id, row.name);
  return { customer: customer(row) };
});

route('PATCH', /^\/api\/customers\/([^/]+)$/, async (req, res, { body, user, params }) => {
  const existing = await db.one('SELECT * FROM customers WHERE id = ?', [params[0]]);
  if (!existing) throw new HttpError(404, 'Customer not found');
  const next = { ...existing };
  if (body.name !== undefined) next.name = text(body.name, 'Name', { max: 120 });
  if (body.phone !== undefined) next.phone = normalisePhone(body.phone);
  if (body.alt_phone !== undefined) next.alt_phone = normalisePhone(body.alt_phone) || null;
  if (body.location !== undefined) next.location = String(body.location).slice(0, 160);
  if (body.tags !== undefined) next.tags = Array.isArray(body.tags) ? body.tags.join(',') : String(body.tags).slice(0, 120);
  if (body.notes !== undefined) next.notes = String(body.notes).slice(0, 1000);
  if (body.opt_out !== undefined) next.opt_out = body.opt_out ? 1 : 0;
  next.updated_at = now();
  await db.run(
    'UPDATE customers SET name=?, phone=?, alt_phone=?, location=?, tags=?, notes=?, opt_out=?, updated_at=? WHERE id=?',
    [next.name, next.phone, next.alt_phone, next.location, next.tags, next.notes, next.opt_out, next.updated_at, next.id]
  );
  await audit(user, 'customer.updated', 'customer', next.id, next.name);
  return { customer: customer(next) };
}, { auth: false });

/* --- sales --- */

route('GET', /^\/api\/sales$/, async (req, res, { user, query }) => {
  const from = query.get('from');
  const to = query.get('to');
  const where = [];
  const params = [];
  if (from) { where.push('created_at >= ?'); params.push(from); }
  if (to) { where.push('created_at <= ?'); params.push(to + 'T23:59:59.999Z'); }
  const sql = `SELECT * FROM sales ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 500`;
  const rows = await db.all(sql, params);
  const items = await db.all('SELECT * FROM sale_items');
  const payments = await db.all('SELECT * FROM payments ORDER BY created_at ASC');
  const bySale = {};
  for (const it of items) (bySale[it.sale_id] ||= []).push(it);
  const paysBySale = {};
  for (const p of payments) (paysBySale[p.sale_id] ||= []).push(p);
  return {
    sales: rows.map((s) => ({
      ...s,
      profit: isOwner(user) ? (s.profit_known ? s.profit : null) : undefined,
      profit_known: !!s.profit_known,
      balance: s.total - s.paid,
      items: bySale[s.id] || [],
      payments: paysBySale[s.id] || [],
    })),
  };
});

route('POST', /^\/api\/sales$/, async (req, res, { body, user }) => {
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) throw new HttpError(400, 'Add at least one item to the sale');

  const result = await db.tx(async (t) => {
    const priced = [];
    let subtotal = 0;
    let cost = 0;

    for (const line of items) {
      const p = await t.one('SELECT * FROM products WHERE id = ?', [line.product_id]);
      if (!p) throw new HttpError(400, 'One of the products no longer exists');
      const qty = int(line.qty, 'Quantity', { min: 1 });
      if (p.qty < qty) throw new HttpError(409, `${p.name} only has ${p.qty} left`);
      const unit = p.selling_price;
      subtotal += unit * qty;
      cost += p.cost_price * qty;
      priced.push({ p, qty, unit });
    }

    let discount = int(body.discount, 'Discount', { required: false }) || 0;
    if (discount > subtotal) throw new HttpError(400, 'Discount cannot be more than the total');
    const total = subtotal - discount;

    const payments = Array.isArray(body.payments) ? body.payments : [];
    let paid = 0;
    for (const pay of payments) {
      const amount = int(pay.amount, 'Payment amount', { min: 1 });
      paid += amount;
    }
    if (paid > total) throw new HttpError(400, 'Payment is more than the total');
    if (!isOwner(user) && discount > 0) throw new HttpError(403, 'Only the owner can give a discount');

    const status = paid >= total && total > 0 ? 'paid' : paid > 0 ? 'part-paid' : 'awaiting payment';

    let customerId = body.customer_id || null;
    let customerName = text(body.customer_name, 'Customer name', { required: false, max: 120 }) || null;
    let customerPhone = normalisePhone(body.customer_phone || '') || null;

    if (customerId) {
      const c = await t.one('SELECT * FROM customers WHERE id = ?', [customerId]);
      if (!c) throw new HttpError(400, 'Customer not found');
      customerName = customerName || c.name;
      customerPhone = customerPhone || c.phone;
    } else if (customerPhone && customerName) {
      const found = await t.one('SELECT * FROM customers WHERE phone = ?', [customerPhone]);
      if (found) {
        customerId = found.id;
      } else {
        customerId = uid();
        await t.run(
          'INSERT INTO customers (id, name, phone, alt_phone, location, tags, notes, opt_out, created_at, updated_at) VALUES (?,?,?,?,?,?,?,0,?,?)',
          [customerId, customerName, customerPhone, null, null, 'retail', 'Added automatically when the sale was recorded', now(), now()]
        );
      }
    }

    const invoice = await nextInvoice(t);
    const saleId = uid();
    const stamp = now();

    // Profit is only meaningful when every line has a real cost price. Until
    // the owner enters costs, the sale is stored with profit_known = 0 so the
    // dashboard can say "cost missing" instead of showing a fake margin.
    const costKnown = priced.every(({ p }) => p.cost_price > 0);
    const profit = costKnown ? total - cost : 0;

    await t.run(
      `INSERT INTO sales (id, invoice_no, customer_id, customer_name, customer_phone, subtotal, discount, total, paid, profit, profit_known, status, channel, note, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        saleId, invoice, customerId, customerName, customerPhone,
        subtotal, discount, total, paid,
        isOwner(user) ? profit : 0,
        costKnown ? 1 : 0,
        status, String(body.channel || 'counter').slice(0, 30),
        text(body.note, 'Note', { required: false, max: 500 }) || null,
        user.id, stamp, stamp,
      ]
    );

    for (const { p, qty, unit } of priced) {
      await t.run(
        'INSERT INTO sale_items (id, sale_id, product_id, name, size, unit_price, unit_cost, qty) VALUES (?,?,?,?,?,?,?,?)',
        [uid(), saleId, p.id, p.name, p.size, unit, p.cost_price, qty]
      );
      const left = p.qty - qty;
      await t.run('UPDATE products SET qty = ?, status = ?, updated_at = ? WHERE id = ?', [
        left, left > 0 ? 'available' : 'sold out', stamp, p.id,
      ]);
    }

    for (const pay of payments) {
      await t.run(
        'INSERT INTO payments (id, sale_id, amount, method, reference, taken_by, created_at) VALUES (?,?,?,?,?,?,?)',
        [uid(), saleId, int(pay.amount, 'Payment amount'), String(pay.method || 'cash').slice(0, 30), String(pay.reference || '').slice(0, 80) || null, user.id, stamp]
      );
    }

    await t.run(
      'INSERT INTO audit_log (id, user_id, actor, action, entity, entity_id, detail, created_at) VALUES (?,?,?,?,?,?,?,?)',
      [uid(), user.id, user.role, 'sale.created', 'sale', saleId, `${invoice} · ₦${total} · ${status}`, stamp]
    );

    return {
      sale: {
        id: saleId, invoice_no: invoice, customer_id: customerId, customer_name: customerName,
        customer_phone: customerPhone, subtotal, discount, total, paid,
        balance: total - paid, status, created_at: stamp,
        profit: isOwner(user) ? (costKnown ? profit : null) : undefined,
        profit_known: costKnown,
        items: priced.map(({ p, qty, unit }) => ({ name: p.name, size: p.size, unit_price: unit, qty })),
      },
    };
  });

  return result;
});

route('POST', /^\/api\/sales\/([^/]+)\/payments$/, async (req, res, { body, user, params }) => {
  const sale = await db.one('SELECT * FROM sales WHERE id = ?', [params[0]]);
  if (!sale) throw new HttpError(404, 'Sale not found');
  const amount = int(body.amount, 'Amount', { min: 1 });
  const balance = sale.total - sale.paid;
  if (amount > balance) throw new HttpError(400, `That is more than the balance of ₦${balance.toLocaleString('en-NG')}`);

  const stamp = now();
  await db.tx(async (t) => {
    await t.run(
      'INSERT INTO payments (id, sale_id, amount, method, reference, taken_by, created_at) VALUES (?,?,?,?,?,?,?)',
      [uid(), sale.id, amount, String(body.method || 'transfer').slice(0, 30), String(body.reference || '').slice(0, 80) || null, user.id, stamp]
    );
    const paid = sale.paid + amount;
    const status = paid >= sale.total ? 'paid' : 'part-paid';
    await t.run('UPDATE sales SET paid = ?, status = ?, updated_at = ? WHERE id = ?', [paid, status, stamp, sale.id]);
    await t.run(
      'INSERT INTO audit_log (id, user_id, actor, action, entity, entity_id, detail, created_at) VALUES (?,?,?,?,?,?,?,?)',
      [uid(), user.id, user.role, 'payment.recorded', 'sale', sale.id, `₦${amount.toLocaleString('en-NG')} on ${sale.invoice_no}`, stamp]
    );
  });
  return { sale: await db.one('SELECT * FROM sales WHERE id = ?', [sale.id]) };
});

route('DELETE', /^\/api\/sales\/([^/]+)$/, async (req, res, { user, params }) => {
  const sale = await db.one('SELECT * FROM sales WHERE id = ?', [params[0]]);
  if (!sale) throw new HttpError(404, 'Sale not found');
  await db.tx(async (t) => {
    await t.run('DELETE FROM payments WHERE sale_id = ?', [sale.id]);
    await t.run('DELETE FROM sale_items WHERE sale_id = ?', [sale.id]);
    await t.run('DELETE FROM sales WHERE id = ?', [sale.id]);
    await t.run(
      'INSERT INTO audit_log (id, user_id, actor, action, entity, entity_id, detail, created_at) VALUES (?,?,?,?,?,?,?,?)',
      [uid(), user.id, user.role, 'sale.deleted', 'sale', sale.id, `${sale.invoice_no} · ₦${sale.total.toLocaleString('en-NG')}`, now()]
    );
  });
  return { ok: true };
}, { owner: true });

route('DELETE', /^\/api\/customers\/([^/]+)$/, async (req, res, { user, params }) => {
  const c = await db.one('SELECT * FROM customers WHERE id = ?', [params[0]]);
  if (!c) throw new HttpError(404, 'Customer not found');
  await db.run('UPDATE sales SET customer_id = NULL WHERE customer_id = ?', [c.id]);
  await db.run('UPDATE conversations SET customer_id = NULL WHERE customer_id = ?', [c.id]);
  await db.run('DELETE FROM customers WHERE id = ?', [c.id]);
  await audit(user, 'customer.deleted', 'customer', c.id, `${c.name} · ${c.phone}`);
  return { ok: true };
}, { owner: true });

route('GET', /^\/api\/staff$/, async () => {
  const rows = await db.all('SELECT id, name, email, phone, role, active FROM users ORDER BY created_at ASC');
  return { staff: rows };
});

route('GET', /^\/api\/public\/stats$/, async () => {
  const p = await db.one("SELECT COUNT(*) AS n FROM products WHERE qty > 0");
  const c = await db.one('SELECT COUNT(*) AS n FROM customers');
  return { products: Number(p.n), customers: Number(c.n) };
}, { auth: false });

/* --- dashboard --- */

route('GET', /^\/api\/dashboard$/, async (req, res, { user }) => {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const from = monthStart.toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const agg = await db.one(
    `SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue, COALESCE(SUM(paid),0) AS collected,
            COALESCE(SUM(CASE WHEN profit_known = 1 THEN profit ELSE 0 END),0) AS profit,
            COALESCE(SUM(CASE WHEN profit_known = 0 THEN 1 ELSE 0 END),0) AS profit_unknown
       FROM sales WHERE created_at >= ? AND status IN ('paid','part-paid','delivered')`,
    [from]
  );
  const sold = await db.one(
    `SELECT COALESCE(SUM(si.qty),0) AS items FROM sale_items si JOIN sales s ON s.id = si.sale_id
      WHERE s.created_at >= ? AND s.status IN ('paid','part-paid','delivered')`,
    [from]
  );
  const stock = await db.one('SELECT COALESCE(SUM(qty),0) AS units, COALESCE(SUM(qty*cost_price),0) AS cost_value, COALESCE(SUM(qty*selling_price),0) AS retail_value FROM products');
  const noCost = await db.one('SELECT COUNT(*) AS n FROM products WHERE cost_price = 0 AND qty > 0');
  const low = await db.one('SELECT COUNT(*) AS n FROM products WHERE qty <= low_stock_at');
  const pending = await db.one("SELECT COUNT(*) AS n FROM sales WHERE status IN ('awaiting payment','draft','reserved')");
  const customers = await db.one('SELECT COUNT(*) AS n FROM customers');
  const newCustomers = await db.one('SELECT COUNT(*) AS n FROM customers WHERE created_at >= ?', [from]);
  const convos = await db.one("SELECT COUNT(*) AS n FROM conversations WHERE channel = 'whatsapp' AND updated_at >= ?", [today]);
  const attention = await db.one("SELECT COUNT(*) AS n FROM conversations WHERE status = 'waiting'");

  const top = await db.all(
    `SELECT si.name, SUM(si.qty) AS units, SUM(si.qty*si.unit_price) AS revenue
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
      WHERE s.status IN ('paid','part-paid','delivered')
      GROUP BY si.name ORDER BY units DESC LIMIT 5`
  );

  return {
    revenue: Number(agg.revenue),
    collected: Number(agg.collected),
    profit: isOwner(user) ? Number(agg.profit) : undefined,
    profit_unknown_sales: isOwner(user) ? Number(agg.profit_unknown) : undefined,
    products_without_cost: isOwner(user) ? Number(noCost.n) : undefined,
    retail_stock_value: Number(stock.retail_value),
    orders: Number(agg.orders),
    items_sold: Number(sold.items),
    stock_units: Number(stock.units),
    stock_value: isOwner(user) ? Number(stock.cost_value) : Number(stock.retail_value),
    low_stock: Number(low.n),
    pending_orders: Number(pending.n),
    customers: Number(customers.n),
    new_customers: Number(newCustomers.n),
    ai_conversations_today: Number(convos.n),
    needs_attention: Number(attention.n),
    top_sellers: top.map((t) => ({ name: t.name, units: Number(t.units), revenue: Number(t.revenue) })),
  };
});

/* --- conversations --- */

route('GET', /^\/api\/conversations$/, async (req, res) => {
  const rows = await db.all(
    `SELECT c.*, cu.name AS customer_name, cu.phone AS customer_phone
       FROM conversations c LEFT JOIN customers cu ON cu.id = c.customer_id
      ORDER BY c.updated_at DESC`
  );
  const msgs = await db.all('SELECT * FROM messages ORDER BY created_at ASC LIMIT 4000');
  const byConv = {};
  for (const m of msgs) (byConv[m.conversation_id] ||= []).push({ from: m.author, text: m.body, at: m.created_at });
  return { conversations: rows.map((c) => ({ ...c, messages: byConv[c.id] || [] })) };
});

route('GET', /^\/api\/conversations\/([^/]+)\/messages$/, async (req, res, { params }) => {
  const rows = await db.all('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC', [params[0]]);
  return { messages: rows };
});

route('POST', /^\/api\/conversations\/([^/]+)\/messages$/, async (req, res, { body, user, params }) => {
  const conv = await db.one('SELECT * FROM conversations WHERE id = ?', [params[0]]);
  if (!conv) throw new HttpError(404, 'Conversation not found');
  const message = text(body.body, 'Message', { max: 4000 });
  const stamp = now();
  const id = uid();
  await db.run('INSERT INTO messages (id, conversation_id, author, body, created_at) VALUES (?,?,?,?,?)', [
    id, conv.id, 'staff', message, stamp,
  ]);
  await db.run("UPDATE conversations SET status = 'staff', last_message = ?, updated_at = ? WHERE id = ?", [
    message.slice(0, 160), stamp, conv.id,
  ]);
  await audit(user, 'conversation.replied', 'conversation', conv.id, 'Staff took over and replied');
  return { message: { id, conversation_id: conv.id, author: 'staff', body: message, created_at: stamp } };
});

/* --- AI assistant --- */

route('GET', /^\/api\/ai\/status$/, async () => ({ ai: await ai.status() }));

// Test console: the owner types as a customer would. Every message is stored
// in a real conversation and every fact the model uses comes from the database.
route('POST', /^\/api\/ai\/chat$/, async (req, res, { body, user }) => {
  const phone = normalisePhone(body.phone || '08000000000');
  const name = text(body.name, 'Name', { required: false, max: 120 }) || 'Test customer';
  const message = text(body.message, 'Message', { max: 1500 });

  let customer = await db.one('SELECT * FROM customers WHERE phone = ?', [phone]);
  if (!customer) {
    const id = uid();
    await db.run(
      'INSERT INTO customers (id, name, phone, alt_phone, location, tags, notes, opt_out, created_at, updated_at) VALUES (?,?,?,?,?,?,?,0,?,?)',
      [id, name, phone, null, null, 'retail', 'Created from the AI test console', now(), now()]
    );
    customer = await db.one('SELECT * FROM customers WHERE id = ?', [id]);
  }

  const conversation = await ai.ensureConversation({ customerId: customer.id, channel: 'whatsapp' });

  await db.run(
    'INSERT INTO messages (id, conversation_id, author, body, created_at) VALUES (?,?,?,?,?)',
    [uid(), conversation.id, 'customer', message, now()]
  );

  const result = await ai.respond({ conversationId: conversation.id, customerId: customer.id, message });

  const replyText = result.reply || 'A staff member will reply to you shortly.';
  await db.run(
    'INSERT INTO messages (id, conversation_id, author, body, created_at) VALUES (?,?,?,?,?)',
    [uid(), conversation.id, 'ai', replyText, now()]
  );
  await db.run(
    'UPDATE conversations SET last_message = ?, status = ?, updated_at = ? WHERE id = ?',
    [replyText.slice(0, 200), result.escalated ? 'waiting' : 'ai', now(), conversation.id]
  );
  await audit(user, 'ai.test_chat', 'conversation', conversation.id, `${result.provider || 'no-provider'} · tools: ${result.toolCalls.join(', ') || 'none'}`);

  return {
    conversation_id: conversation.id,
    reply: replyText,
    provider: result.provider,
    tool_calls: result.toolCalls,
    escalated: result.escalated,
  };
}, { owner: true });

route('GET', /^\/api\/ai\/drafts$/, async () => {
  const rows = await db.all(
    "SELECT id, invoice_no, customer_name, customer_phone, total, status, note, created_at FROM sales WHERE status = 'reserved' ORDER BY created_at DESC"
  );
  return { drafts: rows };
});

/* --- settings --- */

const PUBLIC_SETTING_KEYS = ['business', 'policies', 'categories'];

route('GET', /^\/api\/settings$/, async (req, res, { user }) => {
  const rows = await db.all('SELECT key, value FROM settings');
  const out = {};
  for (const r of rows) {
    if (!isOwner(user) && !PUBLIC_SETTING_KEYS.includes(r.key)) continue;
    out[r.key] = JSON.parse(r.value);
  }
  return { settings: out };
});

route('PATCH', /^\/api\/settings$/, async (req, res, { body, user }) => {
  const allowed = ['business', 'policies', 'categories', 'ai', 'payments', 'store'];
  const saved = {};
  for (const [key, value] of Object.entries(body || {})) {
    if (!allowed.includes(key)) continue;
    await db.run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, JSON.stringify(value)]
    );
    saved[key] = value;
  }
  await audit(user, 'settings.updated', 'settings', null, Object.keys(saved).join(', '));
  return { settings: saved };
}, { owner: true });

/* --- audit log --- */

route('GET', /^\/api\/audit$/, async (req, res) => {
  const rows = await db.all(
    `SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC LIMIT 200`
  );
  return { entries: rows };
}, { owner: true });

/* --- health --- */

route('GET', /^\/api\/health$/, async () => ({ ok: true, db: db.mode, time: now() }), { auth: false });

/* ---------------- dispatcher ---------------- */

async function handle(req, res, url) {
  const pathname = url.pathname;
  if (!pathname.startsWith('/api/')) return false;

  const method = req.method.toUpperCase();
  const match = routes.find((r) => r.method === method && r.pattern.test(pathname));
  if (!match) {
    send(res, 404, { error: 'Not found' });
    return true;
  }

  try {
    const user = match.auth ? await auth.currentUser(req) : null;
    if (match.auth && !user) throw new HttpError(401, 'Please sign in');
    if (match.owner && !isOwner(user)) throw new HttpError(403, 'Only the owner can do this');

    let body = {};
    if (method === 'POST' || method === 'PATCH' || method === 'PUT') body = await readJson(req);

    const params = pathname.match(match.pattern).slice(1).map(decodeURIComponent);
    const result = await match.handler(req, res, {
      body,
      user,
      params,
      query: url.searchParams,
      ip: clientIp(req),
    });
    if (!res.writableEnded) send(res, 200, result ?? { ok: true });
  } catch (err) {
    if (err instanceof HttpError) send(res, err.status, { error: err.message });
    else {
      console.error('[api]', pathname, err);
      send(res, 500, { error: 'Something went wrong on the server' });
    }
  }
  return true;
}

function send(res, status, payload) {
  const json = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    'Cache-Control': 'no-store',
  });
  res.end(json);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        reject(new HttpError(413, 'Request too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        const parsed = JSON.parse(raw);
        resolve(parsed && typeof parsed === 'object' ? parsed : {});
      } catch {
        reject(new HttpError(400, 'Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

module.exports = { handle, HttpError };
