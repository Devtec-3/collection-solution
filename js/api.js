/* ============================================================
   API layer — the screens read SEED, but SEED is now filled and
   refreshed from the live database instead of being made up in
   the browser. Every write below goes through the server, which
   validates it and records who did it.
   ============================================================ */
'use strict';

const API = (() => {
  async function req(method, path, body) {
    const res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      const err = new Error((data && data.error) || 'Something went wrong (' + res.status + ')');
      err.status = res.status;
      throw err;
    }
    return data || {};
  }

  /* ---------- mapping: database rows -> the shapes the UI uses ---------- */

  const dateOnly = (s) => (s ? String(s).slice(0, 10) : '');

  function mapProduct(p) {
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      size: p.size || '',
      colour: p.colour || '—',
      grade: p.grade || 'Standard',
      cost: Number(p.cost_price) || 0,
      price: Number(p.selling_price) || 0,
      qty: Number(p.qty) || 0,
      lowStock: Number(p.low_stock_at) || 0,
      photo: p.photo || '',
      status: p.status,
      notes: '',
    };
  }

  function mapCustomer(c) {
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      location: c.location || 'Not provided',
      tags: (Array.isArray(c.tags) ? c.tags : String(c.tags || '').split(','))
        .filter(Boolean)
        .map((t) => String(t).charAt(0).toUpperCase() + String(t).slice(1)),
      notes: c.notes || '',
      createdAt: dateOnly(c.created_at),
      optOut: !!c.opt_out,
    };
  }

  function mapSale(s) {
    const pays = s.payments || [];
    return {
      id: s.invoice_no,
      dbId: s.id,
      date: dateOnly(s.created_at),
      customerId: s.customer_id || null,
      items: (s.items || []).map((it) => ({
        productId: it.product_id,
        name: it.name,
        qty: Number(it.qty) || 0,
        unitPrice: Number(it.unit_price) || 0,
        cost: Number(it.unit_cost) || 0,
      })),
      discount: Number(s.discount) || 0,
      paid: Number(s.paid) || 0,
      method: pays.length ? String(pays[pays.length - 1].method || 'transfer') : '—',
      staffId: s.created_by || '',
      aiAssisted: s.channel === 'whatsapp' && !s.created_by,
      note: s.note || '',
      status: s.status,
      profitKnown: !!s.profit_known,
      reserved: s.status === 'reserved',
    };
  }

  function mapConversation(c) {
    return {
      id: c.id,
      customerId: c.customer_id || null,
      channel: c.channel === 'call' ? 'Call' : 'WhatsApp',
      status: c.status,
      unread: Number(c.unread) || 0,
      lastAt: c.updated_at,
      startedAt: c.created_at,
      summary: c.last_message || c.subject || 'No messages yet',
      needsAttention: c.status === 'waiting',
      attentionReason: c.status === 'waiting' ? 'Waiting for a human reply' : '',
      messages: (c.messages || []).map((m) => ({ from: m.from, text: m.text, at: m.at })),
    };
  }

  function mapActivity(a) {
    return {
      id: a.id,
      at: a.created_at,
      actor: a.user_name || (a.actor === 'ai' ? 'AI Assistant' : a.actor === 'system' ? 'System' : (a.actor || 'System')),
      type: a.entity || 'system',
      action: a.action,
      detail: a.detail || '',
    };
  }

  function mapStaff(u) {
    return {
      id: u.id,
      name: u.name,
      role: u.role === 'owner' ? 'admin' : 'staff',
      email: u.email,
      phone: u.phone || '',
      initials: initials(u.name),
      colour: u.role === 'owner' ? '#2F4F3E' : '#6B4E31',
      since: dateOnly(u.created_at).slice(0, 4),
      active: !!u.active,
    };
  }

  function applySettings(s) {
    const b = s.business || {};
    const ai = s.ai || {};
    const pay = s.payments || {};
    SEED.business = Object.assign({}, SEED.business, {
      name: b.name || SEED.business.name,
      tagline: b.tagline || '',
      pickup: b.pickup || '',
      phone: (b.phones || []).join(' · ') || '',
      whatsapp: b.whatsapp || (b.phones || [])[0] || '',
      address: b.address || '',
      currency: '₦',
      hours: b.hours || '',
      delivery: b.delivery || '',
      returns: (s.policies || []).slice(0, 3).join(' '),
      payment: pay.accountNumber
        ? 'Transfer only · ' + pay.bank + ' ' + pay.accountNumber + ' (' + pay.accountName + '). Staff confirm payments, never the assistant.'
        : 'No payment details set.',
      tone: ai.tone || '',
      policies: s.policies || [],
    });
    if (Array.isArray(s.categories) && s.categories.length) SEED.categories = s.categories;
    SEED.settings = {
      ai: {
        enabled: ai.enabled !== false,
        scheduleMode: (ai.schedule && ai.schedule.mode) || 'always',
        startTime: (ai.schedule && ai.schedule.after) || '18:00',
        endTime: '08:00',
        weekends: !!(ai.schedule && ai.schedule.weekends),
        maxDiscountPct: Number(ai.maxDiscountPct) || 0,
        requireApprovalAbove: 0,
        escalateUnknown: true,
        voiceEnabled: false,
        languages: ['English', 'Nigerian Pidgin'],
        tone: ai.tone || '',
        greeting: ai.greeting || '',
        escalateTopics: ai.escalateTopics || [],
      },
      alerts: Object.assign({ lowStock: true, notifyOwner: true, channel: 'WhatsApp' }, (s.store || {}).alerts || {}),
      backup: Object.assign({ frequency: 'Daily (Neon)', time: '22:00', lastRun: null, keep: 30 }, (s.store || {}).backup || {}),
      privacy: Object.assign({
        optOut: true,
        retentionMonths: 24,
        consent: 'Customers are told they are chatting with a virtual assistant and can ask for a human at any time.',
      }, (s.store || {}).privacy || {}),
    };
    SEED.payments = pay;
    SEED.store = s.store || {};
  }

  /* ---------- read everything ---------- */

  async function loadAll() {
    const [prod, cust, sales, convs, set, audit, staff, drafts] = await Promise.all([
      req('GET', '/api/products'),
      req('GET', '/api/customers'),
      req('GET', '/api/sales'),
      req('GET', '/api/conversations'),
      req('GET', '/api/settings'),
      req('GET', '/api/audit').catch(() => ({ entries: [] })),
      req('GET', '/api/staff'),
      req('GET', '/api/ai/drafts').catch(() => ({ drafts: [] })),
    ]);

    SEED.products = (prod.products || []).map(mapProduct);
    SEED.customers = (cust.customers || []).map(mapCustomer);
    SEED.sales = (sales.sales || []).map(mapSale);
    SEED.conversations = (convs.conversations || []).map(mapConversation);
    SEED.staff = (staff.staff || []).map(mapStaff);
    SEED.activity = (audit.entries || []).map(mapActivity);
    SEED.drafts = (drafts.drafts || []).map((d) => ({
      id: d.invoice_no,
      dbId: d.id,
      customerId: null,
      createdAt: d.created_at,
      expiresAt: d.created_at,
      items: [],
      status: 'awaiting_approval',
      createdBy: 'AI',
      channel: 'WhatsApp',
      delivery: '',
      note: d.note || '',
      customerName: d.customer_name,
      customerPhone: d.customer_phone,
      total: Number(d.total) || 0,
    }));
    applySettings(set.settings || {});
  }

  /* ---------- writes ---------- */

  const productPayload = (d) => ({
    name: d.name,
    category: d.category,
    size: d.size,
    colour: d.colour,
    grade: d.grade,
    cost_price: d.cost,
    selling_price: d.price,
    qty: d.qty,
    low_stock_at: d.lowStock,
    photo: d.photo || null,
  });

  return {
    req,
    loadAll,
    me: () => req('GET', '/api/me'),
    publicStats: () => req('GET', '/api/public/stats'),
    login: (email, password) => req('POST', '/api/login', { email, password }),
    logout: () => req('POST', '/api/logout'),

    createProduct: (d) => req('POST', '/api/products', productPayload(d)),
    updateProduct: (id, d) => req('PATCH', '/api/products/' + id, productPayload(d)),
    deleteProduct: (id) => req('DELETE', '/api/products/' + id),
    restock: (id, qty, cost) => req('PATCH', '/api/products/' + id, cost > 0 ? { qty, cost_price: cost } : { qty }),

    createSale: (payload) => req('POST', '/api/sales', payload),
    addPayment: (dbId, amount, method) => req('POST', '/api/sales/' + dbId + '/payments', { amount, method }),
    deleteSale: (dbId) => req('DELETE', '/api/sales/' + dbId),

    createCustomer: (d) => req('POST', '/api/customers', d),
    updateCustomer: (id, d) => req('PATCH', '/api/customers/' + id, d),
    deleteCustomer: (id) => req('DELETE', '/api/customers/' + id),

    saveSettings: (patch) => req('PATCH', '/api/settings', patch),
    sendMessage: (convId, body) => req('POST', '/api/conversations/' + convId + '/messages', { body }),
    aiChat: (message) => req('POST', '/api/ai/chat', { message }),
    aiStatus: () => req('GET', '/api/ai/status'),
  };
})();
