/* ============================================================
   App shell — routing, roles, navigation, global search
   ============================================================ */
'use strict';

const ROUTES = {
  dashboard: { title:'Dashboard', sub:'Sales, stock and what needs your attention', view: viewDashboard, roles:['admin','staff'] },
  inventory: { title:'Inventory', sub:'Products, stock levels and the AI catalogue', view: viewInventory, roles:['admin','staff'] },
  sales:     { title:'Sales & payments', sub:'Receipts, balances and daily takings', view: viewSales, roles:['admin','staff'] },
  customers: { title:'Customer book', sub:'Contacts and purchase history that survive a lost phone', view: viewCustomers, roles:['admin','staff'] },
  inbox:     { title:'Unified inbox', sub:'WhatsApp and calls handled by AI or staff', view: viewInbox, roles:['admin','staff'] },
  ai:        { title:'AI assistant', sub:'Controls, guardrails, orders and the test console', view: viewAI, roles:['admin','staff'] },
  reports:   { title:'Reports', sub:'Printable summaries and exports', view: viewReports, roles:['admin','staff'] },
  activity:  { title:'Activity log', sub:'Who changed what, including the assistant', view: viewActivity, roles:['admin'] },
  settings:  { title:'Settings', sub:'Business, staff, alerts and privacy', view: viewSettings, roles:['admin'] }
};

const NAV = [
  { label:'Day to day', items:[
    { route:'dashboard', icon:'dashboard', label:'Dashboard' },
    { route:'inventory', icon:'box', label:'Inventory' },
    { route:'sales', icon:'receipt', label:'Sales & payments' },
    { route:'customers', icon:'users', label:'Customer book' }
  ]},
  { label:'Assistant', items:[
    { route:'inbox', icon:'inbox', label:'Inbox', badge:'inbox' },
    { route:'ai', icon:'sparkles', label:'AI assistant', badge:'ai' }
  ]},
  { label:'Business', items:[
    { route:'reports', icon:'reports', label:'Reports' },
    { route:'activity', icon:'activity', label:'Activity log', adminOnly:true },
    { route:'settings', icon:'settings', label:'Settings', adminOnly:true }
  ]}
];

function navBadge(kind){
  if (kind === 'inbox'){
    const n = SEED.conversations.filter(c => c.needsAttention || c.status === 'waiting').length;
    return n ? { n, alert:true } : null;
  }
  if (kind === 'ai'){
    const n = SEED.drafts.filter(d => d.status === 'awaiting_approval').length;
    return n ? { n, alert:false } : null;
  }
  return null;
}

function renderNav(){
  const nav = document.getElementById('nav');
  const isAdmin = App.state.role === 'admin';
  nav.innerHTML = NAV.map(group => {
    const items = group.items.filter(i => !i.adminOnly || isAdmin);
    if (!items.length) return '';
    return '<div class="nav__group"><div class="nav__label">' + esc(group.label) + '</div>' +
      items.map(i => {
        const b = i.badge ? navBadge(i.badge) : null;
        return '<button class="nav__item" data-action="go" data-route="' + i.route + '"' +
          (App.state.route === i.route ? ' aria-current="page"' : '') + '>' +
          icon(i.icon) + '<span>' + esc(i.label) + '</span>' +
          (b ? '<span class="nav__count ' + (b.alert ? 'nav__count--alert' : '') + '">' + b.n + '</span>' : '') +
        '</button>';
      }).join('') + '</div>';
  }).join('');
}

