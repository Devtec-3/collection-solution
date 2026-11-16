/* ============================================================
   Core: state, formatting, calculations, icons, UI primitives
   ============================================================ */
'use strict';

const App = {
  state: {
    route: 'dashboard',
    params: {},
    role: 'admin',
    user: null,
    theme: 'light',
    range: 30,
    navOpen: false,
    inbox: { selected: null, filter: 'all', query: '' },
    inv: { q: '', category: 'all', sort: 'name', dir: 1, status: 'all' },
    sales: { q: '', period: '30', status: 'all', sort: 'date', dir: -1 },
    cust: { q: '', tag: 'all', sort: 'name', dir: 1 },
    reports: { type: 'sales' },
    ai: { tab: 'overview', consoleMessages: [], callStep: 0 },
    consoleDraft: ''
  },
  actions: {}
};

/* ---------- formatting ---------- */
const NGN = (n) => '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG');
const num = (n) => (Number(n) || 0).toLocaleString('en-NG');

function money(n){
  const v = Number(n) || 0;
  const sign = v < 0 ? '−' : '';
  return sign + '₦' + Math.abs(Math.round(v)).toLocaleString('en-NG');
}
function compact(n){
  const v = Math.abs(Number(n) || 0);
  if (v >= 1e9) return '₦' + (v/1e9).toFixed(1).replace(/\.0$/,'') + 'b';
  if (v >= 1e6) return '₦' + (v/1e6).toFixed(1).replace(/\.0$/,'') + 'm';
  if (v >= 1e4) return '₦' + Math.round(v/1e3) + 'k';
  return money(v);
}
function shortMoney(n){
  const v = Math.abs(Number(n) || 0);
  if (v >= 1e6) return '₦' + (v/1e6).toFixed(1).replace(/\.0$/,'') + 'm';
  if (v >= 1e3) return '₦' + Math.round(v/1e3) + 'k';
  return '₦' + Math.round(v);
}
function pct(n, digits){ return (Number(n)||0).toFixed(digits === undefined ? 0 : digits) + '%'; }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(s, opts){
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d)) return '—';
  const o = opts || {};
  const day = d.getDate();
  const mon = MONTHS[d.getMonth()];
  const yr = d.getFullYear();
  if (o.short) return day + ' ' + mon;
  if (o.monthOnly) return mon + ' ' + yr;
  return day + ' ' + mon + ' ' + yr;
}
function fmtTime(s){
  const d = new Date(s);
  if (isNaN(d)) return '';
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}
function timeAgo(s){
  if (!s) return '';
  const then = new Date(s).getTime();
  if (isNaN(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.round(mins/60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.round(hrs/24);
  if (days === 1) return 'yesterday';
  if (days < 7) return days + 'd ago';
  return fmtDate(s, {short:true});
}
function dayKey(s){ return new Date(s).toISOString().slice(0,10); }
function daysBetween(a,b){ return Math.round((new Date(b) - new Date(a)) / 864e5); }
function esc(s){
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function initials(name){
  return String(name||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
}
function uid(prefix){ return (prefix||'id') + '-' + Math.random().toString(36).slice(2,7); }
/* Invoice numbers must never repeat, even after a deletion.
   A high-water counter is used, not the current row count. */
function nextNumber(kind, list, prefix, fallback){
  SEED.counters = SEED.counters || {};
  const maxExisting = list.reduce((m, x) => {
    const n = parseInt(String(x.id).replace(/\D/g,''), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  const current = Math.max(SEED.counters[kind] || 0, maxExisting, fallback);
  SEED.counters[kind] = current + 1;
  return prefix + SEED.counters[kind];
}
function nextInvoiceNo(){ return nextNumber('invoice', SEED.sales, 'INV-', 1042); }
function nextDraftNo(){ return nextNumber('draft', SEED.drafts, 'DRF-', 200); }
function clamp(n,a,b){ return Math.min(b, Math.max(a,n)); }
function sum(arr, fn){ return arr.reduce((s,x)=> s + (fn ? fn(x) : x), 0); }

/* ---------- spreadsheet-accurate calculations ----------
   Mirrors the original Excel columns. Every UI uses these
   functions so a table, a receipt and a report cannot disagree. */
const Calc = {
  lineTotal(item){ return (Number(item.qty)||0) * (Number(item.unitPrice)||0); },
  subtotal(sale){ return sum(sale.items || [], it => Calc.lineTotal(it)); },
  discount(sale){ return Math.min(Number(sale.discount)||0, Calc.subtotal(sale)); },
  total(sale){ return Calc.subtotal(sale) - Calc.discount(sale); },
  cogs(sale){
    return sum(sale.items || [], it => {
      const p = productById(it.productId);
      const unitCost = it.cost !== undefined ? it.cost : (p ? p.cost : 0);
      return (Number(it.qty)||0) * unitCost;
    });
  },
  /* Profit is only a fact when every line has a real cost price. Until the
     owner enters costs, this returns null and the UI says "unknown" rather
     than showing takings as if they were profit. */
  profit(sale){
    if (sale && sale.profitKnown === false) return null;
    return Calc.total(sale) - Calc.cogs(sale);
  },
  margin(sale){
    const t = Calc.total(sale);
    const p = Calc.profit(sale);
    return p === null || !t ? 0 : (p / t) * 100;
  },
  balance(sale){ return Math.max(0, Calc.total(sale) - (Number(sale.paid)||0)); },
  status(sale){
    const b = Calc.balance(sale);
    if (b <= 0) return 'paid';
    if ((Number(sale.paid)||0) > 0) return 'part';
    return 'unpaid';
  },
  customer(c){
    const sales = SEED.sales.filter(s => s.customerId === c.id);
    const spent = sum(sales, s => Number(s.paid)||0);
    const owed = sum(sales, s => Calc.balance(s));
    const last = sales.map(s=>s.date).sort().pop();
    return {
      orders: sales.length,
      spent,
      owed,
      lastPurchase: last || null,
      avg: sales.length ? spent / sales.length : 0
    };
  },
  stockValue(){ return sum(SEED.products, p => p.qty * p.cost); },
  retailValue(){ return sum(SEED.products, p => p.qty * p.price); },
  lowStock(){
    return SEED.products.filter(p => p.qty > 0 && p.qty <= (p.lowStock || 3));
  },
  soldOut(){ return SEED.products.filter(p => p.qty <= 0); },
  onHold(productId){
    return sum((SEED.drafts || []).filter(d => d.status === 'awaiting_approval' || d.status === 'approved'),
      d => sum(d.items.filter(i => i.productId === productId), i => i.qty));
  },
  availableNow(p){
    if (p.id) return Math.max(0, p.qty - Calc.onHold(p.id));
    return p.qty;
  },
  isLow(p){ return p.qty > 0 && p.qty <= (p.lowStock || 3); },
  productStatus(p){
    if (p.qty <= 0) return 'sold out';
    if (Calc.isLow(p)) return 'low stock';
    return 'available';
  }
};

/* ---------- metrics ---------- */
function salesIn(days){
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  return SEED.sales.filter(s => new Date(s.date) >= cutoff);
}
function metrics(days){
  const cur = salesIn(days);
  const prevCut = new Date(); prevCut.setDate(prevCut.getDate() - days*2);
  const prevStart = new Date(); prevStart.setDate(prevStart.getDate() - days);
  const prev = SEED.sales.filter(s => {
    const d = new Date(s.date);
    return d >= prevCut && d < prevStart;
  });
  const revenue = sum(cur, s => Calc.total(s));
  const prevRevenue = sum(prev, s => Calc.total(s));
  const profit = sum(cur, s => Calc.profit(s) || 0);
  const prevProfit = sum(prev, s => Calc.profit(s) || 0);
  const profitUnknown = cur.filter(s => Calc.profit(s) === null).length;
  const items = sum(cur, s => sum(s.items, i => i.qty));
  const owed = sum(SEED.sales, s => Calc.balance(s));
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  const newCustomers = SEED.customers.filter(c => new Date(c.createdAt) >= cutoff).length;
  const prevNew = SEED.customers.filter(c => {
    const d = new Date(c.createdAt);
    return d >= prevCut && d < prevStart;
  }).length;
  const todayKey = new Date().toISOString().slice(0,10);
  const aiToday = SEED.conversations.filter(c => (c.messages||[]).some(m => m.from === 'ai' && dayKey(m.at) === todayKey)).length;
  const waiting = SEED.conversations.filter(c => c.needsAttention || c.status === 'waiting').length;
  const drafts = SEED.drafts.filter(d => d.status === 'awaiting_approval').length;

  const byProduct = {};
  cur.forEach(s => s.items.forEach(it => {
    const k = it.productId;
    if (!byProduct[k]) byProduct[k] = { productId:k, name:it.name, qty:0, revenue:0 };
    byProduct[k].qty += it.qty;
    byProduct[k].revenue += it.qty * it.unitPrice;
  }));
  const topSellers = Object.values(byProduct).sort((a,b)=> b.revenue - a.revenue).slice(0,5);

  const byCategory = {};
  cur.forEach(s => s.items.forEach(it => {
    const p = productById(it.productId);
    const cat = p ? p.category : 'Other';
    if (!byCategory[cat]) byCategory[cat] = { category:cat, revenue:0, qty:0 };
    byCategory[cat].revenue += it.qty * it.unitPrice;
    byCategory[cat].qty += it.qty;
  }));

  return {
    range: days,
    revenue, prevRevenue,
    profit, prevProfit, profitUnknown,
    items,
    stockValue: Calc.stockValue(),
    lowStock: Calc.lowStock().length,
    soldOut: Calc.soldOut().length,
    newCustomers, prevNew,
    owed,
    aiToday, waiting, drafts,
    topSellers,
    byCategory: Object.values(byCategory).sort((a,b)=>b.revenue-a.revenue),
    salesCount: cur.length,
    avgSale: cur.length ? revenue / cur.length : 0,
    growth: prevRevenue ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0,
    profitGrowth: prevProfit ? ((profit - prevProfit) / prevProfit) * 100 : 0,
    aiSales: cur.filter(s=>s.aiAssisted).length,
    manualSales: cur.filter(s=>!s.aiAssisted).length
  };
}

function revenueSeries(days){
  const out = [];
  const byDay = {};
  SEED.sales.forEach(s => {
    const k = dayKey(s.date);
    if (!byDay[k]) byDay[k] = { revenue:0, profit:0, orders:0 };
    byDay[k].revenue += Calc.total(s);
    byDay[k].profit += Calc.profit(s) || 0;
    byDay[k].orders += 1;
  });
  for (let i = days-1; i >= 0; i--){
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = iso(d);
    out.push({ key:k, label: fmtDate(k,{short:true}), ...(byDay[k] || {revenue:0,profit:0,orders:0}) });
  }
  return out;
}
function customerGrowthSeries(days){
  const out = [];
  for (let i = days-1; i >= 0; i -= Math.ceil(days/8)){
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = iso(d);
    const count = SEED.customers.filter(c => c.createdAt <= k).length;
    out.push({ key:k, label: fmtDate(k,{short:true}), value: count });
  }
  return out;
}

/* ---------- UI primitives ---------- */
const Icons = {
  dashboard:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  box:'<path d="M21 8.5v7a2 2 0 0 1-1 1.74l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 15.5v-7a2 2 0 0 1 1-1.74l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8.5Z"/><path d="m3.3 7.4 8.7 5 8.7-5"/><path d="M12 21.5v-9"/>',
  receipt:'<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2Z"/><path d="M9 8h6M9 12h6"/>',
  users:'<path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7.5" r="3.5"/><path d="M21 20v-1.5a4 4 0 0 0-3-3.87"/><path d="M15.5 4.2a3.5 3.5 0 0 1 0 6.6"/>',
  inbox:'<path d="M3 12h4.5l1.5 3h6l1.5-3H21"/><path d="M5.5 4.5h13l2.5 7.5v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6l2.5-7.5Z"/>',
  sparkles:'<path d="m12 3 1.9 4.9L19 9.8l-5.1 1.9L12 17l-1.9-5.3L5 9.8l5.1-1.9L12 3Z"/><path d="M18.5 15.5 19.4 18l2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9.9-2.5Z"/>',
  chart:'<path d="M3 3v18h18"/><path d="M7 15v3M12 9v9M17 5v13"/>',
  reports:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  activity:'<path d="M22 12h-4l-3 8-4-16-3 8H2"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.1a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  bell:'<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:'<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.7 6.7 0 0 0 9.8 9.8Z"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2-2.4 3.8"/><path d="M12 17h.01"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  chevronDown:'<path d="m6 9 6 6 6-6"/>',
  chevronRight:'<path d="m9 6 6 6-6 6"/>',
  chevronLeft:'<path d="m15 6-6 6 6 6"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  edit:'<path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"/>',
  trash:'<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  filter:'<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>',
  sort:'<path d="m8 4 0 16M4 8l4-4 4 4"/><path d="M16 20V4M12 16l4 4 4-4"/>',
  arrowUp:'<path d="M12 19V5M5 12l7-7 7 7"/>',
  arrowDown:'<path d="M12 5v14M19 12l-7 7-7-7"/>',
  arrowRight:'<path d="M5 12h14M12 5l7 7-7 7"/>',
  check:'<path d="m20 6-11 11-5-5"/>',
  checkCircle:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  alert:'<path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
  message:'<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-4.2-.9L3 21l1.9-4.7A8.3 8.3 0 0 1 3.9 12a8.4 8.4 0 0 1 8.4-8.4h.5A8.4 8.4 0 0 1 21 11.2v.3Z"/>',
  send:'<path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/>',
  play:'<path d="m6 3 15 9-15 9V3Z"/>',
  pause:'<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
  refresh:'<path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/>',
  printer:'<path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/>',
  file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/>',
  lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  tag:'<path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
  truck:'<path d="M14 17V5H2v12h12Z"/><path d="M14 9h4l4 4v4h-8"/><circle cx="6.5" cy="18.5" r="1.8"/><circle cx="17.5" cy="18.5" r="1.8"/>',
  bot:'<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M8 14h.01M16 14h.01"/><path d="M9 17.5h6"/>',
  wallet:'<path d="M20 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h16v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6"/><path d="M16 13h2"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>',
  back:'<path d="M19 12H5M12 19l-7-7 7-7"/>',
  archive:'<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/>'
};
function icon(name, cls){
  const body = Icons[name] || Icons.info;
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (cls ? ' class="'+cls+'"' : '') + '>' + body + '</svg>';
}

function toast(msg, type){
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' toast--err' : '');
  el.innerHTML = icon(type === 'error' ? 'alert' : (type === 'info' ? 'info' : 'checkCircle')) + '<span>' + esc(msg) + '</span>';
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .2s'; }, 2600);
  setTimeout(() => el.remove(), 2900);
}

let _modalOnClose = null;
function openModal(opts){
  const root = document.getElementById('modal-root');
  const wide = opts.size === 'wide' ? ' modal--wide' : (opts.size === 'narrow' ? ' modal--narrow' : '');
  const prev = document.activeElement;
  if (prev && typeof prev.blur === 'function') prev.blur();
  root.innerHTML =
    '<div class="modal-scrim" data-close-modal>' +
      '<div class="modal' + wide + '" role="dialog" aria-modal="true" aria-label="' + esc(opts.title) + '">' +
        '<div class="modal__head">' +
          '<div><h2>' + esc(opts.title) + '</h2>' + (opts.sub ? '<p>' + esc(opts.sub) + '</p>' : '') + '</div>' +
          '<button class="icon-btn modal__close" data-close-modal aria-label="Close">' + icon('x') + '</button>' +
        '</div>' +
        '<div class="modal__body">' + opts.body + '</div>' +
        (opts.footer !== false ? '<div class="modal__foot">' + (opts.footerLeft || '') + (opts.footer || '<button class="btn btn--secondary" data-close-modal>Cancel</button>') + '</div>' : '') +
      '</div>' +
    '</div>';
  _modalOnClose = opts.onClose || null;
  document.body.style.overflow = 'hidden';
  if (opts.onMount) opts.onMount(root);
  setTimeout(() => {
    const first = root.querySelector('input:not([type=hidden]), textarea, select');
    if (first) first.focus();
  }, 40);
}
/* Replacing innerHTML while a field inside it has focus can throw in
   Chrome (focus/blur fighting the removal). Blur first, then replace. */
function safeSetHTML(el, html){
  if (!el) return;
  const active = document.activeElement;
  if (active && el.contains(active) && typeof active.blur === 'function') active.blur();
  el.innerHTML = html;
}

function closeModal(){
  const root = document.getElementById('modal-root');
  if (!root.innerHTML) return;
  safeSetHTML(root, '');
  document.body.style.overflow = '';
  if (_modalOnClose){ const fn = _modalOnClose; _modalOnClose = null; fn(); }
}
function confirmDialog(opts){
  openModal({
    title: opts.title,
    sub: opts.sub || '',
    size: 'narrow',
    body: '<p class="small" style="color:var(--ink-2);line-height:1.6">' + (opts.body || 'This cannot be undone.') + '</p>',
    footer: '<button class="btn btn--secondary" data-close-modal>Cancel</button>' +
      '<button class="btn ' + (opts.danger ? 'btn--danger' : 'btn--primary') + '" id="confirm-ok">' + esc(opts.ok || 'Confirm') + '</button>',
    onMount(root){
      root.querySelector('#confirm-ok').addEventListener('click', () => {
        closeModal();
        if (opts.onOk) opts.onOk();
      });
    }
  });
}

/* ---------- activity + notifications ---------- */
function logActivity(action, detail, type){
  SEED.activity.unshift({
    id: uid('a'),
    at: new Date().toISOString(),
    actor: SEED.staff.find(u => u.id === App.state.user) ? staffById(App.state.user).name : 'AI Assistant',
    type: type || 'system',
    action, detail: detail || ''
  });
  if (SEED.activity.length > 80) SEED.activity.length = 80;
}
function notifications(){
  const out = [];
  Calc.lowStock().forEach(p => out.push({
    kind:'warn', icon:'box',
    title: 'Low stock — ' + p.name,
    text: p.qty + ' left (threshold ' + (p.lowStock||3) + ') · ' + p.colour + ' / ' + p.size,
    at: new Date().toISOString(),
    go: ['inventory', {}]
  }));
  Calc.soldOut().forEach(p => out.push({
    kind:'alert', icon:'alert',
    title: 'Sold out — ' + p.name,
    text: 'Restock or hide from the AI catalogue.',
    at: new Date().toISOString(),
    go: ['inventory', {}]
  }));
  SEED.conversations.filter(c => c.needsAttention || c.status === 'waiting').forEach(c => {
    const cu = customerById(c.customerId);
    out.push({
      kind:'alert', icon:'message',
      title: 'Needs your reply — ' + (cu ? cu.name : 'Unknown'),
      text: c.attentionReason || 'Customer is waiting for a human',
      at: c.lastAt,
      go: ['inbox', { id: c.id }]
    });
  });
  SEED.drafts.filter(d => d.status === 'awaiting_approval').forEach(d => {
    const cu = customerById(d.customerId);
    out.push({
      kind:'info', icon:'clock',
      title: 'AI order awaiting approval — ' + d.id,
      text: (cu ? cu.name : 'Customer') + ' · hold expires ' + fmtDate(d.expiresAt,{short:true}),
      at: d.createdAt,
      go: ['ai', { tab:'orders' }]
    });
  });
  return out;
}

/* ---------- CSV ---------- */
function toCSV(headers, rows){
  const escCell = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  };
  return [headers.map(escCell).join(',')].concat(rows.map(r => r.map(escCell).join(','))).join('\r\n');
}
function downloadFile(name, content, mime){
  const blob = new Blob([content], { type: mime || 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
  toast('Downloaded ' + name);
}
function parseCSV(text){
  const rows = [];
  let row = [], cell = '', inQ = false;
  const src = String(text).replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  for (let i=0;i<src.length;i++){
    const ch = src[i];
    if (inQ){
      if (ch === '"' && src[i+1] === '"'){ cell += '"'; i++; }
      else if (ch === '"'){ inQ = false; }
      else cell += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ','){ row.push(cell); cell = ''; }
      else if (ch === '\n'){ row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
  }
  if (cell.length || row.length){ row.push(cell); rows.push(row); }
  const clean = rows.filter(r => r.some(c => String(c).trim() !== ''));
  if (!clean.length) return { headers:[], rows:[] };
  const headers = clean[0].map(h => h.trim());
  return { headers, rows: clean.slice(1) };
}
