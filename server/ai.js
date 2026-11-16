'use strict';
/**
 * AI sales assistant — real model, real stock.
 *
 * The model never sees cost prices, profit or other customers. It can only
 * learn what it asks for through the tools below, and every tool answers from
 * the database. If no API key is configured the assistant refuses politely and
 * hands the chat to a human instead of inventing an answer.
 *
 * Providers: Google Gemini (free tier, recommended) or Anthropic Claude.
 * Set GEMINI_API_KEY or ANTHROPIC_API_KEY. Nothing else changes.
 */
const crypto = require('node:crypto');
const db = require('./db');

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

function provider() {
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return null;
}

async function settings() {
  const rows = await db.all("SELECT key, value FROM settings WHERE key IN ('business','policies','ai','payments','categories')");
  const out = {};
  for (const r of rows) out[r.key] = JSON.parse(r.value);
  return out;
}

const naira = (n) => '₦' + Number(n || 0).toLocaleString('en-NG');

/* ---------------- system prompt ---------------- */

function systemPrompt(s) {
  const b = s.business || {};
  const ai = s.ai || {};
  const pay = s.payments || {};
  const policies = (s.policies || []).map((p) => '- ' + p).join('\n');

  return [
    `You are the virtual assistant for ${b.name || 'the store'} (${b.tagline || ''}), a fashion and household-goods dealer.`,
    'You are talking to customers on WhatsApp. Always make clear you are the store virtual assistant, not a person.',
    '',
    'HARD RULES — never break these:',
    '- Only state products, prices, sizes, colours and stock that a tool returned in this conversation. Never guess or invent.',
    '- Never reveal cost price, profit, margins, other customers, or sales totals.',
    '- Never confirm that a payment has been received. Only staff can confirm payments. You may give the transfer account details.',
    '- Never give a discount. Maximum discount allowed: ' + (ai.maxDiscountPct || 0) + '%.',
    '- If you do not have the answer, say so plainly and hand over to a human with the escalate_to_human tool.',
    '- Complaints, refunds, bulk or custom orders, anything unclear, or any request for a human: escalate immediately.',
    '',
    `Tone: ${ai.tone || 'Polite, short and friendly.'}`,
    'Reply in English, or simple Nigerian Pidgin if the customer writes in Pidgin. Keep replies under 80 words. No voice notes, no calls — text only.',
    '',
    'Business details:',
    `- Address: ${b.address || 'not set'}`,
    `- Phone: ${(b.phones || []).join(' / ') || 'not set'}`,
    `- Hours: ${b.hours || 'not set'}`,
    `- Delivery: ${b.delivery || 'not set'}`,
    `- Pick-up: ${b.pickup || 'not set'}`,
    pay.accountNumber
      ? `- Payment: bank transfer only. Bank ${pay.bank}, account name ${pay.accountName}, account number ${pay.accountNumber}. After paying, the customer sends proof and staff confirm it.`
      : '- Payment: bank transfer only. Account details are not set — ask the customer to wait for a staff member.',
    '',
    'Store policies:',
    policies || '- none recorded',
    '',
    'Use the tools for every factual question. Pass the customer name and phone to create_draft_order only when they have clearly agreed to buy.',
  ].join('\n');
}

/* ---------------- tools ---------------- */

const TOOLS = [
  {
    name: 'find_products',
    description:
      'Search live stock by word, category, maximum price or size. Returns only what is in the catalogue with current quantity. Use this before answering any availability or price question.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words from the product name, e.g. "bubu gown", "Dior bag"' },
        category: { type: 'string', description: 'Exact category name, e.g. "Bags"' },
        max_price: { type: 'number', description: 'Highest price the customer will pay, in naira' },
        size: { type: 'string', description: 'Size the customer asked for, e.g. "40"' },
      },
    },
  },
  {
    name: 'suggest_alternatives',
    description: 'Given a product that is sold out, return other in-stock items in the same category.',
    parameters: { type: 'object', properties: { product_id: { type: 'string' } }, required: ['product_id'] },
  },
  {
    name: 'business_details',
    description: 'Return opening hours, address, phone numbers, delivery and pick-up rules from the owner settings.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'create_draft_order',
    description:
      'Create a reservation / draft order for a customer. Does not take payment and does not reduce stock. Staff approve it later.',
    parameters: {
      type: 'object',
      properties: {
        customer_name: { type: 'string' },
        phone: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: { product_id: { type: 'string' }, qty: { type: 'number' } },
            required: ['product_id', 'qty'],
          },
        },
        note: { type: 'string' },
      },
      required: ['customer_name', 'phone', 'items'],
    },
  },
  {
    name: 'escalate_to_human',
    description: 'Hand this conversation to a staff member and stop replying. Use for complaints, refunds, bulk orders, payment confirmation, or anything you cannot answer.',
    parameters: {
      type: 'object',
      properties: { reason: { type: 'string' }, summary: { type: 'string' } },
      required: ['reason'],
    },
  },
];