function renderChrome(){
  const r = ROUTES[App.state.route] || ROUTES.dashboard;
  document.getElementById('page-title').textContent = r.title;
  document.getElementById('page-sub').textContent = r.sub;
  const role = App.state.role;
  document.getElementById('role-chip').textContent = role === 'admin' ? 'Owner' : 'Staff';
  const u = staffById(App.state.user || 'u1');
  document.getElementById('sidebar-user').innerHTML = UI.avatar(u.name, u.colour, 'sm') +
    '<div><strong>' + esc(role === 'admin' ? u.name : u.name) + '</strong><span>' + (role === 'admin' ? 'Owner · full access' : 'Staff · no profit view') + '</span></div>';
  const n = notifications().length;
  const badge = document.getElementById('notify-count');
  badge.textContent = n;
  badge.hidden = n === 0;
  document.getElementById('theme-toggle').innerHTML = icon(App.state.theme === 'dark' ? 'sun' : 'moon');
  document.getElementById('quick-btn-icon').innerHTML = icon('plus');
  document.getElementById('notify-icon').innerHTML = icon('bell');
  document.getElementById('help-btn').innerHTML = icon('help');
  document.getElementById('logout-btn').innerHTML = icon('logout');
  document.getElementById('sidebar-open').innerHTML = icon('menu');
  document.getElementById('sidebar-close').innerHTML = icon('x');
  document.getElementById('global-search-icon').innerHTML = icon('search');
}

let _focusKey = null;
function renderKeepFocus(key){
  _focusKey = key;
  render();
}

function render(){
  if (!App.state.user) return;
  const route = ROUTES[App.state.route] ? App.state.route : 'dashboard';
  App.state.route = route;
  if (ROUTES[route].roles.indexOf(App.state.role) === -1){
    App.state.route = 'dashboard';
  }
  renderNav();
  renderChrome();
  const view = document.getElementById('view');
  safeSetHTML(view, ROUTES[App.state.route].view());
  document.title = ROUTES[App.state.route].title + ' — ' + SEED.business.name;
  if (App.state.route === 'inbox') setTimeout(scrollChat, 30);
  if (_focusKey){
    const el = document.querySelector('[data-input="' + _focusKey + '"]');
    if (el){
      el.focus();
      const v = el.value;
      if (el.setSelectionRange) el.setSelectionRange(v.length, v.length);
    }
    _focusKey = null;
  }
}

function go(route, params){
  App.state.route = route;
  App.state.params = params || {};
  App.state.navOpen = false;
  document.getElementById('app').classList.remove('nav-open');
  if (params && params.id && route === 'inbox'){
    App.state.inbox.selected = params.id;
    const c = SEED.conversations.find(x => x.id === params.id);
    if (c) c.unread = 0;
  }
  if (params && params.tab && route === 'ai') App.state.ai.tab = params.tab;
  render();
  window.scrollTo({ top:0, behavior:'instant' in window ? 'instant' : 'auto' });
  closePopovers();
}

App.actions['go'] = (el) => go(el.getAttribute('data-route'), { id: el.getAttribute('data-id') || undefined });

/* ---------- theme ---------- */
function applyTheme(t){
  App.state.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('adeola-theme', t); } catch(e){}
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.innerHTML = icon(t === 'dark' ? 'sun' : 'moon');
}
function toggleTheme(){ applyTheme(App.state.theme === 'dark' ? 'light' : 'dark'); }

/* ---------- popovers ---------- */
function closePopovers(){
  ['quick-menu','notify-menu','search-pop'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });
  const qb = document.getElementById('quick-btn');
  if (qb) qb.setAttribute('aria-expanded', 'false');
}

function renderQuickMenu(){
  const el = document.getElementById('quick-menu');
  el.innerHTML =
    '<div class="menu-pop__label">Quick actions</div>' +
    '<button class="menu-item" data-action="sale.new">' + icon('receipt') + 'Record a sale<span class="kbd">S</span></button>' +
    '<button class="menu-item" data-action="inv.new">' + icon('box') + 'Add a product</button>' +
    '<button class="menu-item" data-action="cust.new">' + icon('users') + 'Add a customer</button>' +
    '<button class="menu-item" data-action="go" data-route="inbox">' + icon('inbox') + 'Open inbox<span class="kbd">I</span></button>' +
    '<div class="menu-sep"></div>' +
    '<button class="menu-item" data-action="go" data-route="ai">' + icon('bot') + 'Test the AI assistant</button>' +
    '<button class="menu-item" data-action="go" data-route="reports">' + icon('printer') + 'Print a report</button>' +
    (App.state.role === 'admin' ? '<button class="menu-item" data-action="backup.open">' + icon('shield') + 'Back up now</button>' : '');
}

