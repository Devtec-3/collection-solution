/* ============================================================
   Views part A — shared helpers, Dashboard, Inventory, Sales
   ============================================================ */
'use strict';

const UI = {
  pageHead(title, sub, actions){
    return '<div class="page-head"><div><h2>' + esc(title) + '</h2>' +
      (sub ? '<p>' + sub + '</p>' : '') + '</div>' +
      (actions ? '<div class="page-actions">' + actions + '</div>' : '') + '</div>';
  },
  avatar(name, colour, size){
    return '<span class="avatar ' + (size === 'lg' ? 'avatar--lg' : size === 'sm' ? 'avatar--sm' : '') + '" style="--av:' + (colour || stringColour(name)) + '">' + esc(initials(name)) + '</span>';
  },
  thumb(p, cls){
    const fallback = '<span>' + esc(initials(p.name)) + '</span>';
    return '<span class="thumb ' + (cls || '') + '">' + (p.photo ? '<img src="' + esc(p.photo) + '" alt="" loading="lazy" onerror="this.remove()">' : fallback) + '</span>';
  },
  statusChip(status){
    const map = {
      'available': ['chip--dot is-live', 'Available'],
      'low stock': ['chip--dot is-warn', 'Low stock'],
      'sold out': ['chip--dot is-danger', 'Sold out'],
      'paid': ['chip--accent', 'Paid'],
      'part': ['chip--warn', 'Part paid'],
      'unpaid': ['chip--danger', 'Unpaid'],
      'ai': ['chip--dot is-live', 'AI handling'],
      'human': ['chip--accent', 'Staff'],
      'staff': ['chip--accent', 'Staff'],
      'waiting': ['chip--dot is-danger', 'Needs human']
    };
    const it = map[status] || ['chip--line', status];
    return '<span class="chip ' + it[0] + '">' + (it[0].indexOf('dot') > -1 ? '<span class="dot"></span>' : '') + it[1] + '</span>';
  },
  sortTh(label, key, state, action, numeric){
    const active = state.sort === key;
    const dir = active ? state.dir : 0;
    return '<th class="sortable ' + (numeric ? 'num' : '') + '" ' + (active ? 'aria-sort="' + (dir === 1 ? 'ascending' : 'descending') + '"' : '') +
      ' data-action="' + action + '" data-key="' + key + '"><span class="sort">' + esc(label) +
      (active ? icon(dir === 1 ? 'arrowUp' : 'arrowDown') : icon('sort')) + '</span></th>';
  },
  empty(iconName, title, text, cta){
    return '<div class="empty"><div class="empty__icon">' + icon(iconName) + '</div><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + (cta || '') + '</div>';
  },
  meter(value, max, cls){
    const p = max ? clamp((value/max)*100, 0, 100) : 0;
    return '<span class="meter ' + (cls||'') + '"><span style="width:' + p.toFixed(0) + '%"></span></span>';
  },
  delta(v){
    if (!isFinite(v)) return '<span class="muted">no prior period</span>';
    const up = v >= 0;
    return '<span class="delta ' + (up ? 'delta--up' : 'delta--down') + '">' + icon(up ? 'arrowUp' : 'arrowDown') + Math.abs(v).toFixed(0) + '%</span>';
  },
  kpi(label, value, meta, iconName){
    return '<div class="stat"><div class="stat__label">' + (iconName ? icon(iconName) : '') + esc(label) + '</div>' +
      '<div class="stat__value">' + value + '</div>' +
      (meta ? '<div class="stat__meta">' + meta + '</div>' : '') + '</div>';
  }
};

function stringColour(name){
  const palette = ['#2F4F3E','#6B4E31','#3C4A5A','#5A3F4E','#4A4A2F','#3F4F5A','#5A4A3F','#1F4A47'];
  let h = 0;
  for (let i=0;i<String(name||'').length;i++) h = (h*31 + String(name).charCodeAt(i)) % 997;
  return palette[h % palette.length];
}