const publicProduct = (p) => ({
  product_id: p.id,
  name: p.name,
  category: p.category,
  size: p.size || null,
  colour: p.colour || null,
  grade: p.grade || null,
  price: naira(p.selling_price),
  in_stock: p.qty > 0,
  quantity_left: p.qty,
});

async function runTool(name, args, ctx) {
  if (name === 'find_products') {
    const where = [];
    const params = [];
    if (args.query) {
      where.push('(LOWER(name) LIKE ? OR LOWER(category) LIKE ? OR LOWER(colour) LIKE ?)');
      const q = '%' + String(args.query).toLowerCase() + '%';
      params.push(q, q, q);
    }
    if (args.category) {
      where.push('LOWER(category) = ?');
      params.push(String(args.category).toLowerCase());
    }
    if (args.max_price) {
      where.push('selling_price <= ?');
      params.push(Math.round(Number(args.max_price)));
    }
    if (args.size) {
      where.push('LOWER(size) = ?');
      params.push(String(args.size).toLowerCase());
    }
    const rows = await db.all(
      `SELECT * FROM products ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY (qty > 0) DESC, selling_price ASC LIMIT 8`,
      params
    );
    if (!rows.length) return { found: 0, note: 'Nothing in the catalogue matches that. Do not invent an item.' };
    return { found: rows.length, products: rows.map(publicProduct) };
  }

  if (name === 'suggest_alternatives') {
    const base = await db.one('SELECT * FROM products WHERE id = ?', [args.product_id]);
    if (!base) return { products: [], note: 'Unknown product id.' };
    const rows = await db.all(
      'SELECT * FROM products WHERE category = ? AND id <> ? AND qty > 0 ORDER BY selling_price ASC LIMIT 5',
      [base.category, base.id]
    );
    return {
      sold_out_item: base.name,
      suggestions: rows.map(publicProduct),
      note: rows.length ? 'Offer these as similar options.' : 'Nothing similar currently in stock.',
    };
  }

  if (name === 'business_details') {
    const s = await settings();
    const b = s.business || {};
    return {
      name: b.name,
      address: b.address,
      phones: b.phones,
      hours: b.hours,
      delivery: b.delivery,
      pickup: b.pickup,
      payment: s.payments && s.payments.accountNumber ? {
        bank: s.payments.bank,
        account_name: s.payments.accountName,
        account_number: s.payments.accountNumber,
        rule: 'Give these details so the customer can transfer. Never say the payment has been received.',
      } : 'not set',
    };
  }

  if (name === 'create_draft_order') {
    const phoneRows = await db.all('SELECT * FROM customers WHERE phone = ?', [String(args.phone || '').replace(/\D/g, '')]);
    let customer = phoneRows[0] || null;
    const stamp = now();
    if (!customer) {
      customer = { id: uid(), name: args.customer_name, phone: String(args.phone).replace(/\D/g, '') };
      await db.run(
        'INSERT INTO customers (id, name, phone, alt_phone, location, tags, notes, opt_out, created_at, updated_at) VALUES (?,?,?,?,?,?,?,0,?,?)',
        [customer.id, customer.name, customer.phone, null, null, 'retail', 'Created by the AI assistant', stamp, stamp]
      );
    }

    const lines = [];
    let total = 0;
    for (const item of args.items || []) {
      const p = await db.one('SELECT * FROM products WHERE id = ?', [item.product_id]);
      if (!p) continue;
      const qty = Math.max(1, Math.min(Number(item.qty) || 1, p.qty));
      if (!qty) continue;
      lines.push({ p, qty });
      total += p.selling_price * qty;
    }
    if (!lines.length) return { created: false, note: 'None of those items are in stock. Ask the customer what else they would like.' };

    const seqRow = await db.one("SELECT value FROM settings WHERE key = 'invoice_seq'");
    const seq = seqRow ? Number(JSON.parse(seqRow.value)) + 1 : 1;
    if (seqRow) await db.run("UPDATE settings SET value = ? WHERE key = 'invoice_seq'", [JSON.stringify(seq)]);
    else await db.run("INSERT INTO settings (key, value) VALUES ('invoice_seq', ?)", [JSON.stringify(seq)]);
    const invoice = 'DC-' + String(seq).padStart(4, '0');
    const saleId = uid();

    await db.tx(async (t) => {
      await t.run(
        `INSERT INTO sales (id, invoice_no, customer_id, customer_name, customer_phone, subtotal, discount, total, paid, profit, profit_known, status, channel, note, created_by, created_at, updated_at)
         VALUES (?,?,?,?,?,?,0,?,0,0,0,'reserved','whatsapp',?,NULL,?,?)`,
        [saleId, invoice, customer.id, customer.name, customer.phone, total, total, String(args.note || 'Draft created by the AI assistant').slice(0, 400), stamp, stamp]
      );
      for (const { p, qty } of lines) {
        await t.run(
          'INSERT INTO sale_items (id, sale_id, product_id, name, size, unit_price, unit_cost, qty) VALUES (?,?,?,?,?,?,?,?)',
          [uid(), saleId, p.id, p.name, p.size, p.selling_price, 0, qty]
        );
      }
      await t.run(
        'INSERT INTO audit_log (id, user_id, actor, action, entity, entity_id, detail, created_at) VALUES (?,?,?,?,?,?,?,?)',
        [uid(), null, 'ai', 'sale.draft', 'sale', saleId, `${invoice} · ${naira(total)} · awaiting staff approval`, stamp]
      );
    });

    return {
      created: true,
      invoice_no: invoice,
      total: naira(total),
      items: lines.map(({ p, qty }) => ({ name: p.name, qty, price: naira(p.selling_price) })),
      customer: { name: customer.name, phone: customer.phone },
      next: 'Tell the customer the item is reserved and a staff member will confirm payment and delivery. Do not ask for or confirm payment yourself.',
    };
  }

  if (name === 'escalate_to_human') {
    if (ctx.conversationId) {
      await db.run("UPDATE conversations SET status = 'waiting', updated_at = ? WHERE id = ?", [now(), ctx.conversationId]);
    }
    await db.run(
      'INSERT INTO audit_log (id, user_id, actor, action, entity, entity_id, detail, created_at) VALUES (?,?,?,?,?,?,?,?)',
      [uid(), null, 'ai', 'ai.escalated', 'conversation', ctx.conversationId || null, `${args.reason}: ${args.summary || ''}`.slice(0, 500), now()]
    );
    return { escalated: true, note: 'A staff member will take over. Apologise briefly and say a human will reply shortly.' };
  }

  return { error: 'Unknown tool' };
}

