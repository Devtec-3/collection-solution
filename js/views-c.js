/* ============================================================
   Views part C — Reports, Activity log, Settings
   ============================================================ */
'use strict';

/* ================= REPORTS ================= */
function reportData(type, days){
  const cut = new Date(); cut.setDate(cut.getDate() - days);
  const sales = SEED.sales.filter(s => new Date(s.date) >= cut);
  if (type === 'sales') return sales;
  return sales;
}

function viewReports(){
  const isAdmin = App.state.role === 'admin';
  if (!isAdmin && App.state.reports.type === 'profit') App.state.reports.type = 'sales';
  const type = App.state.reports.type;
  const days = App.state.reports.days || 30;
  const cut = new Date(); cut.setDate(cut.getDate() - days);
  const sales = SEED.sales.filter(s => new Date(s.date) >= cut);

  const types = [['sales','Sales summary'],['inventory','Stock valuation'],['customers','Customer balances'],['profit','Profit by item']]
    .filter(t => t[0] !== 'profit' || isAdmin)
    .map(t => '<button role="tab" aria-selected="' + (type === t[0]) + '" data-action="rep.type" data-value="' + t[0] + '">' + t[1] + '</button>').join('');

  const periodSelect = '<select class="select" data-input="rep.days" style="width:auto">' +
    [[7,'Last 7 days'],[30,'Last 30 days'],[90,'Last 90 days'],[365,'Last 12 months']].map(o =>
      '<option value="' + o[0] + '"' + (Number(days) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>';

  const revenue = sum(sales, s => Calc.total(s));
  const collected = sum(sales, s => Number(s.paid) || 0);
  const owed = sum(sales, s => Calc.balance(s));
  const cogs = sum(sales, s => Calc.cogs(s));
  const profit = revenue - cogs;

  let kpis = '', table = '', footNote = '';

  if (type === 'sales'){
    kpis = reportKpis([
      ['Sales value', money(revenue)],
      ['Collected', money(collected)],
      ['Outstanding', money(owed)],
      ['Sales count', String(sales.length)]
    ]);
    table = '<table class="table"><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Items</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Balance</th>' + (isAdmin ? '<th class="num">Profit</th>' : '') + '</tr></thead><tbody>' +
      sales.slice().sort((a,b)=> a.date < b.date ? 1 : -1).map(s => {
        const c = customerById(s.customerId);
        return '<tr><td class="mono">' + esc(s.id) + '</td><td>' + fmtDate(s.date) + '</td><td>' + esc(c ? c.name : 'Walk-in') + '</td>' +
          '<td class="small">' + esc(s.items.map(i => i.qty + '× ' + i.name).join(', ')) + '</td>' +
          '<td class="num">' + money(Calc.total(s)) + '</td><td class="num">' + money(s.paid) + '</td><td class="num">' + money(Calc.balance(s)) + '</td>' +
          (isAdmin ? '<td class="num">' + (Calc.profit(s) === null ? '—' : money(Calc.profit(s))) + '</td>' : '') + '</tr>';
      }).join('') + '</tbody>' +
      '<tfoot><tr><td colspan="4">' + sales.length + ' sales</td><td class="num">' + money(revenue) + '</td><td class="num">' + money(collected) + '</td><td class="num">' + money(owed) + '</td>' + (isAdmin ? '<td class="num">' + money(profit) + '</td>' : '') + '</tr></tfoot></table>';
    footNote = 'Revenue is total after discounts. Collected is cash actually received.';
  }

  if (type === 'inventory'){
    const stockCost = Calc.stockValue();
    const retail = Calc.retailValue();
    kpis = reportKpis([
      ['Products', String(SEED.products.length)],
      ['Units', String(sum(SEED.products, p => p.qty))],
      [isAdmin ? 'Stock at cost' : 'Retail value', money(isAdmin ? stockCost : retail)],
      ['Potential profit', isAdmin ? money(retail - stockCost) : '—']
    ]);
    table = '<table class="table"><thead><tr><th>Product</th><th>Category</th><th>Size</th><th class="num">Qty</th>' +
      (isAdmin ? '<th class="num">Cost</th>' : '') + '<th class="num">Price</th><th class="num">Retail value</th><th>Status</th></tr></thead><tbody>' +
      SEED.products.slice().sort((a,b)=> b.qty - a.qty).map(p =>
        '<tr><td>' + esc(p.name) + '</td><td class="small">' + esc(p.category) + '</td><td class="small">' + esc(p.size) + '</td>' +
        '<td class="num">' + p.qty + '</td>' + (isAdmin ? '<td class="num">' + money(p.cost) + '</td>' : '') +
        '<td class="num">' + money(p.price) + '</td><td class="num">' + money(p.qty * p.price) + '</td><td>' + esc(Calc.productStatus(p)) + '</td></tr>').join('') +
      '</tbody><tfoot><tr><td colspan="' + (isAdmin ? 4 : 3) + '">Totals</td><td class="num">' + sum(SEED.products,p=>p.qty) + '</td>' +
      (isAdmin ? '<td class="num">' + money(stockCost) + '</td>' : '') + '<td></td><td class="num">' + money(retail) + '</td><td></td></tr></tfoot></table>';
    footNote = 'Stock value uses cost price × quantity. Retail value uses selling price × quantity.';
  }

  if (type === 'customers'){
    const list = SEED.customers.slice().sort((a,b) => Calc.customer(b).owed - Calc.customer(a).owed);
    const totalOwed = sum(list, c => Calc.customer(c).owed);
    kpis = reportKpis([
      ['Customers', String(list.length)],
      ['Owing money', String(list.filter(c => Calc.customer(c).owed > 0).length)],
      ['Total outstanding', money(totalOwed)],
      ['Lifetime collected', money(sum(list, c => Calc.customer(c).spent))]
    ]);
    table = '<table class="table"><thead><tr><th>Customer</th><th>Phone</th><th>Tags</th><th class="num">Orders</th><th class="num">Total spent</th><th class="num">Outstanding</th><th>Last purchase</th></tr></thead><tbody>' +
      list.map(c => { const st = Calc.customer(c);
        return '<tr><td>' + esc(c.name) + '</td><td class="mono small">' + esc(c.phone) + '</td><td class="small">' + esc((c.tags||[]).join(', ')) + '</td>' +
          '<td class="num">' + st.orders + '</td><td class="num">' + money(st.spent) + '</td>' +
          '<td class="num" style="' + (st.owed ? 'font-weight:500' : '') + '">' + (st.owed ? money(st.owed) : '—') + '</td><td class="small">' + (st.lastPurchase ? fmtDate(st.lastPurchase) : '—') + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td colspan="5">Total outstanding</td><td class="num">' + money(totalOwed) + '</td><td></td></tr></tfoot></table>';
    footNote = 'Balances are calculated from every sale, not entered by hand.';
  }

  if (type === 'profit'){
    const byProduct = {};
    sales.forEach(s => s.items.forEach(it => {
      if (!byProduct[it.productId]) byProduct[it.productId] = { name:it.name, qty:0, revenue:0, cost:0 };
      byProduct[it.productId].qty += it.qty;
      byProduct[it.productId].revenue += it.qty * it.unitPrice;
      byProduct[it.productId].cost += it.qty * (it.cost !== undefined ? it.cost : ((productById(it.productId)||{}).cost || 0));
    }));
    const rows = Object.values(byProduct).sort((a,b) => (b.revenue-b.cost) - (a.revenue-a.cost));
    kpis = reportKpis([
      ['Revenue', money(revenue)],
      ['Cost of goods', money(cogs)],
      ['Gross profit', list.some(s => Calc.profit(s) === null) ? 'Unknown — add cost prices' : money(profit)],
      ['Blended margin', pct(revenue ? (profit/revenue)*100 : 0, 1)]
    ]);
    table = '<table class="table"><thead><tr><th>Product</th><th class="num">Qty sold</th><th class="num">Revenue</th><th class="num">Cost</th><th class="num">Profit</th><th class="num">Margin</th></tr></thead><tbody>' +
      rows.map(r => {
        const p = r.revenue - r.cost;
        return '<tr><td>' + esc(r.name) + '</td><td class="num">' + r.qty + '</td><td class="num">' + money(r.revenue) + '</td>' +
          '<td class="num">' + money(r.cost) + '</td><td class="num">' + money(p) + '</td><td class="num">' + pct(r.revenue ? (p/r.revenue)*100 : 0, 1) + '</td></tr>';
      }).join('') + '</tbody>' +
      '<tfoot><tr><td>Total</td><td class="num">' + sum(rows, r => r.qty) + '</td><td class="num">' + money(revenue) + '</td><td class="num">' + money(cogs) + '</td><td class="num">' + money(profit) + '</td><td class="num">' + pct(revenue ? (profit/revenue)*100 : 0, 1) + '</td></tr></tfoot></table>';
    footNote = 'Profit uses the cost price captured on each sale, so changing a cost price later does not rewrite history.';
  }

  return '<div>' +
    UI.pageHead('Reports',
      'Printable summaries for you, your accountant or a supplier. Numbers are calculated live from the same records.',
      '<button class="btn btn--secondary" data-action="rep.csv">' + icon('download') + 'Export CSV</button>' +
      '<button class="btn btn--primary" data-action="rep.print">' + icon('printer') + 'Print / save PDF</button>') +
    '<div class="tabs" role="tablist">' + types + '</div>' +
    '<div class="toolbar">' + periodSelect + '<span class="toolbar__spacer"></span>' +
      '<span class="small muted">Reporting period ' + fmtDate(cut.toISOString().slice(0,10)) + ' → ' + fmtDate(new Date().toISOString().slice(0,10)) + '</span></div>' +
    '<div class="report-sheet" id="report-sheet">' +
      '<div class="report-head">' +
        '<div><h3>' + esc(SEED.business.name) + '</h3>' +
          '<p>' + esc(SEED.business.tagline) + ' · ' + esc(SEED.business.phone) + '</p>' +
          '<p>' + esc(SEED.business.address) + '</p></div>' +
        '<div class="report-meta">' +
          '<div><b>' + ({sales:'Sales summary',inventory:'Stock valuation',customers:'Customer balances',profit:'Profit by item'})[type] + '</b></div>' +
          '<div>' + fmtDate(cut.toISOString().slice(0,10)) + ' – ' + fmtDate(new Date().toISOString().slice(0,10)) + '</div>' +
          '<div>Generated ' + fmtDate(new Date().toISOString()) + ' · ' + esc(staffById(App.state.user || 'u1').name) + '</div>' +
        '</div>' +
      '</div>' +
      kpis +
      '<div class="table-wrap">' + table + '</div>' +
      '<div class="report-foot"><span>' + esc(footNote) + '</span><span>Demo data · Naira · Store System</span></div>' +
    '</div>' +
    (isAdmin ? '<p class="hint">Profit figures are visible to the owner account only. Staff see the same sales and stock totals without cost or margin.</p>' :
      '<p class="hint">Cost price, profit and margin are hidden on the staff account by design.</p>') +
  '</div>';
}

function reportKpis(items){
  return '<div class="report-kpis">' + items.map(i =>
    '<div><span>' + esc(i[0]) + '</span><strong>' + i[1] + '</strong></div>').join('') + '</div>';
}

App.actions['rep.type'] = (el) => { App.state.reports.type = el.getAttribute('data-value'); render(); };
App.actions['rep.days'] = (el) => { App.state.reports.days = Number(el.value); render(); };
App.actions['rep.print'] = () => { window.print(); };
App.actions['rep.csv'] = () => {
  const type = App.state.reports.type;
  const days = App.state.reports.days || 30;
  const cut = new Date(); cut.setDate(cut.getDate() - days);
  const isAdmin = App.state.role === 'admin';
  if (type === 'customers'){
    downloadFile('report-customer-balances.csv', toCSV(['customer','phone','orders','total_spent','outstanding','last_purchase'],
      SEED.customers.map(c => { const st = Calc.customer(c); return [c.name, c.phone, st.orders, st.spent, st.owed, st.lastPurchase || '']; })));
  } else if (type === 'inventory'){
    downloadFile('report-stock-valuation.csv', toCSV(['product','category','size','qty','price','retail_value'].concat(isAdmin ? ['cost','cost_value'] : []),
      SEED.products.map(p => [p.name, p.category, p.size, p.qty, p.price, p.qty*p.price].concat(isAdmin ? [p.cost, p.qty*p.cost] : []))));
  } else {
    const sales = SEED.sales.filter(s => new Date(s.date) >= cut);
    downloadFile('report-sales.csv', toCSV(['invoice','date','customer','total','paid','balance','profit'].slice(0, isAdmin ? 7 : 6),
      sales.map(s => { const c = customerById(s.customerId); return [s.id, s.date, c ? c.name : 'Walk-in', Calc.total(s), s.paid, Calc.balance(s)].concat(isAdmin ? [(Calc.profit(s) === null ? '' : Calc.profit(s))] : []); })));
  }
  toast('Report exported');
};

/* ================= ACTIVITY LOG ================= */
function viewActivity(){
  const filter = App.state.activityFilter || 'all';
  const types = [['all','Everything'],['ai','AI actions'],['sale','Sales'],['inventory','Inventory'],['customer','Customers'],['settings','Settings'],['system','System']]
    .map(t => '<button data-action="act.filter" data-value="' + t[0] + '" aria-pressed="' + (filter === t[0]) + '">' + t[1] + '</button>').join('');
  const list = SEED.activity.filter(a => filter === 'all' || a.type === filter);

  const iconFor = (t) => t === 'ai' ? 'bot' : t === 'sale' ? 'receipt' : t === 'inventory' ? 'box' : t === 'customer' ? 'users' : t === 'settings' ? 'settings' : t === 'guardrail' ? 'shield' : 'activity';

  return '<div>' +
    UI.pageHead('Activity log',
      'Who changed what, including every action the assistant took. This is your audit trail if a number ever looks wrong.',
      '<button class="btn btn--secondary" data-action="act.export">' + icon('download') + 'Export log</button>') +
    '<div class="inbox__filters" style="margin-bottom:14px">' + types + '</div>' +
    '<div class="card"><div class="list-rows">' +
      (list.length ? list.map(a =>
        '<div class="list-row" style="align-items:flex-start;padding:12px 18px">' +
          '<span class="attention__icon" style="width:26px;height:26px;flex:none;' + (a.type === 'ai' ? 'background:var(--accent-soft);border-color:var(--accent-line);color:var(--accent-ink)' : '') + '">' + icon(iconFor(a.type)) + '</span>' +
          '<span class="list-row__body" style="padding-top:1px"><strong style="white-space:normal">' + esc(a.action) + '</strong>' +
            '<span style="white-space:normal">' + esc(a.actor) + (a.detail ? ' · ' + esc(a.detail) : '') + '</span></span>' +
          '<span class="tiny muted" style="white-space:nowrap;padding-top:2px">' + timeAgo(a.at) + '</span>' +
        '</div>').join('')
      : UI.empty('activity','Nothing logged here yet','Actions you and the assistant take will appear in this list.')) +
    '</div></div>' +
    '<p class="hint">In production the log is append-only and includes sign-in, permission changes and data exports.</p>' +
  '</div>';
}
App.actions['act.filter'] = (el) => { App.state.activityFilter = el.getAttribute('data-value'); render(); };
App.actions['act.export'] = () => {
  downloadFile('activity-log.csv', toCSV(['time','actor','type','action','detail'],
    SEED.activity.map(a => [a.at, a.actor, a.type, a.action, a.detail])));
};

/* ================= SETTINGS ================= */
function viewSettings(){
  if (App.state.role !== 'admin'){
    return UI.pageHead('Settings','Owner controls') +
      '<div class="card">' + UI.empty('lock','Owner only','Business details, staff accounts, AI limits and privacy settings are restricted to the owner account.') + '</div>';
  }
  const tab = App.state.settingsTab || 'business';
  const b = SEED.business;
  const tabs = [['business','Business profile'],['staff','Staff & permissions'],['alerts','Alerts & backup'],['privacy','Privacy & data']]
    .map(t => '<button role="tab" aria-selected="' + (tab === t[0]) + '" data-action="set.tab" data-value="' + t[0] + '">' + t[1] + '</button>').join('');
  let body = '';

  if (tab === 'business'){
    body = '<div class="card"><div class="card__head"><div><h2>Business profile</h2><p>Used on receipts, reports and in every answer the assistant gives about the store</p></div></div>' +
      '<div class="card__body"><div class="form-grid">' +
        '<div class="field"><label class="field-label" for="bs-name">Business name</label><input class="input" id="bs-name" value="' + esc(b.name) + '"></div>' +
        '<div class="field"><label class="field-label" for="bs-tag">What you sell</label><input class="input" id="bs-tag" value="' + esc(b.tagline) + '"></div>' +
        '<div class="field"><label class="field-label" for="bs-phone">Phone</label><input class="input" id="bs-phone" value="' + esc(b.phone) + '"></div>' +
        '<div class="field"><label class="field-label" for="bs-wa">WhatsApp number</label><input class="input" id="bs-wa" value="' + esc(b.whatsapp) + '"></div>' +
        '<div class="field span-2"><label class="field-label" for="bs-addr">Shop address</label><input class="input" id="bs-addr" value="' + esc(b.address) + '"></div>' +
        '<div class="field"><label class="field-label">Currency</label><input class="input" value="Naira (₦)" readonly></div>' +
        '<div class="field"><label class="field-label">Timezone</label><input class="input" value="Africa/Lagos (WAT)" readonly></div>' +
      '</div></div>' +
      '<div class="card__foot" style="display:flex;justify-content:flex-end"><button class="btn btn--primary" data-action="set.saveBusiness">Save business profile</button></div>' +
      '</div>' +

      '<div class="card" style="margin-top:16px"><div class="card__head"><div><h2>Low-stock thresholds</h2><p>Set per product in Inventory. This default applies to new products.</p></div></div>' +
        '<div class="card__body"><div class="setting-row" style="border-bottom:0"><div class="setting-row__body"><strong>Default alert level</strong><span>Alert when quantity falls to this number.</span></div>' +
          '<div class="field"><input class="input" type="number" min="0" id="bs-lowstock" value="' + (SEED.settings.defaultLowStock || 3) + '"></div></div>' +
          '<div class="banner">' + icon('bell') + '<span>Alerts appear on the dashboard and in the notification bell. In production they also send a WhatsApp message to the owner.</span></div>' +
        '</div></div>';
  }

  if (tab === 'staff'){
    body = '<div class="card"><div class="card__head"><div><h2>Staff accounts</h2><p>Role-based access — no shared passwords</p></div>' +
      '<button class="btn btn--primary btn--sm" data-action="set.addStaff">' + icon('plus') + 'Add staff</button></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Since</th><th class="num">Actions</th></tr></thead><tbody>' +
        SEED.staff.map(u => '<tr><td><div class="cell">' + UI.avatar(u.name, u.colour, 'sm') + '<div class="cell__text"><strong>' + esc(u.name) + '</strong><span>' + esc(u.initials) + '</span></div></div></td>' +
          '<td class="small">' + esc(u.email) + '</td>' +
          '<td><span class="chip ' + (u.role === 'admin' ? 'chip--accent' : 'chip--line') + '">' + (u.role === 'admin' ? 'Owner' : 'Staff') + '</span></td>' +
          '<td class="small">' + esc(u.since) + '</td>' +
          '<td><div class="row-actions">' + (u.id !== 'u1' ? '<button class="icon-btn" title="Remove" data-action="set.removeStaff" data-id="' + u.id + '">' + icon('trash') + '</button>' : '<span class="chip chip--line">You</span>') + '</div></td></tr>').join('') +
      '</tbody></table></div>' +
      '<div class="table-note"><span>Staff sign in with their own account. Everything they do is written to the activity log.</span></div></div>' +

      '<div class="card" style="margin-top:16px"><div class="card__head"><div><h2>Who can do what</h2><p>Enforced in the interface and in the API layer</p></div></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Capability</th><th class="num">Owner</th><th class="num">Staff</th><th class="num">AI assistant</th></tr></thead><tbody>' +
        [
          ['See revenue and sales', true, true, false],
          ['See profit, cost and margin', true, false, false],
          ['Record sales and payments', true, true, false],
          ['Apply a discount', true, false, false],
          ['Manage products and stock', true, true, false],
          ['See and edit customer records', true, true, true],
          ['Read stock levels and prices', true, true, true],
          ['Create a hold / draft order', true, true, true],
          ['Confirm a payment', true, true, false],
          ['Change settings and AI limits', true, false, false],
          ['View the activity log', true, false, false]
        ].map(r => '<tr><td>' + esc(r[0]) + '</td>' +
          [r[1], r[2], r[3]].map(v => '<td class="num">' + (v ? '<span style="color:var(--accent-ink)">' + icon('check') + '</span>' : '<span style="color:var(--faint)">—</span>') + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div></div>' +
      '<div class="banner banner--warn" style="margin-top:16px">' + icon('shield') +
        '<span><strong>One owner minimum.</strong> The owner account is the only one that can see profit or change AI limits, so do not share its password with staff.</span></div>';
  }

  if (tab === 'alerts'){
    const a = SEED.settings.alerts;
    body = '<div class="dash__split dash__split--even" style="align-items:start">' +
      '<div class="card"><div class="card__head"><div><h2>Alerts</h2><p>How you find out something needs you</p></div></div>' +
        '<div class="card__body">' +
          '<div class="setting-row"><div class="setting-row__body"><strong>Low-stock alerts</strong><span>Show a banner on the dashboard when items fall below their threshold.</span></div>' +
            '<label class="switch"><input type="checkbox" id="al-low" ' + (a.lowStock ? 'checked' : '') + '><span class="switch__track"></span></label></div>' +
          '<div class="setting-row"><div class="setting-row__body"><strong>Notify the owner directly</strong><span>Send a WhatsApp message to you, not just a dashboard badge.</span></div>' +
            '<label class="switch"><input type="checkbox" id="al-owner" ' + (a.notifyOwner ? 'checked' : '') + '><span class="switch__track"></span></label></div>' +
          '<div class="setting-row"><div class="setting-row__body"><strong>Notification channel</strong><span>Where alerts are delivered.</span></div>' +
            '<div class="field"><select class="select" id="al-channel"><option' + (a.channel === 'WhatsApp' ? ' selected' : '') + '>WhatsApp</option><option>Email</option><option>SMS</option></select></div></div>' +
          '<div class="setting-row" style="border-bottom:0"><div class="setting-row__body"><strong>Daily summary</strong><span>Sales, payments and AI activity at closing time.</span></div>' +
            '<label class="switch"><input type="checkbox" id="al-daily" checked><span class="switch__track"></span></label></div>' +
        '</div>' +
        '<div class="card__foot" style="display:flex;justify-content:flex-end"><button class="btn btn--primary" data-action="set.saveAlerts">Save alerts</button></div></div>' +

      '<div class="card"><div class="card__head"><div><h2>Backup</h2><p>Because a phone can be lost or banned</p></div></div>' +
        '<div class="card__body">' +
          '<div class="detail-grid" style="margin-bottom:14px">' +
            '<div><div class="k">Last backup</div><div class="v" style="font-size:12px">' + timeAgo(SEED.settings.backup.lastRun) + '</div></div>' +
            '<div><div class="k">Kept</div><div class="v" style="font-size:12px">' + SEED.settings.backup.keep + ' copies</div></div>' +
          '</div>' +
          '<div class="setting-row"><div class="setting-row__body"><strong>Frequency</strong><span>Automatic snapshot of all records.</span></div>' +
            '<div class="field"><select class="select" id="bk-freq"><option' + (SEED.settings.backup.frequency === 'Daily' ? ' selected' : '') + '>Daily</option><option' + (SEED.settings.backup.frequency === 'Weekly' ? ' selected' : '') + '>Weekly</option></select></div></div>' +
          '<div class="setting-row"><div class="setting-row__body"><strong>Time</strong><span>After closing is recommended.</span></div>' +
            '<div class="field"><input class="input" type="time" id="bk-time" value="' + esc(SEED.settings.backup.time) + '"></div></div>' +
          '<div class="setting-row" style="border-bottom:0"><div class="setting-row__body"><strong>Test a restore</strong><span>A backup you have never restored is a guess. Check one now.</span></div>' +
            '<button class="btn btn--secondary btn--sm" data-action="backup.open">Open backup</button></div>' +
        '</div>' +
        '<div class="card__foot" style="display:flex;justify-content:flex-end"><button class="btn btn--primary" data-action="set.saveBackup">Save backup settings</button></div></div>' +
    '</div>';
  }

  if (tab === 'privacy'){
    body = '<div class="dash__split dash__split--even" style="align-items:start">' +
      '<div class="card"><div class="card__head"><div><h2>Customer data</h2><p>Nigeria Data Protection Act, handled plainly</p></div></div>' +
        '<div class="card__body"><ul class="help-list">' +
          '<li><span class="mono">01</span><span><b>Tell people.</b> Every chat opens by naming the virtual assistant, and the customer can ask for a human at any time.</span></li>' +
          '<li><span class="mono">02</span><span><b>Use it for the shop only.</b> Contact details are for orders, delivery and updates the customer expects.</span></li>' +
          '<li><span class="mono">03</span><span><b>Opt-out is respected.</b> A customer who asks to stop marketing messages is tagged and excluded from broadcasts.</span></li>' +
          '<li><span class="mono">04</span><span><b>Delete on request.</b> Their record can be removed; the accounting record of sales stays for bookkeeping.</span></li>' +
          '<li><span class="mono">05</span><span><b>Limit access.</b> Staff can see what they need. Cost, profit and settings stay with the owner.</span></li>' +
        '</ul></div></div>' +

      '<div class="card"><div class="card__head"><div><h2>Data controls</h2><p>Your data is not locked inside this preview</p></div></div>' +
        '<div class="card__body">' +
          '<div class="setting-row"><div class="setting-row__body"><strong>Retention</strong><span>How long inactive customer records are kept.</span></div>' +
            '<div class="field"><select class="select" id="pv-ret"><option>12 months</option><option' + ((SEED.settings.privacy.retentionMonths === 24) ? ' selected' : '') + '>24 months</option><option>36 months</option></select></div></div>' +
          '<div class="setting-row"><div class="setting-row__body"><strong>Marketing opt-out</strong><span>Tag and exclude customers who ask not to receive offers.</span></div>' +
            '<label class="switch"><input type="checkbox" id="pv-opt" ' + (SEED.settings.privacy.optOut ? 'checked' : '') + '><span class="switch__track"></span></label></div>' +
          '<div class="setting-row" style="border-bottom:0"><div class="setting-row__body"><strong>Export everything</strong><span>Products, customers, sales, conversations and settings as JSON.</span></div>' +
            '<button class="btn btn--secondary btn--sm" data-action="backup.open">Export</button></div>' +
        '</div>' +
        '<div class="card__foot" style="display:flex;justify-content:flex-end"><button class="btn btn--primary" data-action="set.savePrivacy">Save privacy settings</button></div></div>' +
    '</div>' +

    '<div class="card" style="margin-top:16px;border-color:color-mix(in srgb,var(--danger) 25%,var(--line))">' +
      '<div class="card__head"><div><h2>Danger zone</h2><p>Demo utilities — these affect this browser tab only</p></div></div>' +
      '<div class="card__body" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between">' +
        '<div><strong class="small">Reset the demo</strong><p class="small muted" style="margin-top:2px">Discards everything you added and restores the sample business.</p></div>' +
        '<button class="btn btn--secondary" data-action="set.reset">' + icon('refresh') + 'Reset demo data</button>' +
      '</div></div>';
  }

  return '<div>' +
    UI.pageHead('Settings',
      'Business details, staff access, alerts and privacy. Only the owner account can open this page.',
      '<button class="btn btn--secondary" data-action="act.export">' + icon('download') + 'Export activity log</button>') +
    '<div class="tabs" role="tablist">' + tabs + '</div>' +
    body +
  '</div>';
}

App.actions['set.tab'] = (el) => { App.state.settingsTab = el.getAttribute('data-value'); render(); };
App.actions['set.saveBusiness'] = async () => {
  const get = (id) => (document.getElementById(id) || {}).value || '';
  const phones = get('bs-phone').split(/[·,\/]/).map(s => s.trim()).filter(Boolean);
  const business = {
    name: get('bs-name'),
    tagline: get('bs-tag'),
    phones,
    whatsapp: get('bs-wa'),
    address: get('bs-addr'),
    hours: SEED.business.hours,
    delivery: SEED.business.delivery,
    pickup: SEED.business.pickup,
  };
  try {
    await API.saveSettings({ business });
    await API.loadAll();
    toast('Business profile saved');
    render();
  } catch (err) { toast(err.message, 'error'); }
};

async function saveStorePrefs(patch, message){
  try {
    await API.saveSettings({ store: Object.assign({}, SEED.store || {}, patch) });
    SEED.store = Object.assign({}, SEED.store || {}, patch);
    toast(message);
    render();
  } catch (err) { toast(err.message, 'error'); }
}
App.actions['set.saveAlerts'] = () => {
  saveStorePrefs({ alerts: {
    lowStock: document.getElementById('al-low').checked,
    notifyOwner: document.getElementById('al-owner').checked,
    channel: document.getElementById('al-channel').value,
  } }, 'Alert settings saved');
};
App.actions['set.saveBackup'] = () => {
  saveStorePrefs({ backup: {
    frequency: document.getElementById('bk-freq').value,
    time: document.getElementById('bk-time').value,
  } }, 'Backup schedule saved');
};
App.actions['set.savePrivacy'] = () => {
  saveStorePrefs({ privacy: {
    optOut: document.getElementById('pv-opt').checked,
    retentionMonths: SEED.settings.privacy.retentionMonths,
  } }, 'Privacy settings saved');
};
App.actions['set.addStaff'] = () => {
  openModal({
    title: 'Add staff account',
    sub: 'They get their own login — never share the owner password',
    body: '<div class="form-grid">' +
      '<div class="field span-2"><label class="field-label" for="st-name">Full name</label><input class="input" id="st-name" placeholder="e.g. Tunde Bakare"></div>' +
      '<div class="field span-2"><label class="field-label" for="st-email">Email</label><input class="input" id="st-email" type="email" placeholder="name@shop.com"></div>' +
      '<div class="field span-2"><label class="field-label">Role</label>' +
        '<select class="select" id="st-role"><option value="staff">Staff — sales, stock, customers</option><option value="admin">Owner — full access</option></select></div>' +
      '<div class="span-2"><div class="banner">' + icon('info') + '<span>In production the person receives an email invite to set their own password. An invite link expires in 48 hours.</span></div></div>' +
      '</div>',
    footer: '<button class="btn btn--secondary" data-close-modal>Cancel</button><button class="btn btn--primary" id="st-save">Send invite</button>',
    onMount(root){
      root.querySelector('#st-save').addEventListener('click', () => {
        const name = root.querySelector('#st-name').value.trim();
        const email = root.querySelector('#st-email').value.trim();
        if (!name || !email){ toast('Name and email are required', 'error'); return; }
        SEED.staff.push({
          id: uid('u'), name, email, role: root.querySelector('#st-role').value,
          initials: initials(name), colour: stringColour(name), since: String(new Date().getFullYear())
        });
        logActivity('Invited staff member ' + name, email + ' · role ' + root.querySelector('#st-role').value, 'settings');
        closeModal(); toast('Invite sent to ' + email); render();
      });
    }
  });
};
App.actions['set.removeStaff'] = (el) => {
  const id = el.getAttribute('data-id');
  const u = SEED.staff.find(x => x.id === id);
  if (!u) return;
  confirmDialog({
    title: 'Remove ' + u.name + '?',
    body: 'They will lose access immediately. Their past sales and actions remain in the activity log.',
    ok: 'Remove access', danger: true,
    onOk(){
      SEED.staff = SEED.staff.filter(x => x.id !== id);
      logActivity('Removed staff access', u.name + ' · ' + u.email, 'settings');
      toast('Staff access removed'); render();
    }
  });
};
App.actions['set.reset'] = () => {
  confirmDialog({
    title: 'Reset the demo?',
    body: 'All changes made in this tab will be discarded and the sample data will load again.',
    ok: 'Reset demo', danger: true,
    onOk(){ location.reload(); }
  });
};