function renderNotifyMenu(){
  const list = notifications();
  const el = document.getElementById('notify-menu');
  el.innerHTML = '<div class="menu-pop__label">Alerts' + (list.length ? ' · ' + list.length : '') + '</div>' +
    '<div class="notify-list">' +
      (list.length ? list.map((n, i) =>
        '<button class="notify-item notify-item--' + n.kind + '" data-action="notif.go" data-index="' + i + '" style="width:100%;text-align:left;background:transparent;border-left:0;border-right:0;border-top:0">' +
          '<span class="notify-item__icon">' + icon(n.icon) + '</span>' +
          '<span class="notify-item__body"><strong>' + esc(n.title) + '</strong><span>' + esc(n.text) + '</span></span>' +
          '<time>' + timeAgo(n.at) + '</time>' +
        '</button>').join('')
        : '<div class="empty" style="padding:26px 16px"><div class="empty__icon">' + icon('checkCircle') + '</div><h3>No alerts</h3><p>Stock, chats and holds are all clear.</p></div>') +
    '</div>' +
    (App.state.role === 'admin' ? '<div style="padding:8px;border-top:1px solid var(--line)"><button class="btn btn--secondary btn--sm btn--block" data-action="go" data-route="settings" data-value="alerts">Alert settings</button></div>' : '');
}

/* ---------- global search ---------- */
function runSearch(q){
  const term = q.trim().toLowerCase();
  const pop = document.getElementById('search-pop');
  if (!term){ pop.hidden = true; return; }
  const products = SEED.products.filter(p => (p.name + ' ' + p.category + ' ' + p.colour).toLowerCase().indexOf(term) > -1).slice(0,4);
  const customers = SEED.customers.filter(c => (c.name + ' ' + c.phone + ' ' + c.location).toLowerCase().indexOf(term) > -1).slice(0,4);
  const sales = SEED.sales.filter(s => s.id.toLowerCase().indexOf(term) > -1 || (customerById(s.customerId)||{name:''}).name.toLowerCase().indexOf(term) > -1).slice(0,3);
  const convs = SEED.conversations.filter(c => (customerById(c.customerId)||{name:''}).name.toLowerCase().indexOf(term) > -1 || c.messages.some(m => m.text.toLowerCase().indexOf(term) > -1)).slice(0,3);
  let html = '';
  const group = (label, rows) => rows.length ? '<div class="search-pop__group">' + label + '</div>' + rows.join('') : '';
  html += group('Products', products.map(p =>
    '<button class="search-pop__item" data-action="search.product" data-id="' + p.id + '">' + icon('box') + esc(p.name) + '<span>' + money(p.price) + ' · ' + p.qty + ' left</span></button>'));
  html += group('Customers', customers.map(c =>
    '<button class="search-pop__item" data-action="search.customer" data-id="' + c.id + '">' + icon('users') + esc(c.name) + '<span>' + esc(c.phone) + '</span></button>'));
  html += group('Sales', sales.map(s =>
    '<button class="search-pop__item" data-action="search.sale" data-id="' + s.id + '">' + icon('receipt') + esc(s.id) + '<span>' + money(Calc.total(s)) + '</span></button>'));
  html += group('Conversations', convs.map(c =>
    '<button class="search-pop__item" data-action="search.conv" data-id="' + c.id + '">' + icon('message') + esc((customerById(c.customerId)||{name:'Unknown'}).name) + '<span>' + esc(c.summary.slice(0,34)) + '…</span></button>'));
  pop.innerHTML = html || '<div class="search-pop__empty">Nothing matched “' + esc(q) + '”</div>';
  pop.hidden = false;
}

App.actions['search.product'] = (el) => {
  const p = productById(el.getAttribute('data-id'));
  closePopovers();
  document.getElementById('global-search').value = '';
  App.state.route = 'inventory';
  App.state.inv.q = p ? p.name : '';
  render();
};
App.actions['search.customer'] = (el) => { closePopovers(); document.getElementById('global-search').value=''; customerProfile(el.getAttribute('data-id')); };
App.actions['search.sale'] = (el) => { closePopovers(); document.getElementById('global-search').value=''; receiptModal(el.getAttribute('data-id')); };
App.actions['search.conv'] = (el) => { closePopovers(); document.getElementById('global-search').value=''; go('inbox', { id: el.getAttribute('data-id') }); };
function customerProfile(id){ App.actions['cust.view']({ getAttribute:()=> id }); }