/* ---------------- model calls ---------------- */

const toGeminiTools = () => [{
  functionDeclarations: TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
}];

async function callGemini({ system, contents, temperature = 0.3 }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      tools: toGeminiTools(),
      generationConfig: { temperature, maxOutputTokens: 700 },
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  const calls = parts.filter((p) => p.functionCall).map((p) => ({ name: p.functionCall.name, args: p.functionCall.args || {} }));
  const text = parts.filter((p) => p.text).map((p) => p.text).join('').trim();
  return { text, calls, rawParts: parts };
}

async function callAnthropic({ system, messages }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 700,
      temperature: 0.3,
      system,
      tools: TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
      messages,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Claude ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  const blocks = data.content || [];
  return {
    text: blocks.filter((b) => b.type === 'text').map((b) => b.text).join('').trim(),
    calls: blocks.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, args: b.input || {} })),
    raw: blocks,
  };
}

/**
 * One customer turn. Returns { reply, toolCalls, escalated, provider }.
 * History is stored in `messages`, so the model sees the real conversation.
 */
async function respond({ conversationId, customerId, message, channel = 'whatsapp' }) {
  const p = provider();
  if (!p) {
    return {
      reply:
        'Thank you for your message. Our virtual assistant is not connected yet, so a staff member will reply to you shortly.',
      escalated: true,
      toolCalls: [],
      provider: null,
    };
  }

  // If the provider failed in the last five minutes (no credit, bad key, outage)
  // do not hammer it for every customer: hand over politely and log nothing new.
  const recentFailure = await db
    .one("SELECT created_at FROM audit_log WHERE action = 'ai.provider_error' ORDER BY created_at DESC LIMIT 1")
    .catch(() => null);
  if (recentFailure && Date.now() - new Date(recentFailure.created_at).getTime() < 5 * 60 * 1000) {
    return {
      reply:
        'Thank you for your message. Our virtual assistant is unavailable right now, so a staff member will reply to you shortly. Sorry for the wait.',
      toolCalls: [],
      escalated: true,
      provider: p,
      error: 'provider paused after a recent failure',
    };
  }

  const s = await settings();
  const system = systemPrompt(s);

  const history = await db.all(
    'SELECT author, body FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 40',
    [conversationId]
  );
  const turns = history.filter((m) => m.author !== 'system');

  const usedTools = [];
  let escalated = false;

  try {
  if (p === 'gemini') {
    const contents = turns.map((m) => ({
      role: m.author === 'customer' ? 'user' : 'model',
      parts: [{ text: m.body }],
    }));
    contents.push({ role: 'user', parts: [{ text: message }] });

    let reply = '';
    for (let step = 0; step < 6; step += 1) {
      const out = await callGemini({ system, contents });
      if (out.text) reply = out.text;
      if (!out.calls.length) break;

      contents.push({ role: 'model', parts: out.rawParts });
      const responses = [];
      for (const call of out.calls) {
        usedTools.push(call.name);
        const result = await runTool(call.name, call.args, { conversationId, customerId });
        if (result.escalated) escalated = true;
        responses.push({ functionResponse: { name: call.name, response: { result } } });
      }
      contents.push({ role: 'user', parts: responses });
    }
    return { reply, toolCalls: usedTools, escalated, provider: p };
  }

  // Anthropic
  const messages = turns.map((m) => ({
    role: m.author === 'customer' ? 'user' : 'assistant',
    content: [{ type: 'text', text: m.body }],
  }));
  messages.push({ role: 'user', content: [{ type: 'text', text: message }] });

  let reply = '';
  for (let step = 0; step < 6; step += 1) {
    const out = await callAnthropic({ system, messages });
    if (out.text) reply = out.text;
    if (!out.calls.length) break;
    messages.push({ role: 'assistant', content: out.raw });
    const results = [];
    for (const call of out.calls) {
      usedTools.push(call.name);
      const result = await runTool(call.name, call.args, { conversationId, customerId });
      if (result.escalated) escalated = true;
      results.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(result) });
    }
    messages.push({ role: 'user', content: results });
  }
  return { reply, toolCalls: usedTools, escalated, provider: p };
  } catch (err) {
    // A key with no credit, a network blip or a model change must never look
    // like the store ignoring a customer. Hand over to a human and say so.
    console.error('[ai] provider failed:', err.message);
    await db
      .run(
        'INSERT INTO audit_log (id, user_id, actor, action, entity, entity_id, detail, created_at) VALUES (?,?,?,?,?,?,?,?)',
        [uid(), null, 'system', 'ai.provider_error', 'conversation', conversationId || null, String(err.message).slice(0, 300), now()]
      )
      .catch(() => {});
    return {
      reply:
        'Thank you for your message. Our virtual assistant is unavailable right now, so a staff member will reply to you shortly. Sorry for the wait.',
      toolCalls: usedTools,
      escalated: true,
      provider: p,
      error: err.message,
    };
  }
}