/* ================= DASHBOARD ================= */
function viewDashboard(){
  const m = metrics(App.state.range);
  const isAdmin = App.state.role === 'admin';
  const series = revenueSeries(App.state.range);
  const waiting = SEED.conversations.filter(c => c.needsAttention || c.status === 'waiting');
  const drafts = SEED.drafts.filter(d => d.status === 'awaiting_approval');
  const low = Calc.lowStock();
  const soldOut = Calc.soldOut();
  const today = new Date().toISOString().slice(0,10);
  const todaysSales = SEED.sales.filter(s => s.date === today);
  const todayRevenue = sum(todaysSales, s => Calc.total(s));

  const rangeBtns = [7,30,90].map(d =>
    '<button data-action="dash.range" data-value="' + d + '" aria-pressed="' + (App.state.range === d) + '">' + d + ' days</button>'
  ).join('');

  const statHero = isAdmin
    ? UI.kpi('Revenue', money(m.revenue), UI.delta(m.growth) + '<span>vs previous ' + m.range + 'd</span>', 'wallet')
    : UI.kpi('Revenue', money(m.revenue), UI.delta(m.growth) + '<span>vs previous ' + m.range + 'd</span>', 'wallet');

  const attentionRows = []
    .concat(waiting.map(c => {
      const cu = customerById(c.customerId);
      return '<button class="list-row" data-action="go" data-route="inbox" data-id="' + c.id + '" style="width:100%;text-align:left">' +
        UI.avatar(cu ? cu.name : '?', null) +
        '<span class="list-row__body"><strong>' + esc(cu ? cu.name : 'Unknown') + '</strong><span>' + esc(c.attentionReason || 'Waiting for a human reply') + '</span></span>' +
        '<span class="chip chip--danger">Reply</span></button>';
    }))
    .concat(drafts.map(d => {
      const cu = customerById(d.customerId);
      return '<button class="list-row" data-action="ai.openOrder" data-id="' + d.id + '" style="width:100%;text-align:left">' +
        '<span class="rank">' + icon('clock') + '</span>' +
        '<span class="list-row__body"><strong>Approve hold ' + esc(d.id) + '</strong><span>' + esc(cu ? cu.name : 'Customer') + ' · expires ' + fmtDate(d.expiresAt, {short:true}) + '</span></span>' +
        '<span class="chip chip--warn">Review</span></button>';
    }));

  const attentionCard =
    '<div class="card"><div class="card__head"><div><h2>Needs human attention</h2><p>' +
      (attentionRows.length ? attentionRows.length + ' item' + (attentionRows.length>1?'s':'') + ' waiting on you' : 'Nothing waiting — the assistant has it covered') +
      '</p></div><span class="chip ' + (attentionRows.length ? 'chip--danger' : 'chip--accent') + '">' + attentionRows.length + '</span></div>' +
      '<div class="list-rows">' + (attentionRows.length ? attentionRows.join('') : UI.empty('checkCircle','All clear','No unanswered chats and no orders waiting for approval.')) + '</div></div>';

  const lowRows = low.concat(soldOut).slice(0,5).map(p =>
    '<div class="list-row">' + UI.thumb(p) +
      '<span class="list-row__body"><strong>' + esc(p.name) + '</strong><span>' + esc(p.category) + ' · ' + esc(p.colour) + ' · size ' + esc(p.size) + '</span></span>' +
      '<span class="list-row__value" style="color:' + (p.qty ? 'var(--warn)' : 'var(--danger)') + '">' + (p.qty ? p.qty + ' left' : 'Sold out') + '</span>' +
    '</div>');

  const topRows = m.topSellers.map((t, i) =>
    '<div class="list-row"><span class="rank">' + (i+1) + '</span>' +
      '<span class="list-row__body"><strong>' + esc(t.name) + '</strong><span>' + t.qty + ' sold</span></span>' +
      '<span class="list-row__value">' + money(t.revenue) + '</span></div>');

  const catRows = Chr.categoryList(m.byCategory);
  const aiPct = (m.aiSales + m.manualSales) ? Math.round((m.aiSales / (m.aiSales + m.manualSales)) * 100) : 0;
  const aiSalesRevenue = sum(SEED.sales.filter(s => s.aiAssisted && salesIn(App.state.range).indexOf(s) > -1), s => Calc.total(s));

  return '<div class="dash">' +
    UI.pageHead('Dashboard',
      'Live data · ' + fmtDate(new Date().toISOString()) + ' · ' + todaysSales.length + ' sale' + (todaysSales.length===1?'':'s') + ' today worth <b class="strong">' + money(todayRevenue) + '</b>',
      '<div class="segmented">' + rangeBtns + '</div>' +
      '<button class="btn btn--primary" data-action="sale.new">' + icon('plus') + 'Record sale</button>') +

    '<div class="statstrip">' +
      statHero +
      (isAdmin
        ? (m.profitUnknown
            ? UI.kpi('Gross profit', 'Unknown', '<span>add cost prices to see profit</span>', 'chart')
            : UI.kpi('Gross profit', money(m.profit), UI.delta(m.profitGrowth) + '<span>after cost of goods</span>', 'chart'))
        : UI.kpi('Outstanding', money(m.owed), '<span>owed by customers</span>', 'clock')) +
      UI.kpi('Stock value', money(m.stockValue), '<span>' + m.lowStock + ' low · ' + m.soldOut + ' sold out</span>', 'box') +
      UI.kpi('Items sold', num(m.items), '<span>' + m.salesCount + ' sales · avg ' + shortMoney(m.avgSale) + '</span>', 'receipt') +
    '</div>' +

    '<div class="dash__split">' +
      '<div class="card"><div class="card__head"><div><h2>Sales over time</h2><p>Value of sales after discounts, last ' + m.range + ' days</p></div>' +
        '<span class="chip chip--line">' + icon('chart') + ' Net revenue</span></div>' +
        '<div class="card__body" style="padding-bottom:6px">' + Chr.area(series, { value:'revenue', label:'Net revenue', height:240 }) + '</div>' +
        '<div class="card__foot" style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
          '<span class="small muted">Best day ' + esc((series.slice().sort((a,b)=>b.revenue-a.revenue)[0] || {}).label || '—') +
            ' · ' + money((series.slice().sort((a,b)=>b.revenue-a.revenue)[0] || {}).revenue || 0) + '</span>' +
          '<span class="small muted">Period total <b class="strong">' + money(m.revenue) + '</b></span>' +
        '</div></div>' +
      attentionCard +
    '</div>' +

    '<div class="grid-3">' +
      '<div class="card"><div class="card__head"><div><h2>Top sellers</h2><p>By revenue, this period</p></div>' +
        '<a href="#" class="link-btn" data-action="go" data-route="reports">Report ' + icon('chevronRight') + '</a></div>' +
        '<div class="list-rows">' + (topRows.length ? topRows.join('') : UI.empty('box','No sales yet','Record a sale and it will appear here.')) + '</div></div>' +

      '<div class="card"><div class="card__head"><div><h2>Sales by category</h2><p>Where the money came from</p></div></div>' +
        '<div class="card__body">' + (m.byCategory.length ? catRows : '<p class="small muted">No category data for this period.</p>') + '</div></div>' +

      '<div class="card"><div class="card__head"><div><h2>AI assistant</h2><p>' + (SEED.settings.ai.enabled ? 'Active · after-hours cover' : 'Paused') + '</p></div>' +
        '<span class="chip ' + (SEED.settings.ai.enabled ? 'chip--accent' : 'chip--line') + '">' + (SEED.settings.ai.enabled ? 'On' : 'Off') + '</span></div>' +
        '<div class="card__body">' +
          '<div style="display:flex;align-items:center;gap:16px">' +
            Chr.donut([
              { value: m.aiSales, color:'var(--accent)' },
              { value: m.manualSales, color:'var(--line-2)' }
            ], { size:104, thickness:12, centerLabel: aiPct + '%', centerSub:'AI-assisted' }) +
            '<div class="legend-list" style="flex:1">' +
              '<li><span class="swatch"></span>AI-assisted<b>' + m.aiSales + '</b></li>' +
              '<li><span class="swatch swatch--muted"></span>Manual<b>' + m.manualSales + '</b></li>' +
            '</div>' +
          '</div>' +
          '<dl class="kv" style="margin-top:14px"><dt>Conversations handled today</dt><dd>' + m.aiToday + '</dd></dl>' +
          '<dl class="kv"><dt>Needs attention</dt><dd>' + m.waiting + '</dd></dl>' +
          '<dl class="kv"><dt>AI-assisted revenue</dt><dd>' + (isAdmin ? money(aiSalesRevenue) : '—') + '</dd></dl>' +
        '</div>' +
        '<div class="card__foot"><button class="btn btn--secondary btn--sm btn--block" data-action="go" data-route="ai">Open AI control panel</button></div></div>' +
    '</div>' +

    '<div class="dash__split dash__split--even">' +
      '<div class="card"><div class="card__head"><div><h2>Low stock & restock</h2><p>Thresholds are set per product</p></div>' +
        '<button class="btn btn--ghost btn--sm" data-action="go" data-route="inventory">Inventory ' + icon('chevronRight') + '</button></div>' +
        '<div class="list-rows">' + (lowRows.length ? lowRows.join('') : UI.empty('checkCircle','Stock levels healthy','No product is below its threshold.')) + '</div></div>' +

      '<div class="card"><div class="card__head"><div><h2>Recent activity</h2><p>Everything that changed, including AI actions</p></div>' +
        '<button class="btn btn--ghost btn--sm" data-action="go" data-route="activity">View all</button></div>' +
        '<div class="card__body"><div class="timeline">' +
          SEED.activity.slice(0,5).map(a =>
            '<div class="timeline__item ' + (a.actor === 'AI Assistant' ? 'is-accent' : '') + '">' +
              '<strong>' + esc(a.action) + '</strong>' +
              '<span>' + esc(a.actor) + (a.detail ? ' · ' + esc(a.detail) : '') + '</span>' +
              '<time>' + timeAgo(a.at) + '</time>' +
            '</div>').join('') +
        '</div></div></div>' +
    '</div>' +
  '</div>';
}

App.actions['dash.range'] = (el) => {
  App.state.range = Number(el.getAttribute('data-value'));
  render();
};

/* ================= INVENTORY ================= */
function filteredProducts(){
  const s = App.state.inv;
  let list = SEED.products.slice();
  if (s.q){
    const q = s.q.toLowerCase();
    list = list.filter(p => (p.name + ' ' + p.category + ' ' + p.colour + ' ' + p.size + ' ' + p.grade).toLowerCase().indexOf(q) > -1);
  }
  if (s.category !== 'all') list = list.filter(p => p.category === s.category);
  if (s.status !== 'all'){
    list = list.filter(p => {
      const st = Calc.productStatus(p);
      return s.status === 'low' ? st === 'low stock' : st === s.status;
    });
  }
  const key = s.sort;
  list.sort((a,b) => {
    let av = a[key], bv = b[key];
    if (key === 'status'){ av = Calc.productStatus(a); bv = Calc.productStatus(b); }
    if (typeof av === 'string') return av.localeCompare(bv) * s.dir;
    return (av - bv) * s.dir;
  });
  return list;
}