App.actions['notif.go'] = (el) => {
  const n = notifications()[Number(el.getAttribute('data-index'))];
  closePopovers();
  if (!n) return;
  go(n.go[0], n.go[1] || {});
};

/* ---------- help ---------- */
function helpModal(){
  openModal({
    title: 'A quick guide',
    sub: 'Built for someone who has never used business software',
    size: 'wide',
    body:
      '<div class="stack">' +
        '<div class="grid-2">' +
          '<div><p class="eyebrow" style="margin-bottom:6px">Every day</p><ul class="help-list">' +
            '<li><span class="mono">01</span><span>Open the <b>Dashboard</b>. Anything red needs you.</span></li>' +
            '<li><span class="mono">02</span><span>Record each sale in <b>Sales</b> — choose the customer and items, take part payment if needed.</span></li>' +
            '<li><span class="mono">03</span><span>Check the <b>Inbox</b> for chats the assistant handed over.</span></li>' +
          '</ul></div>' +
          '<div><p class="eyebrow" style="margin-bottom:6px">Every week</p><ul class="help-list">' +
            '<li><span class="mono">04</span><span>Restock anything flagged low in <b>Inventory</b>.</span></li>' +
            '<li><span class="mono">05</span><span>Open <b>Reports</b> and print or save the sales summary as PDF.</span></li>' +
            '<li><span class="mono">06</span><span>Download a <b>backup</b> and keep it somewhere other than the phone.</span></li>' +
          '</ul></div>' +
        '</div>' +
        '<div class="banner banner--accent">' + icon('sparkles') +
          '<span><strong>Try the assistant:</strong> open the AI assistant → Test console. Ask “Do you have the adire dress in medium?”, then try “Can I get a discount?” and “I have paid”. Watch the tool calls and the refusals.</span></div>' +
        '<div class="banner">' + icon('info') +
          '<span><strong>Where the numbers come from:</strong> stock value = cost × quantity. Profit = (total after discount) − (cost of items sold). Balance = total − paid. The same formulas power every table, receipt and report.</span></div>' +
        '<div class="banner banner--warn">' + icon('alert') +
          '<span><strong>This is a prototype:</strong> all data is sample data held in memory, and nothing is sent to WhatsApp, Claude or a payment provider. Refreshing the page restores the sample business.</span></div>' +
      '</div>',
    footer: '<button class="btn btn--primary" data-close-modal>Start using it</button>'
  });
}