/** Find or create a conversation for a customer, so every message is linked. */
async function ensureConversation({ customerId, channel = 'whatsapp', subject }) {
  const existing = await db.one(
    "SELECT * FROM conversations WHERE customer_id = ? AND status <> 'closed' ORDER BY updated_at DESC LIMIT 1",
    [customerId]
  );
  if (existing) return existing;
  const id = uid();
  const stamp = now();
  await db.run(
    'INSERT INTO conversations (id, customer_id, channel, status, subject, last_message, unread, created_at, updated_at) VALUES (?,?,?,?,?,?,0,?,?)',
    [id, customerId, channel, 'ai', subject || 'New enquiry', null, stamp, stamp]
  );
  return db.one('SELECT * FROM conversations WHERE id = ?', [id]);
}

async function status() {
  const p = provider();
  const lastError = await db
    .one("SELECT detail, created_at FROM audit_log WHERE action = 'ai.provider_error' ORDER BY created_at DESC LIMIT 1")
    .catch(() => null);
  return {
    provider: p,
    model: p === 'gemini' ? GEMINI_MODEL : p === 'anthropic' ? ANTHROPIC_MODEL : null,
    ready: !!p && !lastErrorWithin(lastError),
    note: !p
      ? 'No API key set — the assistant hands every chat to a human.'
      : lastErrorWithin(lastError)
        ? 'The provider rejected the last call: ' + lastError.detail
        : 'Live model with stock tools.',
    provider_error: lastErrorWithin(lastError) ? lastError.detail : null,
  };
}

/** An error seen in the last 15 minutes still counts as "not ready". */
function lastErrorWithin(row) {
  if (!row) return null;
  const age = Date.now() - new Date(row.created_at).getTime();
  return age < 15 * 60 * 1000 ? row.detail : null;
}

module.exports = { respond, ensureConversation, runTool, status, provider, TOOLS, systemPrompt };