function viewInventory(){
  const s = App.state.inv;
  const isAdmin = App.state.role === 'admin';
  const list = filteredProducts();
  const stockValue = sum(list, p => p.qty * p.cost);
  const retailValue = sum(list, p => p.qty * p.price);
  const units = sum(list, p => p.qty);

  const rows = list.map(p => {
    const st = Calc.productStatus(p);
    return '<tr>' +
      '<td><div class="cell">' + UI.thumb(p) + '<div class="cell__text"><strong>' + esc(p.name) + '</strong><span>' + esc(p.category) + (p.size ? ' · ' + esc(p.size) : '') + '</span></div></div></td>' +
      '<td class="small">' + esc(p.size) + ' · ' + esc(p.colour) + '</td>' +
      '<td><span class="chip chip--line">' + esc(p.grade.replace('Grade ','')) + '</span></td>' +
      (isAdmin ? '<td class="num small muted">' + money(p.cost) + '</td>' : '') +
      '<td class="num"><b class="strong">' + money(p.price) + '</b></td>' +
      '<td class="num">' + p.qty + (Calc.onHold(p.id) ? '<div class="tiny" style="color:var(--warn)">' + Calc.onHold(p.id) + ' held</div>' : '<span class="tiny muted"> / ' + (p.lowStock||3) + '</span>') + '</td>' +
      '<td>' + UI.statusChip(st) + '</td>' +
      '<td><div class="row-actions">' +
        '<button class="icon-btn" title="Quick restock" data-action="inv.restock" data-id="' + p.id + '">' + icon('plus') + '</button>' +
        '<button class="icon-btn" title="Edit" data-action="inv.edit" data-id="' + p.id + '">' + icon('edit') + '</button>' +
        '<button class="icon-btn" title="Delete" data-action="inv.delete" data-id="' + p.id + '">' + icon('trash') + '</button>' +
      '</div></td>' +
    '</tr>';
  }).join('');

  const catOptions = ['all'].concat(SEED.categories).map(c =>
    '<option value="' + c + '"' + (s.category === c ? ' selected' : '') + '>' + (c === 'all' ? 'All categories' : c) + '</option>').join('');
  const statusOptions = [['all','All stock'],['available','Available'],['low','Low stock'],['sold out','Sold out']].map(o =>
    '<option value="' + o[0] + '"' + (s.status === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('');

  return '<div>' +
    UI.pageHead('Inventory',
      'Live stock for the shop floor and for the AI assistant. Every price the assistant quotes comes from this table.',
      '<button class="btn btn--secondary" data-action="inv.import">' + icon('upload') + 'Import</button>' +
      '<button class="btn btn--secondary" data-action="inv.export">' + icon('download') + 'Export</button>' +
      '<button class="btn btn--primary" data-action="inv.new">' + icon('plus') + 'Add product</button>') +

    (Calc.lowStock().length || Calc.soldOut().length ?
      '<div class="attention attention--warn" style="margin-bottom:14px">' +
        '<span class="attention__icon">' + icon('alert') + '</span>' +
        '<div class="attention__body"><strong>' + Calc.lowStock().length + ' products low, ' + Calc.soldOut().length + ' sold out</strong>' +
        '<span>Restock before the assistant has to turn customers away.</span></div>' +
        '<button class="btn btn--secondary btn--sm" data-action="inv.filterLow">Show low stock</button>' +
      '</div>' : '') +

    '<div class="card">' +
      '<div class="card__body" style="padding:12px 14px 0">' +
        '<div class="toolbar">' +
          '<label class="search">' + icon('search') +
            '<input class="input" type="search" placeholder="Search name, colour, size…" value="' + esc(s.q) + '" data-input="inv.search" aria-label="Search inventory">' +
          '</label>' +
          '<select class="select" data-input="inv.category" aria-label="Filter by category">' + catOptions + '</select>' +
          '<select class="select" data-input="inv.status" aria-label="Filter by status">' + statusOptions + '</select>' +
          '<span class="toolbar__spacer"></span>' +
          '<span class="small muted">' + list.length + ' of ' + SEED.products.length + ' products</span>' +
        '</div>' +
      '</div>' +
      '<div class="table-wrap"><table class="table">' +
        '<thead><tr>' +
          UI.sortTh('Product', 'name', s, 'inv.sort') +
          '<th>Size · colour</th>' +
          UI.sortTh('Grade', 'grade', s, 'inv.sort') +
          (isAdmin ? UI.sortTh('Cost', 'cost', s, 'inv.sort', true) : '') +
          UI.sortTh('Selling price', 'price', s, 'inv.sort', true) +
          UI.sortTh('Qty', 'qty', s, 'inv.sort', true) +
          UI.sortTh('Status', 'status', s, 'inv.sort') +
          '<th class="num">Actions</th>' +
        '</tr></thead>' +
        '<tbody>' + (rows || '') + '</tbody>' +
        (list.length ? '<tfoot><tr>' +
          '<td colspan="' + (isAdmin ? 6 : 5) + '">' + units + ' units in view</td>' +
          '<td colspan="' + (isAdmin ? 2 : 2) + '" class="num">' + (isAdmin ? 'Cost ' + money(stockValue) + ' · ' : '') + 'Retail ' + money(retailValue) + '</td>' +
        '</tr></tfoot>' : '') +
      '</table></div>' +
      (!list.length ? UI.empty('box', 'No products match', 'Try a different search or clear the filters.', '<button class="btn btn--secondary btn--sm" data-action="inv.clear">Clear filters</button>') : '') +
      '<div class="table-note">' +
        '<span>Stock reduces automatically when you record a sale. Prices are in Naira.</span>' +
        '<span>Selling price × qty = <b>retail value</b> · cost price × qty = <b>stock value</b>' + (isAdmin ? '' : ' (cost hidden for staff)') + '</span>' +
      '</div>' +
    '</div>' +
  '</div>';
}

App.actions['inv.sort'] = (el) => {
  const key = el.getAttribute('data-key');
  const s = App.state.inv;
  if (s.sort === key) s.dir = -s.dir; else { s.sort = key; s.dir = 1; }
  render();
};
App.actions['inv.clear'] = () => { App.state.inv = { q:'', category:'all', sort:'name', dir:1, status:'all' }; render(); };
App.actions['inv.filterLow'] = () => { App.state.inv.status = 'low'; render(); };
App.actions['inv.search'] = (el) => { App.state.inv.q = el.value; renderKeepFocus('inv.search'); };
App.actions['inv.category'] = (el) => { App.state.inv.category = el.value; render(); };
App.actions['inv.status'] = (el) => { App.state.inv.status = el.value; render(); };

/* ---------- product form ---------- */
function productForm(id){
  const p = id ? productById(id) : null;
  const v = p || { name:'', category:'Dresses', size:'M', grade:'Grade A', colour:'Black', cost:'', price:'', qty:'', lowStock:3, photo:'', notes:'' };
  const isAdmin = App.state.role === 'admin';
  const opt = (arr, cur) => arr.map(x => '<option value="' + esc(x) + '"' + (x === cur ? ' selected' : '') + '>' + esc(x) + '</option>').join('');

  openModal({
    title: p ? 'Edit product' : 'Add product',
    sub: p ? p.name + ' · ' + p.category : 'New item in your catalogue',
    size: 'wide',
    body:
      '<div class="form-grid">' +
        '<div class="form-section-label">Item details</div>' +
        '<div class="field span-2"><label class="field-label" for="pf-name">Product name</label>' +
          '<input class="input" id="pf-name" value="' + esc(v.name) + '" placeholder="e.g. Adire Wrap Dress"></div>' +
        '<div class="field"><label class="field-label" for="pf-cat">Category</label>' +
          '<select class="select" id="pf-cat">' + opt(SEED.categories, v.category) + '</select></div>' +
        '<div class="field"><label class="field-label" for="pf-grade">Quality / grade</label>' +
          '<select class="select" id="pf-grade">' + opt(SEED.grades, v.grade) + '</select></div>' +
        '<div class="field"><label class="field-label" for="pf-size">Size</label>' +
          '<input class="input" id="pf-size" value="' + esc(v.size) + '" placeholder="M, 42, One size" list="size-list"></div>' +
        '<div class="field"><label class="field-label" for="pf-colour">Colour</label>' +
          '<input class="input" id="pf-colour" value="' + esc(v.colour) + '" placeholder="e.g. Indigo"></div>' +
        '<datalist id="size-list">' + SEED.sizes.map(s => '<option value="' + esc(s) + '">').join('') + '</datalist>' +

        '<div class="form-section-label">Pricing & stock</div>' +
        (isAdmin ? '<div class="field"><label class="field-label" for="pf-cost">Cost price (₦)</label>' +
          '<input class="input" id="pf-cost" type="number" min="0" step="50" value="' + (v.cost === '' ? '' : v.cost) + '" placeholder="0">' +
          '<span class="field-note">What you paid. Used only for profit — never shown to customers.</span></div>' :
          '<input type="hidden" id="pf-cost" value="' + (v.cost || 0) + '"><div class="field"><label class="field-label">Cost price</label><input class="input" value="Hidden for staff" readonly></div>') +
        '<div class="field"><label class="field-label" for="pf-price">Selling price (₦)</label>' +
          '<input class="input" id="pf-price" type="number" min="0" step="50" value="' + (v.price === '' ? '' : v.price) + '" placeholder="0">' +
          '<span class="field-note">The only price the AI assistant may quote.</span></div>' +
        '<div class="field"><label class="field-label" for="pf-qty">Quantity in stock</label>' +
          '<input class="input" id="pf-qty" type="number" min="0" step="1" value="' + (v.qty === '' ? '' : v.qty) + '" placeholder="0"></div>' +
        '<div class="field"><label class="field-label" for="pf-low">Low-stock alert at</label>' +
          '<input class="input" id="pf-low" type="number" min="0" step="1" value="' + v.lowStock + '">' +
          '<span class="field-note">You get an alert when quantity reaches this number.</span></div>' +

        '<div class="form-section-label">Photo & notes</div>' +
        '<div class="field span-2"><label class="field-label" for="pf-photo">Photo URL (optional)</label>' +
          '<input class="input" id="pf-photo" value="' + esc(v.photo || '') + '" placeholder="https://…">' +
          '<span class="field-note">Leave blank to show a clean monogram tile. In production, staff upload from the phone camera.</span></div>' +
        '<div class="field span-2"><label class="field-label" for="pf-notes">Internal note (optional)</label>' +
          '<input class="input" id="pf-notes" value="' + esc(v.notes || '') + '" placeholder="e.g. supplier, restock date"></div>' +
        '<div class="span-2 calc-box" id="pf-calc"></div>' +
      '</div>',
    footer: '<button class="btn btn--secondary" data-close-modal>Cancel</button>' +
      '<button class="btn btn--primary" id="pf-save">' + (p ? 'Save changes' : 'Add product') + '</button>',
    onMount(root){
      const calc = () => {
        const cost = Number(root.querySelector('#pf-cost').value) || 0;
        const price = Number(root.querySelector('#pf-price').value) || 0;
        const qty = Number(root.querySelector('#pf-qty').value) || 0;
        const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
        root.querySelector('#pf-calc').innerHTML =
          '<dl><dt>Profit per unit</dt><dd>' + money(price - cost) + '</dd>' +
          '<dt>Margin</dt><dd>' + pct(margin, 1) + '</dd>' +
          '<dt>Stock value at cost</dt><dd>' + money(cost * qty) + '</dd>' +
          '<dt class="total">Retail value</dt><dd class="total">' + money(price * qty) + '</dd></dl>';
      };
      ['#pf-cost','#pf-price','#pf-qty'].forEach(sel => root.querySelector(sel).addEventListener('input', calc));
      calc();
      root.querySelector('#pf-save').addEventListener('click', async () => {
        const name = root.querySelector('#pf-name').value.trim();
        const price = Number(root.querySelector('#pf-price').value);
        const qty = Number(root.querySelector('#pf-qty').value);
        if (!name){ toast('Product name is required', 'error'); return; }
        if (!price || price <= 0){ toast('Selling price must be more than zero', 'error'); return; }
        const data = {
          name,
          category: root.querySelector('#pf-cat').value,
          grade: root.querySelector('#pf-grade').value,
          size: root.querySelector('#pf-size').value.trim() || 'One size',
          colour: root.querySelector('#pf-colour').value.trim() || '—',
          cost: Number(root.querySelector('#pf-cost').value) || 0,
          price,
          qty: isNaN(qty) ? 0 : qty,
          lowStock: Number(root.querySelector('#pf-low').value) || 1,
          photo: root.querySelector('#pf-photo').value.trim(),
          notes: root.querySelector('#pf-notes').value.trim()
        };
        const saveBtn = root.querySelector('#pf-save');
        saveBtn.disabled = true;
        try {
          if (p){ await API.updateProduct(p.id, data); toast('Product updated'); }
          else { await API.createProduct(data); toast('Product added to inventory'); }
          await API.loadAll();
          closeModal(); render();
        } catch (err) {
          toast(err.message, 'error');
          saveBtn.disabled = false;
        }
      });
    }
  });
}

App.actions['inv.new'] = () => productForm();
App.actions['inv.edit'] = (el) => productForm(el.getAttribute('data-id'));
App.actions['inv.delete'] = (el) => {
  const p = productById(el.getAttribute('data-id'));
  if (!p) return;
  confirmDialog({
    title: 'Delete ' + p.name + '?',
    body: 'This removes the product from inventory and from the AI catalogue. Past sales keep their record.',
    ok: 'Delete product', danger: true,
    async onOk(){
      try {
        await API.deleteProduct(p.id);
        await API.loadAll();
        toast('Product deleted'); render();
      } catch (err) { toast(err.message, 'error'); }
    }
  });
};
App.actions['inv.restock'] = (el) => {
  const p = productById(el.getAttribute('data-id'));
  if (!p) return;
  openModal({
    title: 'Restock ' + p.name,
    sub: 'Currently ' + p.qty + ' in stock · threshold ' + (p.lowStock||3),
    body: '<div class="form-grid">' +
      '<div class="field span-2"><label class="field-label" for="rs-qty">Units received</label>' +
      '<input class="input" id="rs-qty" type="number" min="1" value="6"></div>' +
      '<div class="field span-2"><label class="field-label" for="rs-cost">New cost price (optional)</label>' +
      '<input class="input" id="rs-cost" type="number" min="0" placeholder="Keep ' + p.cost + '"></div>' +
      '</div>',
    footer: '<button class="btn btn--secondary" data-close-modal>Cancel</button><button class="btn btn--primary" id="rs-save">Add stock</button>',
    onMount(root){
      root.querySelector('#rs-save').addEventListener('click', async () => {
        const n = Number(root.querySelector('#rs-qty').value);
        if (!n || n < 1){ toast('Enter the number received', 'error'); return; }
        const before = p.qty;
        const nc = Number(root.querySelector('#rs-cost').value);
        try {
          await API.restock(p.id, before + n, nc);
          await API.loadAll();
          closeModal(); toast(n + ' units added to ' + p.name); render();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });
};

/* ---------- CSV import / export ---------- */
App.actions['inv.export'] = () => {
  const isAdmin = App.state.role === 'admin';
  const headers = ['id','name','category','size','colour','grade','selling_price','quantity','low_stock'].concat(isAdmin ? ['cost_price'] : []);
  const rows = SEED.products.map(p => [p.id, p.name, p.category, p.size, p.colour, p.grade, p.price, p.qty, p.lowStock].concat(isAdmin ? [p.cost] : []));
  downloadFile('adeola-inventory.csv', toCSV(headers, rows));
  logActivity('Exported inventory', SEED.products.length + ' products to CSV', 'inventory');
};

App.actions['inv.import'] = () => {
  openModal({
    title: 'Import products from Excel or CSV',
    sub: 'Use the same columns as your spreadsheet',
    size: 'wide',
    body:
      '<div class="banner banner--accent" style="margin-bottom:14px">' + icon('info') +
        '<span><strong>Expected columns:</strong> name, category, size, colour, grade, cost_price, selling_price, quantity, low_stock. Only <b>name</b> and <b>selling_price</b> are required. Extra columns are ignored.</span></div>' +
      '<div class="field" style="margin-bottom:12px"><label class="field-label" for="im-file">Choose a .csv file</label>' +
        '<input class="input" type="file" id="im-file" accept=".csv,text/csv"></div>' +
      '<div class="field"><label class="field-label" for="im-text">…or paste rows here</label>' +
        '<textarea class="textarea" id="im-text" rows="6" placeholder="name,category,size,colour,grade,cost_price,selling_price,quantity&#10;Kente Shift Dress,Dresses,M,Multi,Grade A,16000,36000,4"></textarea></div>' +
      '<div id="im-preview" style="margin-top:12px"></div>',
    footer: '<button class="btn btn--secondary" id="im-template">Download template</button>' +
      '<button class="btn btn--secondary" data-close-modal>Cancel</button>' +
      '<button class="btn btn--primary" id="im-run">Import products</button>',
    onMount(root){
      const fileEl = root.querySelector('#im-file');
      const textEl = root.querySelector('#im-text');
      const preview = root.querySelector('#im-preview');
      fileEl.addEventListener('change', () => {
        const f = fileEl.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => { textEl.value = String(reader.result); previewImport(); };
        reader.readAsText(f);
      });
      const previewImport = () => {
        const parsed = parseCSV(textEl.value);
        if (!parsed.rows.length){ preview.innerHTML = '<p class="small muted">Nothing to import yet.</p>'; return; }
        const idx = (n) => parsed.headers.findIndex(h => h.toLowerCase().replace(/[\s_]/g,'') === n);
        const cols = { name: idx('name'), price: idx('sellingprice') > -1 ? idx('sellingprice') : idx('price'), category: idx('category'), size: idx('size'), colour: idx('colour') > -1 ? idx('colour') : idx('color'), grade: idx('grade') > -1 ? idx('grade') : idx('quality'), cost: idx('costprice'), qty: idx('quantity') > -1 ? idx('quantity') : idx('qty') };
        preview.innerHTML = '<div class="table-wrap" style="max-height:180px;border:1px solid var(--line);border-radius:8px">' +
          '<table class="table"><thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Qty</th></tr></thead><tbody>' +
          parsed.rows.slice(0,5).map(r => '<tr><td>' + esc(r[cols.name] || '—') + '</td><td class="small">' + esc(r[cols.category] || 'Uncategorised') + '</td><td class="num">' + (r[cols.price] ? money(Number(r[cols.price])) : '—') + '</td><td class="num">' + esc(r[cols.qty] || '0') + '</td></tr>').join('') +
          '</tbody></table></div><p class="hint">' + parsed.rows.length + ' rows ready to import. First 5 shown.</p>';
      };
      textEl.addEventListener('input', previewImport);
      root.querySelector('#im-template').addEventListener('click', () => {
        downloadFile('adeola-import-template.csv',
          toCSV(['name','category','size','colour','grade','cost_price','selling_price','quantity','low_stock'],
            [['Kente Shift Dress','Dresses','M','Multi','Grade A','16000','36000','4','2']]));
      });
      root.querySelector('#im-run').addEventListener('click', () => {
        const parsed = parseCSV(textEl.value);
        if (!parsed.rows.length){ toast('Paste rows or choose a file first', 'error'); return; }
        const find = (n) => parsed.headers.findIndex(h => h.toLowerCase().replace(/[\s_]/g,'') === n);
        const nameI = find('name');
        const priceI = find('sellingprice') > -1 ? find('sellingprice') : find('price');
        if (nameI < 0 || priceI < 0){ toast('A name and selling_price column are required', 'error'); return; }
        let added = 0, skipped = 0;
        parsed.rows.forEach(r => {
          const name = (r[nameI] || '').trim();
          const price = Number(String(r[priceI] || '').replace(/[^\d.]/g,''));
          if (!name || !price){ skipped++; return; }
          const catI = find('category'), sizeI = find('size'), colI = find('colour') > -1 ? find('colour') : find('color');
          const gradeI = find('grade') > -1 ? find('grade') : find('quality');
          const costI = find('costprice'), qtyI = find('quantity') > -1 ? find('quantity') : find('qty');
          const lowI = find('lowstock');
          const p = {
            id: 'p' + String(SEED.products.length + 1 + added).padStart(2,'0'),
            name, category: (r[catI] || 'Uncategorised').trim(), size: (r[sizeI] || 'One size').trim(),
            colour: (r[colI] || '—').trim(), grade: (r[gradeI] || 'Grade A').trim(),
            cost: Number(r[costI]) || 0, price, qty: Number(r[qtyI]) || 0,
            lowStock: Number(r[lowI]) || 3, photo:'', notes:'Imported from spreadsheet'
          };
          p.status = Calc.productStatus(p);
          SEED.products.unshift(p);
          added++;
        });
        logActivity('Imported inventory', added + ' products added, ' + skipped + ' skipped', 'inventory');
        closeModal();
        toast(added + ' products imported' + (skipped ? ' · ' + skipped + ' skipped' : ''));
        render();
      });
    }
  });
};

/* ================= SALES ================= */
function filteredSales(){
  const s = App.state.sales;
  let list = SEED.sales.slice();
  if (s.q){
    const q = s.q.toLowerCase();
    list = list.filter(sale => {
      const c = customerById(sale.customerId);
      return (sale.id + ' ' + (c ? c.name + ' ' + c.phone : '') + ' ' + sale.items.map(i=>i.name).join(' ')).toLowerCase().indexOf(q) > -1;
    });
  }
  if (s.status !== 'all') list = list.filter(sale => Calc.status(sale) === s.status);
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - Number(s.period));
  list = list.filter(sale => new Date(sale.date) >= cutoff);
  const key = s.sort;
  list.sort((a,b) => {
    let av, bv;
    if (key === 'total'){ av = Calc.total(a); bv = Calc.total(b); }
    else if (key === 'balance'){ av = Calc.balance(a); bv = Calc.balance(b); }
    else if (key === 'customer'){ av = (customerById(a.customerId)||{}).name || ''; bv = (customerById(b.customerId)||{}).name || ''; }
    else { av = a.date; bv = b.date; }
    if (typeof av === 'string') return av.localeCompare(bv) * s.dir;
    return (av - bv) * s.dir;
  });
  return list;
}

function viewSales(){
  const s = App.state.sales;
  const isAdmin = App.state.role === 'admin';
  const list = filteredSales();
  const revenue = sum(list, x => Calc.total(x));
  const collected = sum(list, x => Number(x.paid)||0);
  const owed = sum(list, x => Calc.balance(x));
  const profit = sum(list, x => Calc.profit(x) || 0);
  const profitUnknown = list.filter(x => Calc.profit(x) === null).length;

  const rows = list.map(sale => {
    const c = customerById(sale.customerId);
    const st = Calc.status(sale);
    const staff = staffById(sale.staffId);
    const itemLabel = sale.items.length === 1
      ? sale.items[0].name + (sale.items[0].qty > 1 ? ' ×' + sale.items[0].qty : '')
      : sale.items.length + ' items';
    return '<tr>' +
      '<td><span class="mono">' + esc(sale.id) + '</span></td>' +
      '<td class="small">' + fmtDate(sale.date) + '</td>' +
      '<td><div class="cell">' + UI.avatar(c ? c.name : '?', null, 'sm') +
        '<div class="cell__text"><strong>' + esc(c ? c.name : 'Walk-in') + '</strong><span>' + esc(c ? c.phone : '—') + '</span></div></div></td>' +
      '<td class="small">' + esc(itemLabel) + '</td>' +
      '<td class="num"><b class="strong">' + money(Calc.total(sale)) + '</b>' + (sale.discount ? '<div class="tiny muted">−' + money(sale.discount) + ' disc.</div>' : '') + '</td>' +
      '<td class="num">' + money(sale.paid) + '</td>' +
      '<td class="num" style="' + (Calc.balance(sale) > 0 ? 'color:var(--danger);font-weight:500' : 'color:var(--muted)') + '">' + money(Calc.balance(sale)) + '</td>' +
      '<td>' + UI.statusChip(st) + '</td>' +
      '<td class="small muted">' + esc(staff.name.split(' ')[0]) + (sale.aiAssisted ? ' <span class="chip chip--accent" style="height:17px;font-size:9.5px">AI</span>' : '') + '</td>' +
      '<td><div class="row-actions">' +
        '<button class="icon-btn" title="View receipt" data-action="sale.view" data-id="' + sale.id + '">' + icon('file') + '</button>' +
        (Calc.balance(sale) > 0 ? '<button class="icon-btn" title="Record payment" data-action="sale.pay" data-id="' + sale.id + '">' + icon('wallet') + '</button>' : '') +
        (App.state.role === 'admin' ? '<button class="icon-btn" title="Delete" data-action="sale.delete" data-id="' + sale.id + '">' + icon('trash') + '</button>' : '') +
      '</div></td>' +
    '</tr>';
  }).join('');

  const periodOpts = [['7','Last 7 days'],['30','Last 30 days'],['90','Last 90 days'],['365','Last year']].map(o =>
    '<option value="' + o[0] + '"' + (s.period === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('');
  const statusOpts = [['all','All payments'],['paid','Paid in full'],['part','Part paid'],['unpaid','Unpaid']].map(o =>
    '<option value="' + o[0] + '"' + (s.status === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('');

  return '<div>' +
    UI.pageHead('Sales & payments',
      'Every sale, part payment and balance. The same formulas as your spreadsheet, shown in plain language.',
      '<button class="btn btn--secondary" data-action="sales.how">' + icon('help') + 'How this is calculated</button>' +
      '<button class="btn btn--secondary" data-action="sales.export">' + icon('download') + 'Export</button>' +
      '<button class="btn btn--primary" data-action="sale.new">' + icon('plus') + 'Record sale</button>') +

    '<div class="statstrip" style="margin-bottom:16px">' +
      UI.kpi('Sales value', money(revenue), '<span>' + list.length + ' sales in period</span>', 'receipt') +
      UI.kpi('Collected', money(collected), '<span>' + (revenue ? Math.round((collected/revenue)*100) : 0) + '% of sales value</span>', 'wallet') +
      UI.kpi('Outstanding', money(owed), '<span>balances still owed</span>', 'clock') +
      (isAdmin ? (profitUnknown
              ? UI.kpi('Gross profit', 'Unknown', '<span>add cost prices to see profit</span>', 'chart')
              : UI.kpi('Gross profit', money(profit), '<span>after cost of goods</span>', 'chart'))
              : UI.kpi('Average sale', money(list.length ? revenue/list.length : 0), '<span>per recorded sale</span>', 'chart')) +
    '</div>' +

    '<div class="card">' +
      '<div class="card__body" style="padding:12px 14px 0"><div class="toolbar">' +
        '<label class="search">' + icon('search') +
          '<input class="input" type="search" placeholder="Invoice, customer, item…" value="' + esc(s.q) + '" data-input="sales.search">' +
        '</label>' +
        '<select class="select" data-input="sales.period">' + periodOpts + '</select>' +
        '<select class="select" data-input="sales.status">' + statusOpts + '</select>' +
        '<span class="toolbar__spacer"></span>' +
        '<span class="small muted">' + money(revenue) + ' total</span>' +
      '</div></div>' +
      '<div class="table-wrap"><table class="table">' +
        '<thead><tr>' +
          UI.sortTh('Invoice', 'id', s, 'sales.sort') +
          UI.sortTh('Date', 'date', s, 'sales.sort') +
          UI.sortTh('Customer', 'customer', s, 'sales.sort') +
          '<th>Items</th>' +
          UI.sortTh('Total', 'total', s, 'sales.sort', true) +
          '<th class="num">Paid</th>' +
          UI.sortTh('Balance', 'balance', s, 'sales.sort', true) +
          '<th>Status</th><th>Recorded by</th><th class="num">Actions</th>' +
        '</tr></thead>' +
        '<tbody>' + (rows || '') + '</tbody>' +
        (list.length ? '<tfoot><tr>' +
          '<td colspan="4">' + list.length + ' sales</td>' +
          '<td class="num">' + money(revenue) + '</td>' +
          '<td class="num">' + money(collected) + '</td>' +
          '<td class="num">' + money(owed) + '</td>' +
          '<td colspan="3"></td>' +
        '</tr></tfoot>' : '') +
      '</table></div>' +
      (!list.length ? UI.empty('receipt', 'No sales in this period', 'Change the date range or record your first sale.', '<button class="btn btn--primary btn--sm" data-action="sale.new">Record sale</button>') : '') +
      '<div class="table-note"><span>Balances update when you record a payment — never automatically by the assistant.</span>' +
      '<span>Total = subtotal − discount · Balance = total − paid</span></div>' +
    '</div>' +
  '</div>';
}

App.actions['sales.search'] = (el) => { App.state.sales.q = el.value; renderKeepFocus('sales.search'); };
App.actions['sales.period'] = (el) => { App.state.sales.period = el.value; render(); };
App.actions['sales.status'] = (el) => { App.state.sales.status = el.value; render(); };
App.actions['sales.sort'] = (el) => {
  const key = el.getAttribute('data-key');
  const s = App.state.sales;
  if (s.sort === key) s.dir = -s.dir; else { s.sort = key; s.dir = key === 'date' ? -1 : 1; }
  render();
};

App.actions['sales.how'] = () => {
  openModal({
    title: 'How the numbers are calculated',
    sub: 'The same rules as your Excel sheet, in plain language',
    size: 'wide',
    body:
      '<div class="stack">' +
        '<div class="calc-box"><dl>' +
          '<dt>Line total (each item)</dt><dd>quantity × selling price</dd>' +
          '<dt>Subtotal</dt><dd>sum of all line totals</dd>' +
          '<dt>Discount</dt><dd>amount taken off by staff or owner (never by the AI)</dd>' +
          '<dt class="total">Total to pay</dt><dd class="total">subtotal − discount</dd>' +
          '<dt>Balance owing</dt><dd>total to pay − amount paid</dd>' +
          '<dt>Cost of goods (COGS)</dt><dd>sum of quantity × cost price at the time of sale</dd>' +
          '<dt class="total">Gross profit</dt><dd class="total">total to pay − cost of goods</dd>' +
        '</dl></div>' +
        '<div class="grid-2">' +
          '<div><p class="eyebrow" style="margin-bottom:6px">Stock</p><p class="small" style="color:var(--ink-2);line-height:1.6">' +
            'Quantity in stock goes down by the number sold the moment a sale is recorded. It goes up only through <b>Add product</b> or <b>Restock</b>. ' +
            'The assistant reads this same number, so it cannot promise an item the shop does not have.</p></div>' +
          '<div><p class="eyebrow" style="margin-bottom:6px">Reports</p><p class="small" style="color:var(--ink-2);line-height:1.6">' +
            'Revenue in reports is always <b>total to pay after discounts</b>, not the amount collected. That way part payments do not make a good month look bad — ' +
            'collected cash and outstanding balances are shown separately.</p></div>' +
        '</div>' +
        '<div class="banner">' + icon('info') + '<span><strong>Excel mapping:</strong> Subtotal → <span class="mono">=SUM(F2:F10)</span>, ' +
          'Total → <span class="mono">=Subtotal-Discount</span>, Balance → <span class="mono">=Total-Paid</span>, ' +
          'Profit → <span class="mono">=Total-(Qty*Cost)</span>. These are implemented once in <span class="mono">Calc</span> and reused by every screen, receipt and export.</span></div>' +
        '<div class="banner banner--warn">' + icon('alert') + '<span><strong>Demo history note:</strong> the seeded sales history is already reflected in the opening stock figures. ' +
          'Only sales you record in this preview reduce stock further, so the demo never drifts into negative inventory.</span></div>' +
      '</div>',
    footer: '<button class="btn btn--primary" data-close-modal>Got it</button>'
  });
};

/* ---------- record sale ---------- */
function saleForm(){
  const isAdmin = App.state.role === 'admin';
  const available = SEED.products.filter(p => p.qty > 0);
  const customerOpts = ['<option value="">Walk-in customer</option>']
    .concat(SEED.customers.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(c => '<option value="' + c.id + '">' + esc(c.name) + ' · ' + esc(c.phone) + '</option>'))
    .join('');

  const itemRow = (id) =>
    '<div class="sale-item" data-row style="display:grid;grid-template-columns:1fr 70px 100px 28px;gap:8px;align-items:center;margin-bottom:8px">' +
      '<select class="select" data-item-product aria-label="Product">' +
        '<option value="">Choose product…</option>' +
        available.map(p => '<option value="' + p.id + '">' + esc(p.name) + ' · ' + esc(p.size) + ' · ' + money(p.price) + ' (' + p.qty + ')</option>').join('') +
      '</select>' +
      '<input class="input" type="number" min="1" value="1" data-item-qty aria-label="Quantity">' +
      '<input class="input" value="" data-item-line readonly aria-label="Line total" placeholder="—" style="text-align:right">' +
      '<button class="icon-btn" data-item-remove aria-label="Remove line">' + icon('trash') + '</button>' +
    '</div>';

  openModal({
    title: 'Record a sale',
    sub: 'Stock reduces as soon as you save',
    size: 'wide',
    body:
      '<div class="form-grid">' +
        '<div class="form-section-label">Customer</div>' +
        '<div class="field span-2"><label class="field-label" for="sf-customer">Customer</label>' +
          '<select class="select" id="sf-customer">' + customerOpts + '</select>' +
          '<span class="field-note">Choose a saved customer so the purchase appears in their history. Leave blank for a walk-in.</span></div>' +
        '<div class="field span-2" id="sf-newcustomer">' +
          '<div class="form-grid" style="gap:10px">' +
            '<div class="field"><label class="field-label" for="sf-name">Full name</label><input class="input" id="sf-name" placeholder="Customer name"></div>' +
            '<div class="field"><label class="field-label" for="sf-phone">WhatsApp number</label><input class="input" id="sf-phone" placeholder="0803 000 0000"></div>' +
          '</div>' +
          '<span class="field-note">A new contact is created in the customer book and can never be lost when a phone is banned.</span>' +
        '</div>' +

        '<div class="form-section-label">Items</div>' +
        '<div class="span-2" id="sf-items">' + itemRow(1) + '</div>' +
        '<div class="span-2"><button class="btn btn--secondary btn--sm" id="sf-addline">' + icon('plus') + 'Add another item</button></div>' +

        '<div class="form-section-label">Payment</div>' +
        '<div class="field"><label class="field-label" for="sf-discount">Discount (₦)' + (isAdmin ? '' : ' — owner only') + '</label>' +
          '<input class="input" id="sf-discount" type="number" min="0" step="100" value="0" ' + (isAdmin ? '' : 'disabled') + '>' +
          '<span class="field-note">' + (isAdmin ? 'Comes off the total. Shown on the receipt.' : 'Staff cannot apply discounts. Ask the owner.') + '</span></div>' +
        '<div class="field"><label class="field-label" for="sf-paid">Amount paid now (₦)</label>' +
          '<input class="input" id="sf-paid" type="number" min="0" step="100" value="0">' +
          '<span class="field-note">Leave as total for a full payment, or part-pay and track the balance.</span></div>' +
        '<div class="field"><label class="field-label" for="sf-method">Payment method</label>' +
          '<select class="select" id="sf-method"><option>Bank transfer</option><option>POS</option><option>Cash</option><option>Payment link (later phase)</option></select></div>' +
        '<div class="field"><label class="field-label" for="sf-date">Sale date</label>' +
          '<input class="input" id="sf-date" type="date" value="' + new Date().toISOString().slice(0,10) + '"></div>' +

        '<div class="span-2 calc-box" id="sf-calc"></div>' +
      '</div>',
    footer: '<span class="left" id="sf-stockhint"></span>' +
      '<button class="btn btn--secondary" data-close-modal>Cancel</button>' +
      '<button class="btn btn--primary" id="sf-save">Save sale</button>',
    onMount(root){
      const itemsWrap = root.querySelector('#sf-items');
      const custSel = root.querySelector('#sf-customer');
      const discEl = root.querySelector('#sf-discount');
      const paidEl = root.querySelector('#sf-paid');

      const readItems = () => {
        return Array.from(itemsWrap.querySelectorAll('[data-row]')).map(row => {
          const pid = row.querySelector('[data-item-product]').value;
          const qty = Number(row.querySelector('[data-item-qty]').value) || 0;
          const p = productById(pid);
          return p ? { p, qty, line: p.price * qty } : null;
        }).filter(Boolean);
      };
      const recalc = () => {
        const items = readItems();
        const subtotal = sum(items, i => i.line);
        const discount = Math.min(Number(discEl.value) || 0, subtotal);
        const total = subtotal - discount;
        const cogs = sum(items, i => i.qty * i.p.cost);
        const paid = Number(paidEl.value) || 0;
        const balance = Math.max(0, total - paid);
        root.querySelector('#sf-calc').innerHTML =
          '<dl>' +
            '<dt>Subtotal (' + items.length + ' line' + (items.length===1?'':'s') + ')</dt><dd>' + money(subtotal) + '</dd>' +
            '<dt>Discount</dt><dd>− ' + money(discount) + '</dd>' +
            '<dt class="total">Total to pay</dt><dd class="total">' + money(total) + '</dd>' +
            '<dt>Paid now</dt><dd>' + money(paid) + '</dd>' +
            '<dt>Balance owing</dt><dd>' + money(balance) + '</dd>' +
            (isAdmin ? '<dt>Gross profit</dt><dd>' + money(total - cogs) + '</dd><dt>Margin</dt><dd>' + pct(total ? ((total-cogs)/total)*100 : 0, 1) + '</dd>' : '') +
          '</dl>';
        const hint = root.querySelector('#sf-stockhint');
        if (items.length){
          hint.innerHTML = money(total) + ' · ' + money(balance) + ' balance';
        } else hint.innerHTML = '';
        itemsWrap.querySelectorAll('[data-row]').forEach(row => {
          const pid = row.querySelector('[data-item-product]').value;
          const p = productById(pid);
          const qty = Number(row.querySelector('[data-item-qty]').value) || 0;
          row.querySelector('[data-item-line]').value = p ? money(p.price * qty) : '';
          row.querySelector('[data-item-qty]').max = p ? p.qty : 99;
          if (p && qty > p.qty){
            row.querySelector('[data-item-qty]').style.borderColor = 'var(--danger)';
          } else {
            row.querySelector('[data-item-qty]').style.borderColor = '';
          }
        });
        paidEl.max = total;
      };
      const bindRow = (row) => {
        row.querySelector('[data-item-product]').addEventListener('change', recalc);
        row.querySelector('[data-item-qty]').addEventListener('input', recalc);
        row.querySelector('[data-item-remove]').addEventListener('click', () => {
          if (itemsWrap.querySelectorAll('[data-row]').length > 1){ row.remove(); recalc(); }
          else toast('A sale needs at least one item', 'error');
        });
      };
      itemsWrap.querySelectorAll('[data-row]').forEach(bindRow);
      root.querySelector('#sf-addline').addEventListener('click', () => {
        const div = document.createElement('div');
        div.innerHTML = itemRow();
        const row = div.firstChild;
        itemsWrap.appendChild(row);
        bindRow(row); recalc();
      });
      custSel.addEventListener('change', () => {
        root.querySelector('#sf-newcustomer').hidden = !!custSel.value;
      });
      discEl.addEventListener('input', recalc);
      paidEl.addEventListener('input', recalc);
      recalc();

      root.querySelector('#sf-save').addEventListener('click', async () => {
        const items = readItems();
        if (!items.length){ toast('Choose at least one product', 'error'); return; }
        const short = items.find(i => i.qty > i.p.qty);
        if (short){ toast('Only ' + short.p.qty + ' of ' + short.p.name + ' in stock', 'error'); return; }
        if (items.some(i => i.qty <= 0)){ toast('Quantity must be at least 1', 'error'); return; }
        if (!isAdmin && Number(discEl.value) > 0){ toast('Only the owner can apply a discount', 'error'); return; }

        let customerId = custSel.value || null;
        let newName = null, newPhone = null;
        if (!customerId){
          const nm = root.querySelector('#sf-name').value.trim();
          const ph = root.querySelector('#sf-phone').value.trim();
          if (nm || ph){
            if (!nm || !ph){ toast('Enter both name and phone, or neither', 'error'); return; }
            newName = nm; newPhone = ph;
          }
        }

        const subtotal = sum(items, i => i.line);
        const discount = Math.min(Number(discEl.value) || 0, subtotal);
        const total = subtotal - discount;
        let paid = Number(paidEl.value) || 0;
        if (paid > total) paid = total;

        const payload = {
          items: items.map(i => ({ product_id: i.p.id, qty: i.qty })),
          discount,
          payments: paid > 0 ? [{ amount: paid, method: root.querySelector('#sf-method').value }] : [],
          channel: 'counter',
          note: '',
        };
        if (customerId) payload.customer_id = customerId;
        else if (newName && newPhone){ payload.customer_name = newName; payload.customer_phone = newPhone; }

        const saveBtn = root.querySelector('#sf-save');
        saveBtn.disabled = true;
        try {
          const out = await API.createSale(payload);
          await API.loadAll();
          closeModal();
          toast('Sale ' + out.sale.invoice_no + ' recorded · ' + money(total));
          App.state.route = 'sales';
          render();
          setTimeout(() => receiptModal(out.sale.invoice_no), 150);
        } catch (err) {
          toast(err.message, 'error');
          saveBtn.disabled = false;
        }
      });
    }
  });
}
App.actions['sale.new'] = () => saleForm();

/* ---------- receipt ---------- */
function receiptHTML(sale){
  const c = customerById(sale.customerId);
  const lines = sale.items.map(it =>
    '<tr><td style="padding:5px 0">' + esc(it.name) + '<div class="small muted">' + it.qty + ' × ' + money(it.unitPrice) + '</div></td>' +
    '<td style="text-align:right;padding:5px 0;vertical-align:top">' + money(it.qty * it.unitPrice) + '</td></tr>').join('');
  return '<div style="font-family:Geist,Helvetica,Arial,sans-serif;color:#191A15;max-width:420px;margin:0 auto">' +
    '<div style="text-align:center;padding-bottom:12px;border-bottom:1px solid #ddd">' +
      '<div style="font-size:16px;font-weight:600;letter-spacing:-.02em">' + esc(SEED.business.name) + '</div>' +
      '<div style="font-size:10px;color:#666;letter-spacing:.08em;text-transform:uppercase;margin-top:2px">' + esc(SEED.business.tagline) + '</div>' +
      '<div style="font-size:11px;color:#666;margin-top:6px">' + esc(SEED.business.address) + '<br>' + esc(SEED.business.phone) + '</div>' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;font-size:11px;padding:10px 0;color:#555">' +
      '<span>Receipt <b style="color:#191A15">' + esc(sale.id) + '</b></span><span>' + fmtDate(sale.date) + '</span>' +
    '</div>' +
    '<div style="font-size:11px;color:#555;padding-bottom:8px">Customer: <b style="color:#191A15">' + esc(c ? c.name : 'Walk-in customer') + '</b>' + (c ? ' · ' + esc(c.phone) : '') + '</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:12px;border-top:1px solid #ddd">' + lines + '</table>' +
    '<div style="border-top:1px solid #ddd;margin-top:6px;padding-top:8px;font-size:12px">' +
      '<div style="display:flex;justify-content:space-between;padding:2px 0;color:#555"><span>Subtotal</span><span>' + money(Calc.subtotal(sale)) + '</span></div>' +
      (sale.discount ? '<div style="display:flex;justify-content:space-between;padding:2px 0;color:#555"><span>Discount</span><span>− ' + money(sale.discount) + '</span></div>' : '') +
      '<div style="display:flex;justify-content:space-between;padding:5px 0;font-weight:600;font-size:13px;border-top:1px solid #eee;margin-top:3px"><span>Total</span><span>' + money(Calc.total(sale)) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;padding:2px 0;color:#555"><span>Paid (' + esc(sale.paid > 0 ? (sale.method && sale.method !== '—' ? sale.method : 'transfer') : 'no payment yet') + ')</span><span>' + money(sale.paid) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:600"><span>Balance</span><span>' + money(Calc.balance(sale)) + '</span></div>' +
    '</div>' +
    '<div style="text-align:center;font-size:10px;color:#888;margin-top:16px;line-height:1.5">' +
      'Thank you for shopping with us.<br>' + esc(SEED.business.returns) + '<br>' +
      'Recorded by ' + esc(staffById(sale.staffId).name) + (sale.aiAssisted ? ' · started by the virtual assistant' : '') +
    '</div>' +
  '</div>';
}

function receiptModal(id){
  const sale = SEED.sales.find(s => s.id === id);
  if (!sale) return;
  openModal({
    title: 'Receipt ' + sale.id,
    sub: fmtDate(sale.date) + ' · ' + esc((customerById(sale.customerId) || {}).name || 'Walk-in'),
    body: '<div style="border:1px solid var(--line);border-radius:10px;padding:18px;background:#ffffff">' + receiptHTML(sale) + '</div>',
    footer: '<button class="btn btn--secondary" id="rc-copy">' + icon('copy') + 'Copy text</button>' +
      '<button class="btn btn--secondary" id="rc-print">' + icon('printer') + 'Print</button>' +
      (Calc.balance(sale) > 0 ? '<button class="btn btn--primary" id="rc-pay">Record payment</button>' : '<button class="btn btn--primary" data-close-modal>Done</button>'),
    onMount(root){
      root.querySelector('#rc-print').addEventListener('click', () => {
        const w = window.open('', '_blank', 'width=520,height=720');
        if (!w){ toast('Allow pop-ups to print', 'error'); return; }
        w.document.write('<html><head><title>Receipt ' + esc(sale.id) + '</title></head><body style="padding:20px">' + receiptHTML(sale) + '</body></html>');
        w.document.close();
        setTimeout(() => { w.focus(); w.print(); }, 250);
      });
      root.querySelector('#rc-copy').addEventListener('click', () => {
        const text = SEED.business.name + '\nReceipt ' + sale.id + ' · ' + fmtDate(sale.date) + '\n' +
          sale.items.map(i => i.qty + ' × ' + i.name + ' — ' + money(i.qty * i.unitPrice)).join('\n') +
          '\nTotal ' + money(Calc.total(sale)) + ' · Paid ' + money(sale.paid) + ' · Balance ' + money(Calc.balance(sale));
        navigator.clipboard && navigator.clipboard.writeText(text).then(() => toast('Receipt copied — paste it into WhatsApp'));
        toast('Receipt copied');
      });
      const payBtn = root.querySelector('#rc-pay');
      if (payBtn) payBtn.addEventListener('click', () => { closeModal(); setTimeout(() => paymentModal(sale.id), 100); });
    }
  });
}
App.actions['sale.view'] = (el) => receiptModal(el.getAttribute('data-id'));

function paymentModal(id){
  const sale = SEED.sales.find(s => s.id === id);
  if (!sale) return;
  const bal = Calc.balance(sale);
  openModal({
    title: 'Record payment',
    sub: sale.id + ' · balance ' + money(bal),
    size: 'narrow',
    body: '<div class="calc-box" style="margin-bottom:14px"><dl>' +
      '<dt>Total</dt><dd>' + money(Calc.total(sale)) + '</dd>' +
      '<dt>Already paid</dt><dd>' + money(sale.paid) + '</dd>' +
      '<dt class="total">Balance</dt><dd class="total">' + money(bal) + '</dd>' +
    '</dl></div>' +
    '<div class="field"><label class="field-label" for="pay-amt">Amount received (₦)</label>' +
    '<input class="input" id="pay-amt" type="number" min="1" max="' + bal + '" value="' + bal + '"></div>' +
    '<p class="hint">Only staff or the owner can confirm a payment. The assistant never does.</p>',
    footer: '<button class="btn btn--secondary" data-close-modal>Cancel</button><button class="btn btn--primary" id="pay-save">Record payment</button>',
    onMount(root){
      root.querySelector('#pay-save').addEventListener('click', async () => {
        const amt = Number(root.querySelector('#pay-amt').value);
        if (!amt || amt <= 0){ toast('Enter an amount', 'error'); return; }
        if (amt > bal){ toast('That is more than the balance of ' + money(bal), 'error'); return; }
        try {
          await API.addPayment(sale.dbId || sale.id, amt, sale.method === '—' ? 'transfer' : sale.method);
          await API.loadAll();
          closeModal(); toast('Payment of ' + money(amt) + ' recorded'); render();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });
}
App.actions['sale.pay'] = (el) => paymentModal(el.getAttribute('data-id'));

App.actions['sale.delete'] = (el) => {
  const sale = SEED.sales.find(s => s.id === el.getAttribute('data-id'));
  if (!sale) return;
  confirmDialog({
    title: 'Delete ' + sale.id + '?',
    body: 'This removes the sale from reports. Stock is not automatically returned — restock the items separately if needed.',
    ok: 'Delete sale', danger: true,
    async onOk(){
      try {
        await API.deleteSale(sale.dbId || sale.id);
        await API.loadAll();
        toast('Sale deleted'); render();
      } catch (err) { toast(err.message, 'error'); }
    }
  });
};

App.actions['sales.export'] = () => {
  const list = filteredSales();
  const headers = ['invoice','date','customer','phone','items','subtotal','discount','total','paid','balance','status','method','recorded_by','ai_assisted'];
  const rows = list.map(s => {
    const c = customerById(s.customerId);
    return [s.id, s.date, c ? c.name : 'Walk-in', c ? c.phone : '', s.items.map(i => i.qty + 'x ' + i.name).join('; '),
      Calc.subtotal(s), Calc.discount(s), Calc.total(s), s.paid, Calc.balance(s), Calc.status(s), s.method, staffById(s.staffId).name, s.aiAssisted ? 'yes' : 'no'];
  });
  downloadFile('adeola-sales.csv', toCSV(headers, rows));
  logActivity('Exported sales', rows.length + ' sales to CSV', 'sale');
};