/* ---------- login ---------- */
function bootLogin(){
  const emailEl = document.getElementById('login-email');
  const pwEl = document.getElementById('login-password');
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  const signIn = async () => {
    const email = (emailEl.value || '').trim();
    const password = pwEl.value || '';
    if (!email || !password){ errEl.textContent = 'Enter your email and password.'; return; }
    btn.disabled = true;
    errEl.textContent = 'Signing in…';
    try {
      const out = await API.login(email, password);
      await enterApp(out.user);
      errEl.textContent = '';
    } catch (err) {
      errEl.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  };
  btn.addEventListener('click', signIn);
  [emailEl, pwEl].forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') signIn(); }));
}

/* Sign in, load everything from the database, then show the app. */
async function enterApp(user){
  App.state.user = user.id;
  App.state.role = user.role === 'owner' ? 'admin' : 'staff';
  try {
    await API.loadAll();
  } catch (err) {
    toast('Could not load the shop data: ' + err.message, 'error');
  }
  document.getElementById('auth-screen').hidden = true;
  document.getElementById('app').hidden = false;
  render();
}

/* ---------- events ---------- */
function bindEvents(){
  document.addEventListener('click', (e) => {
    const closer = e.target.closest('[data-close-modal]');
    if (closer && (e.target === closer || closer.classList.contains('modal__close') || closer.tagName === 'BUTTON')){
      closeModal();
      return;
    }
    if (e.target.classList && e.target.classList.contains('modal-scrim')){ closeModal(); return; }

    const actionEl = e.target.closest('[data-action]');
    if (actionEl){
      const name = actionEl.getAttribute('data-action');
      if (App.actions[name]){
        e.preventDefault();
        App.actions[name](actionEl, e);
        if (name !== 'notif.go') closePopovers();
      }
      return;
    }

    if (e.target.closest('#quick-btn')){
      const menu = document.getElementById('quick-menu');
      const willOpen = menu.hidden;
      closePopovers();
      if (willOpen){ renderQuickMenu(); menu.hidden = false; document.getElementById('quick-btn').setAttribute('aria-expanded','true'); }
      return;
    }
    if (e.target.closest('#notify-btn')){
      const menu = document.getElementById('notify-menu');
      const willOpen = menu.hidden;
      closePopovers();
      if (willOpen){ renderNotifyMenu(); menu.hidden = false; }
      return;
    }
    if (e.target.closest('#theme-toggle')){ toggleTheme(); return; }
    if (e.target.closest('#help-btn') || e.target.closest('#foot-help')){ e.preventDefault(); helpModal(); return; }
    if (e.target.closest('#logout-btn')){
      confirmDialog({
        title:'Sign out?', body:'You will return to the sign-in screen. Your data stays in the shop database.',
        ok:'Sign out',
        onOk(){
          API.logout().catch(() => {});
          App.state.user = null;
          document.getElementById('app').hidden = true;
          document.getElementById('auth-screen').hidden = false;
          document.getElementById('login-password').value = '';
          closePopovers();
        }
      });
      return;
    }
    if (e.target.closest('#sidebar-open')){ document.getElementById('app').classList.add('nav-open'); return; }
    if (e.target.closest('#sidebar-close') || e.target.closest('#scrim')){
      document.getElementById('app').classList.remove('nav-open'); return;
    }
    if (!e.target.closest('.menu-pop') && !e.target.closest('#notify-btn') && !e.target.closest('#quick-btn')) closePopovers();
    if (!e.target.closest('.topbar__search')) {
      const pop = document.getElementById('search-pop');
      if (pop) pop.hidden = true;
    }
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'global-search'){ runSearch(el.value); return; }
    if (el.id === 'ai-input' || el.id === 'inbox-input') return;
    const key = el.getAttribute('data-input');
    if (key && App.actions[key]) App.actions[key](el, e);
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    const key = el.getAttribute('data-input') || el.getAttribute('data-change');
    if (key && App.actions[key]) App.actions[key](el, e);
  });

  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && !document.getElementById('modal-root').innerHTML){
      if (e.key === 's' || e.key === 'S'){ e.preventDefault(); App.actions['sale.new'](); return; }
      if (e.key === 'i' || e.key === 'I'){ e.preventDefault(); go('inbox'); return; }
    }
    if (e.key === 'Escape'){
      if (document.getElementById('modal-root').innerHTML) closeModal();
      else closePopovers();
      document.getElementById('app').classList.remove('nav-open');
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){
      e.preventDefault();
      const s = document.getElementById('global-search');
      if (s) s.focus();
    }
    if (e.key === 'Enter' && e.target.id === 'inbox-input' && !e.shiftKey){
      e.preventDefault();
      App.actions['inbox.send']();
    }
    if (e.key === 'Enter' && e.target.id === 'ai-input' && !e.shiftKey){
      e.preventDefault();
      App.actions['ai.console.send']();
    }
    if (e.key === 'Enter' && e.target.id === 'sf-paid'){
      e.preventDefault();
      const btn = document.getElementById('sf-save');
      if (btn) btn.click();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1024) document.getElementById('app').classList.remove('nav-open');
  });
}

/* ---------- boot ---------- */
(function boot(){
  let saved = null;
  try { saved = localStorage.getItem('adeola-theme'); } catch(e){}
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
  bootLogin();
  bindEvents();
  initChartTips();
  renderQuickMenu();

  // Real counts on the sign-in panel, then resume an existing session if there is one.
  API.publicStats().then((s) => {
    const p = document.getElementById('auth-stat-products');
    const c = document.getElementById('auth-stat-customers');
    if (p) p.textContent = String(s.products);
    if (c) c.textContent = String(s.customers);
  }).catch(() => {});

  API.me().then((d) => enterApp(d.user)).catch(() => {});
})();
