/* ============================================================
   Views part B — Customers, Inbox, AI console, Reports,
   Activity log, Settings
   ============================================================ */
'use strict';

/* ================= CUSTOMERS ================= */
function filteredCustomers(){
  const s = App.state.cust;
  let list = SEED.customers.slice();
  if (s.q){
    const q = s.q.toLowerCase();
    list = list.filter(c => (c.name + ' ' + c.phone + ' ' + c.location + ' ' + (c.tags||[]).join(' ') + ' ' + (c.notes||'')).toLowerCase().indexOf(q) > -1);
  }
  if (s.tag !== 'all') list = list.filter(c => (c.tags||[]).indexOf(s.tag) > -1);
  list.sort((a,b) => {
    let av, bv;
    if (s.sort === 'spent'){ av = Calc.customer(a).spent; bv = Calc.customer(b).spent; }
    else if (s.sort === 'orders'){ av = Calc.customer(a).orders; bv = Calc.customer(b).orders; }
    else if (s.sort === 'last'){ av = Calc.customer(a).lastPurchase || ''; bv = Calc.customer(b).lastPurchase || ''; }
    else { av = a.name; bv = b.name; }
    if (typeof av === 'string') return av.localeCompare(bv) * s.dir;
    return (av - bv) * s.dir;
  });
  return list;
}

function viewCustomers(){
  const s = App.state.cust;
  const list = filteredCustomers();
  const totalOwed = sum(SEED.customers, c => Calc.customer(c).owed);
  const vip = SEED.customers.filter(c => (c.tags||[]).indexOf('VIP') > -1).length;
  const wholesale = SEED.customers.filter(c => (c.tags||[]).indexOf('Wholesale') > -1).length;
  const newCut = new Date(); newCut.setDate(newCut.getDate() - 30);
  const fresh = SEED.customers.filter(c => new Date(c.createdAt) >= newCut).length;

  const rows = list.map(c => {
    const st = Calc.customer(c);
    const tags = (c.tags||[]).map(t => '<span class="chip ' + (t === 'VIP' ? 'chip--gold' : t === 'Wholesale' ? 'chip--info' : 'chip--line') + '">' + esc(t) + '</span>').join(' ');
    return '<tr>' +
      '<td><div class="cell">' + UI.avatar(c.name) +
        '<div class="cell__text"><strong>' + esc(c.name) + '</strong><span>' + esc(c.phone) + '</span></div></div></td>' +
      '<td class="small">' + esc(c.location) + '</td>' +
      '<td><div class="pill-row">' + tags + '</div></td>' +
      '<td class="num">' + st.orders + '</td>' +
      '<td class="num"><b class="strong">' + money(st.spent) + '</b></td>' +
      '<td class="num" style="' + (st.owed ? 'color:var(--danger);font-weight:500' : 'color:var(--faint)') + '">' + (st.owed ? money(st.owed) : '—') + '</td>' +
      '<td class="small muted">' + (st.lastPurchase ? fmtDate(st.lastPurchase) : 'Never') + '</td>' +
      '<td><div class="row-actions">' +
        '<button class="icon-btn" title="Open profile" data-action="cust.view" data-id="' + c.id + '">' + icon('eye') + '</button>' +
        '<button class="icon-btn" title="Edit" data-action="cust.edit" data-id="' + c.id + '">' + icon('edit') + '</button>' +
        '<button class="icon-btn" title="Delete" data-action="cust.delete" data-id="' + c.id + '">' + icon('trash') + '</button>' +
      '</div></td>' +
    '</tr>';
  }).join('');

  const tagOpts = ['all','VIP','Wholesale','Retail'].map(t =>
    '<option value="' + t + '"' + (s.tag === t ? ' selected' : '') + '>' + (t === 'all' ? 'All tags' : t) + '</option>').join('');

  return '<div>' +
    UI.pageHead('Customer book',
      'The contact list that survives a lost or banned phone. Imported, searchable, and backed up separately from WhatsApp.',
      '<button class="btn btn--secondary" data-action="cust.import">' + icon('upload') + 'Import</button>' +
      '<button class="btn btn--secondary" data-action="cust.export">' + icon('download') + 'Export</button>' +
      '<button class="btn btn--secondary" data-action="backup.open">' + icon('shield') + 'Backup</button>' +
      '<button class="btn btn--primary" data-action="cust.new">' + icon('plus') + 'Add customer</button>') +

    '<div class="statstrip" style="margin-bottom:16px">' +
      UI.kpi('Customers', String(SEED.customers.length), '<span>' + fresh + ' new in 30 days</span>', 'users') +
      UI.kpi('VIP', String(vip), '<span>' + wholesale + ' wholesale accounts</span>', 'tag') +
      UI.kpi('Lifetime spent', money(sum(SEED.customers, c => Calc.customer(c).spent)), '<span>payments received</span>', 'wallet') +
      UI.kpi('Owed to you', money(totalOwed), '<span>across all customers</span>', 'clock') +
    '</div>' +

    '<div class="banner banner--accent" style="margin-bottom:14px">' + icon('shield') +
      '<span><strong>Backup:</strong> last automatic backup ' + timeAgo(SEED.settings.backup.lastRun) + ' · ' + SEED.settings.backup.frequency.toLowerCase() + ' at ' + SEED.settings.backup.time +
      '. Numbers, purchase history and notes are stored here — not only inside WhatsApp.</span></div>' +

    '<div class="card">' +
      '<div class="card__body" style="padding:12px 14px 0"><div class="toolbar">' +
        '<label class="search">' + icon('search') +
          '<input class="input" type="search" placeholder="Name, phone, area, note…" value="' + esc(s.q) + '" data-input="cust.search">' +
        '</label>' +
        '<select class="select" data-input="cust.tag">' + tagOpts + '</select>' +
        '<span class="toolbar__spacer"></span>' +
        '<span class="small muted">' + list.length + ' shown</span>' +
      '</div></div>' +
      '<div class="table-wrap"><table class="table">' +
        '<thead><tr>' +
          UI.sortTh('Customer', 'name', s, 'cust.sort') +
          '<th>Area</th><th>Tags</th>' +
          UI.sortTh('Orders', 'orders', s, 'cust.sort', true) +
          UI.sortTh('Total spent', 'spent', s, 'cust.sort', true) +
          '<th class="num">Owing</th>' +
          UI.sortTh('Last purchase', 'last', s, 'cust.sort') +
          '<th class="num">Actions</th>' +
        '</tr></thead>' +
        '<tbody>' + (rows || '') + '</tbody>' +
      '</table></div>' +
      (!list.length ? UI.empty('users', 'No customer matches', 'Try another search, or add the contact now so it is never lost.', '<button class="btn btn--primary btn--sm" data-action="cust.new">Add customer</button>') : '') +
      '<div class="table-note"><span>Total spent counts payments received. Owing counts unpaid balances.</span>' +
      '<span>Open a profile to see the full purchase and conversation history.</span></div>' +
    '</div>' +
  '</div>';
}

App.actions['cust.search'] = (el) => { App.state.cust.q = el.value; renderKeepFocus('cust.search'); };
App.actions['cust.tag'] = (el) => { App.state.cust.tag = el.value; render(); };
App.actions['cust.sort'] = (el) => {
  const key = el.getAttribute('data-key');
  const s = App.state.cust;
  if (s.sort === key) s.dir = -s.dir; else { s.sort = key; s.dir = key === 'name' ? 1 : -1; }
  render();
};

function customerForm(id){
  const c = id ? customerById(id) : null;
  const v = c || { name:'', phone:'', location:'', tags:['Retail'], notes:'' };
  openModal({
    title: c ? 'Edit customer' : 'Add customer',
    sub: c ? 'Saved in the customer book since ' + fmtDate(c.createdAt) : 'A record that does not live inside WhatsApp',
    body:
      '<div class="form-grid">' +
        '<div class="field span-2"><label class="field-label" for="cf-name">Full name</label>' +
          '<input class="input" id="cf-name" value="' + esc(v.name) + '" placeholder="e.g. Chiamaka Obi"></div>' +
        '<div class="field"><label class="field-label" for="cf-phone">WhatsApp number</label>' +
          '<input class="input" id="cf-phone" value="' + esc(v.phone) + '" placeholder="0803 000 0000"></div>' +
        '<div class="field"><label class="field-label" for="cf-loc">Area / city</label>' +
          '<input class="input" id="cf-loc" value="' + esc(v.location) + '" placeholder="e.g. Lekki Phase 1"></div>' +
        '<div class="field span-2"><label class="field-label">Tags</label>' +
          '<div class="pill-row" style="gap:10px">' +
            ['VIP','Wholesale','Retail'].map(t => '<label class="checkline" style="gap:6px"><input type="checkbox" value="' + t + '" class="cf-tag" ' + ((v.tags||[]).indexOf(t) > -1 ? 'checked' : '') + '>' + t + '</label>').join('') +
          '</div>' +
          '<span class="field-note">Wholesale buyers must always be escalated to you for pricing.</span></div>' +
        '<div class="field span-2"><label class="field-label" for="cf-notes">Notes</label>' +
          '<textarea class="textarea" id="cf-notes" rows="3" placeholder="Sizes, preferences, delivery instructions…">' + esc(v.notes) + '</textarea></div>' +
        '<div class="span-2"><label class="checkline"><input type="checkbox" id="cf-consent" checked>' +
          '<span>Customer has been told they are messaging a virtual assistant and can request a human at any time.</span></label></div>' +
      '</div>',
    footer: '<button class="btn btn--secondary" data-close-modal>Cancel</button>' +
      '<button class="btn btn--primary" id="cf-save">' + (c ? 'Save changes' : 'Add customer') + '</button>',
    onMount(root){
      root.querySelector('#cf-save').addEventListener('click', () => {
        const name = root.querySelector('#cf-name').value.trim();
        const phone = root.querySelector('#cf-phone').value.trim();
        if (!name || !phone){ toast('Name and phone number are required', 'error'); return; }
        const dup = SEED.customers.find(x => x.phone.replace(/\s/g,'') === phone.replace(/\s/g,'') && x.id !== (c && c.id));
        if (dup){ toast('That number is already saved as ' + dup.name, 'error'); return; }
        const tags = Array.from(root.querySelectorAll('.cf-tag:checked')).map(x => x.value);
        const data = { name, phone, location: root.querySelector('#cf-loc').value.trim() || 'Not provided',
          tags: tags.length ? tags : ['Retail'], notes: root.querySelector('#cf-notes').value.trim() };
        if (c){
          Object.assign(c, data);
          logActivity('Updated customer ' + c.name, c.phone + ' · ' + c.tags.join(', '), 'customer');
          toast('Customer updated');
        } else {
          SEED.customers.unshift(Object.assign({ id: uid('c'), createdAt: new Date().toISOString().slice(0,10) }, data));
          logActivity('Added customer ' + name, phone + ' · ' + data.tags.join(', '), 'customer');
          toast('Customer saved');
        }
        closeModal(); render();
      });
    }
  });
}
App.actions['cust.new'] = () => customerForm();
App.actions['cust.edit'] = (el) => customerForm(el.getAttribute('data-id'));

App.actions['cust.delete'] = (el) => {
  const c = customerById(el.getAttribute('data-id'));
  if (!c) return;
  confirmDialog({
    title: 'Delete ' + c.name + '?',
    body: 'Their sales history stays in your records, but the contact details and notes are removed. In production this needs owner rights and a reason.',
    ok: 'Delete customer', danger: true,
    onOk(){
      SEED.customers = SEED.customers.filter(x => x.id !== c.id);
      logActivity('Deleted customer ' + c.name, c.phone, 'customer');
      toast('Customer deleted'); render();
    }
  });
};

App.actions['cust.view'] = (el) => {
  const c = customerById(el.getAttribute('data-id'));
  if (!c) return;
  const st = Calc.customer(c);
  const sales = SEED.sales.filter(s => s.customerId === c.id).sort((a,b) => a.date < b.date ? 1 : -1);
  const convs = SEED.conversations.filter(x => x.customerId === c.id);
  openModal({
    title: c.name,
    sub: c.phone + ' · ' + c.location + ' · customer since ' + fmtDate(c.createdAt),
    size: 'wide',
    body:
      '<div class="detail-grid" style="margin-bottom:16px">' +
        '<div><div class="k">Orders</div><div class="v">' + st.orders + '</div></div>' +
        '<div><div class="k">Total spent</div><div class="v">' + money(st.spent) + '</div></div>' +
        '<div><div class="k">Owing</div><div class="v" style="color:' + (st.owed ? 'var(--danger)' : 'inherit') + '">' + money(st.owed) + '</div></div>' +
        '<div><div class="k">Average order</div><div class="v">' + money(st.avg) + '</div></div>' +
        '<div><div class="k">Last purchase</div><div class="v">' + (st.lastPurchase ? fmtDate(st.lastPurchase) : 'Never') + '</div></div>' +
      '</div>' +
      '<div class="pill-row" style="margin-bottom:12px">' + (c.tags||[]).map(t => '<span class="chip ' + (t==='VIP'?'chip--gold':t==='Wholesale'?'chip--info':'chip--line') + '">' + esc(t) + '</span>').join('') + '</div>' +
      '<p class="small" style="color:var(--ink-2);line-height:1.6;margin-bottom:16px">' + esc(c.notes || 'No notes yet.') + '</p>' +
      '<div class="tabs" style="margin-bottom:12px">' +
        '<button aria-selected="true">Purchases (' + sales.length + ')</button>' +
        '<button aria-selected="false" data-action="cust.openConv" data-id="' + (convs[0] ? convs[0].id : '') + '">Conversations (' + convs.length + ')</button>' +
      '</div>' +
      (sales.length
        ? '<div class="table-wrap" style="border:1px solid var(--line);border-radius:8px"><table class="table"><thead><tr><th>Invoice</th><th>Date</th><th>Items</th><th class="num">Total</th><th class="num">Balance</th></tr></thead><tbody>' +
          sales.map(s => '<tr><td class="mono">' + esc(s.id) + '</td><td class="small">' + fmtDate(s.date) + '</td><td class="small">' +
            esc(s.items.map(i => i.qty + '× ' + i.name).join(', ')) + '</td><td class="num">' + money(Calc.total(s)) + '</td><td class="num">' + money(Calc.balance(s)) + '</td></tr>').join('') +
          '</tbody></table></div>'
        : UI.empty('receipt','No purchases yet','When they buy, every order will show here.')) +
      '<div class="banner banner--warn" style="margin-top:14px">' + icon('lock') +
        '<span><strong>Privacy:</strong> consent recorded for marketing messages. Give the customer an opt-out and delete details on request (Nigeria Data Protection Act).</span></div>',
    footerLeft: '<span class="left">' + esc(c.phone) + '</span>',
    footer: '<button class="btn btn--secondary" data-close-modal>Close</button>' +
      '<a class="btn btn--secondary" href="https://wa.me/' + esc(c.phone.replace(/[^\d+]/g,'').replace(/^0/,'234')) + '" target="_blank" rel="noopener">' + icon('message') + 'Open WhatsApp</a>' +
      '<button class="btn btn--primary" data-action="cust.edit" data-id="' + c.id + '">Edit customer</button>'
  });
};
App.actions['cust.openConv'] = (el) => {
  const id = el.getAttribute('data-id');
  if (!id) return;
  closeModal();
  go('inbox', { id });
};

App.actions['cust.export'] = () => {
  const headers = ['name','phone','location','tags','notes','orders','total_spent','outstanding','last_purchase','created'];
  const rows = SEED.customers.map(c => {
    const st = Calc.customer(c);
    return [c.name, c.phone, c.location, (c.tags||[]).join('; '), c.notes, st.orders, st.spent, st.owed, st.lastPurchase || '', c.createdAt];
  });
  downloadFile('adeola-customers.csv', toCSV(headers, rows));
  logActivity('Exported customers', rows.length + ' contacts to CSV', 'customer');
};

App.actions['cust.import'] = () => {
  openModal({
    title: 'Import contacts',
    sub: 'Bring your phone contacts or Excel list into the customer book',
    size: 'wide',
    body:
      '<div class="banner" style="margin-bottom:14px">' + icon('info') +
        '<span><strong>Expected columns:</strong> name, phone, location, tags, notes. <b>name</b> and <b>phone</b> are required. Duplicate numbers are skipped, not overwritten.</span></div>' +
      '<div class="field" style="margin-bottom:12px"><label class="field-label" for="ci-file">Choose a .csv file</label>' +
        '<input class="input" id="ci-file" type="file" accept=".csv,text/csv"></div>' +
      '<div class="field"><label class="field-label" for="ci-text">…or paste rows</label>' +
        '<textarea class="textarea" id="ci-text" rows="6" placeholder="name,phone,location,tags,notes&#10;Kemi Adebayo,0812 000 1111,Surulere,Retail,Prefers size S"></textarea></div>',
    footer: '<button class="btn btn--secondary" data-close-modal>Cancel</button>' +
      '<button class="btn btn--primary" id="ci-run">Import contacts</button>',
    onMount(root){
      const textEl = root.querySelector('#ci-text');
      root.querySelector('#ci-file').addEventListener('change', (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => { textEl.value = String(r.result); };
        r.readAsText(f);
      });
      root.querySelector('#ci-run').addEventListener('click', () => {
        const parsed = parseCSV(textEl.value);
        if (!parsed.rows.length){ toast('Choose a file or paste rows', 'error'); return; }
        const find = (n) => parsed.headers.findIndex(h => h.toLowerCase().replace(/[\s_]/g,'') === n);
        const nI = find('name'), pI = find('phone'), lI = find('location'), tI = find('tags'), noI = find('notes');
        if (nI < 0 || pI < 0){ toast('name and phone columns are required', 'error'); return; }
        let added = 0, skipped = 0;
        parsed.rows.forEach(r => {
          const name = (r[nI]||'').trim(), phone = (r[pI]||'').trim();
          if (!name || !phone){ skipped++; return; }
          if (SEED.customers.some(c => c.phone.replace(/\s/g,'') === phone.replace(/\s/g,''))){ skipped++; return; }
          SEED.customers.unshift({
            id: uid('c'), name, phone,
            location: (r[lI]||'Not provided').trim(),
            tags: (r[tI]||'Retail').split(/[;,]/).map(x=>x.trim()).filter(Boolean),
            notes: (r[noI]||'Imported contact.').trim(),
            createdAt: new Date().toISOString().slice(0,10)
          });
          added++;
        });
        logActivity('Imported contacts', added + ' added, ' + skipped + ' skipped', 'customer');
        closeModal(); toast(added + ' contacts imported' + (skipped ? ' · ' + skipped + ' skipped' : '')); render();
      });
    }
  });
};

/* ---------- backup / restore ---------- */
App.actions['backup.open'] = () => {
  const payload = { exportedAt: new Date().toISOString(), business: SEED.business, products: SEED.products, customers: SEED.customers, sales: SEED.sales, conversations: SEED.conversations, drafts: SEED.drafts, activity: SEED.activity, settings: SEED.settings, counters: SEED.counters };
  openModal({
    title: 'Backup and restore',
    sub: 'A copy of the business you can keep on your own device',
    body:
      '<div class="detail-grid" style="margin-bottom:16px">' +
        '<div><div class="k">Last automatic backup</div><div class="v" style="font-size:12px">' + timeAgo(SEED.settings.backup.lastRun) + '</div></div>' +
        '<div><div class="k">Schedule</div><div class="v" style="font-size:12px">' + esc(SEED.settings.backup.frequency) + ' at ' + esc(SEED.settings.backup.time) + '</div></div>' +
        '<div><div class="k">Keeping</div><div class="v" style="font-size:12px">' + SEED.settings.backup.keep + ' copies</div></div>' +
      '</div>' +
      '<div class="banner" style="margin-bottom:14px">' + icon('shield') +
        '<span>In production this writes to encrypted cloud storage every night <b>and</b> keeps a weekly copy off-site, with a one-click restore. Here you can download a JSON snapshot now.</span></div>' +
      '<div class="field" style="margin-bottom:10px"><label class="field-label" for="bk-file">Restore from a backup file</label>' +
        '<input class="input" id="bk-file" type="file" accept=".json,application/json"></div>' +
      '<p class="hint">Restoring replaces the demo data currently in this tab.</p>',
    footer: '<button class="btn btn--secondary" data-close-modal>Close</button>' +
      '<button class="btn btn--secondary" id="bk-run">' + icon('download') + 'Download backup</button>' +
      '<button class="btn btn--primary" id="bk-restore">Restore from file</button>',
    onMount(root){
      const fileEl = root.querySelector('#bk-file');
      root.querySelector('#bk-run').addEventListener('click', () => {
        downloadFile('adeola-backup-' + new Date().toISOString().slice(0,10) + '.json', JSON.stringify(payload, null, 2), 'application/json');
        SEED.settings.backup.lastRun = new Date().toISOString();
        logActivity('Manual backup downloaded', 'Products, customers, sales, conversations, settings', 'system');
      });
      root.querySelector('#bk-restore').addEventListener('click', () => {
        const f = fileEl.files[0];
        if (!f){ toast('Choose a backup file first', 'error'); return; }
        const r = new FileReader();
        r.onload = () => {
          try {
            const d = JSON.parse(String(r.result));
            if (!d.products || !d.customers || !d.sales) throw new Error('missing sections');
            SEED.products = d.products;
            SEED.customers = d.customers;
            SEED.sales = d.sales;
            SEED.conversations = d.conversations || [];
            SEED.drafts = d.drafts || [];
            SEED.activity = d.activity || [];
            if (d.settings) SEED.settings = d.settings;
            if (d.business) SEED.business = d.business;
            if (d.counters) SEED.counters = d.counters;
            logActivity('Restored from backup file', 'Backup dated ' + (d.exportedAt || 'unknown'), 'system');
            closeModal(); toast('Backup restored'); render();
          } catch (err){
            toast('That file is not a valid backup', 'error');
          }
        };
        r.readAsText(f);
      });
    }
  });
};

/* ================= UNIFIED INBOX ================= */
function convList(){
  const s = App.state.inbox;
  let list = SEED.conversations.slice();
  if (s.query){
    const q = s.query.toLowerCase();
    list = list.filter(c => {
      const cu = customerById(c.customerId);
      return ((cu ? cu.name + ' ' + cu.phone : '') + ' ' + c.summary + ' ' + c.messages.map(m=>m.text).join(' ')).toLowerCase().indexOf(q) > -1;
    });
  }
  if (s.filter === 'waiting') list = list.filter(c => c.needsAttention || c.status === 'waiting');
  if (s.filter === 'ai') list = list.filter(c => c.status === 'ai');
  if (s.filter === 'staff') list = list.filter(c => c.status === 'staff');
  if (s.filter === 'calls') list = list.filter(c => c.channel === 'Call');
  return list.sort((a,b) => new Date(b.lastAt) - new Date(a.lastAt));
}

function chatMessagesHTML(conv){
  let out = '';
  let lastDay = '';
  conv.messages.forEach(m => {
    const dk = fmtDate(m.at, {short:true});
    if (dk !== lastDay){
      out += '<div class="msg-day">' + dk + ' · ' + fmtTime(m.at) + '</div>';
      lastDay = dk;
    }
    const cu = customerById(conv.customerId);
    const isOut = m.from !== 'customer';
    const who = m.from === 'ai' ? 'Virtual assistant' : (m.from === 'staff' ? (m.who || 'Staff') : '');
    const whoIcon = m.from === 'ai' ? icon('bot') : (m.from === 'staff' ? icon('user') : '');
    out += '<div class="msg ' + (isOut ? 'msg--out' : '') + '">' +
      '<span class="msg__avatar">' + (isOut
        ? '<span class="avatar avatar--sm avatar--square" style="--av:' + (m.from === 'ai' ? '#2B5C43' : '#4B4D42') + '">' + (m.from === 'ai' ? 'AI' : esc(initials(m.who || 'Staff'))) + '</span>'
        : UI.avatar(cu ? cu.name : '?', null, 'sm')) + '</span>' +
      '<div style="min-width:0">' +
        '<div class="bubble">' + esc(m.text) + '</div>' +
        '<div class="bubble__meta">' +
          (isOut ? '<span class="bubble__who">' + whoIcon + esc(who) + '</span>' : '<span class="bubble__who">' + esc(cu ? cu.name.split(' ')[0] : 'Customer') + '</span>') +
          '<span>' + fmtTime(m.at) + '</span>' +
          (m.from === 'ai' ? '<span>· automated</span>' : '') +
        '</div>' +
        (m.tools && m.tools.length ?
          '<div class="trace" style="margin-top:6px">' +
            '<div style="color:var(--faint);margin-bottom:3px">tool calls · live data</div>' +
            m.tools.map(t => '<div class="trace__row"><span class="trace__ok">→</span><span>' + esc(t) + '</span></div>').join('') +
          '</div>' : '') +
      '</div></div>';
  });
  return out;
}

function viewInbox(){
  const s = App.state.inbox;
  const list = convList();
  if (!list.some(c => c.id === s.selected) && list.length) s.selected = list[0].id;
  const conv = SEED.conversations.find(c => c.id === s.selected);
  const cu = conv ? customerById(conv.customerId) : null;
  const counts = {
    all: SEED.conversations.length,
    waiting: SEED.conversations.filter(c => c.needsAttention || c.status === 'waiting').length,
    ai: SEED.conversations.filter(c => c.status === 'ai').length,
    staff: SEED.conversations.filter(c => c.status === 'staff').length,
    calls: SEED.conversations.filter(c => c.channel === 'Call').length
  };
  const filters = [['all','All'],['waiting','Needs human'],['ai','AI handling'],['staff','Staff'],['calls','Calls']].map(f =>
    '<button data-action="inbox.filter" data-value="' + f[0] + '" aria-pressed="' + (s.filter === f[0]) + '">' + f[1] + ' <span style="opacity:.6">' + counts[f[0]] + '</span></button>').join('');

  const convRows = list.map(c => {
    const cst = customerById(c.customerId);
    const last = c.messages[c.messages.length - 1];
    return '<button class="conv ' + (c.id === s.selected ? 'is-active' : '') + '" data-action="inbox.select" data-id="' + c.id + '">' +
      UI.avatar(cst ? cst.name : '?', null, 'sm') +
      '<span class="conv__body">' +
        '<span class="conv__top"><strong>' + esc(cst ? cst.name : 'Unknown') + '</strong><time>' + timeAgo(c.lastAt) + '</time></span>' +
        '<span class="conv__snippet">' + (last.from !== 'customer' ? 'You: ' : '') + esc(last.text) + '</span>' +
        '<span class="conv__meta">' + UI.statusChip(c.status) +
          '<span class="chip chip--line" style="height:18px;font-size:9.5px">' + (c.channel === 'Call' ? icon('phone') + ' Call' : 'WhatsApp') + '</span>' +
          (c.unread ? '<span class="conv__unread"></span>' : '') +
        '</span>' +
      '</span></button>';
  }).join('');

  const chatBody = conv
    ? '<div class="chat">' +
        '<div class="chat__head">' +
          UI.avatar(cu ? cu.name : '?', null, 'lg') +
          '<div class="grow"><strong>' + esc(cu ? cu.name : 'Unknown') + '</strong>' +
            '<span class="small">' + esc(cu ? cu.phone : '') + ' · ' + (conv.channel === 'Call' ? 'Phone call' : 'WhatsApp') + ' · ' + esc((cu ? cu.tags.join(', ') : '')) + '</span></div>' +
          UI.statusChip(conv.status) +
          '<button class="btn btn--ghost btn--sm" data-action="cust.view" data-id="' + (cu ? cu.id : '') + '">' + icon('user') + 'Profile</button>' +
          (conv.status === 'staff'
            ? '<button class="btn btn--secondary btn--sm" data-action="inbox.handback">' + icon('bot') + 'Let AI reply</button>'
            : '<button class="btn btn--primary btn--sm" data-action="inbox.takeover">' + icon('user') + 'Take over</button>') +
        '</div>' +
        '<div class="chat__msgs" id="chat-msgs">' + chatMessagesHTML(conv) + '</div>' +
        '<div class="chat__composer">' +
          '<div class="suggest">' +
            '<button data-action="inbox.suggest">' + icon('sparkles') + ' Suggest a reply</button>' +
            '<button data-action="inbox.quick" data-value="Thank you for your message. A staff member will confirm the details shortly.">Confirm shortly</button>' +
            '<button data-action="inbox.quick" data-value="Yes, that item is available. Would you like me to prepare it for pickup or delivery?">Availability</button>' +
            '<button data-action="inbox.quick" data-value="Please send your full name, phone number and delivery address so we can prepare your order.">Ask for details</button>' +
          '</div>' +
          '<div class="composer-row">' +
            '<textarea class="textarea" id="inbox-input" rows="1" placeholder="Write as ' + esc(staffById(App.state.user || 'u1').name.split(' ')[0]) + '… (sending takes over from the assistant)"></textarea>' +
            '<button class="btn btn--primary" data-action="inbox.send">' + icon('send') + 'Send</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    : '<div class="chat"><div class="chat__empty">' + UI.empty('inbox','Choose a conversation','AI, staff and waiting chats all appear in one list.') + '</div></div>';

  return '<div>' +
    UI.pageHead('Unified inbox',
      'WhatsApp and phone calls in one place. Green means the assistant is handling it; red means a customer is waiting for a person.',
      '<button class="btn btn--secondary" data-action="inbox.share">' + icon('copy') + 'Click-to-chat & QR</button>' +
      '<button class="btn btn--secondary" data-action="go" data-route="ai">' + icon('bot') + 'AI settings</button>') +
    '<div class="inbox">' +
      '<div class="inbox__list">' +
        '<div class="inbox__list-head">' +
          '<label class="search">' + icon('search') +
            '<input class="input" type="search" placeholder="Search chats" value="' + esc(s.query) + '" data-input="inbox.search"></label>' +
          '<div class="inbox__filters">' + filters + '</div>' +
        '</div>' +
        '<div class="conv-list">' + (convRows || UI.empty('message','No conversations','Chats appear here as soon as a customer messages.')) + '</div>' +
      '</div>' +
      chatBody +
    '</div>' +
    '<p class="hint">Demo note: WhatsApp and phone messages are simulated in this preview. In production the same conversation records are written by the WhatsApp Business Cloud API and the voice provider.</p>' +
  '</div>';
}

App.actions['inbox.select'] = (el) => {
  App.state.inbox.selected = el.getAttribute('data-id');
  const c = SEED.conversations.find(x => x.id === App.state.inbox.selected);
  if (c) c.unread = 0;
  render();
};
App.actions['inbox.filter'] = (el) => { App.state.inbox.filter = el.getAttribute('data-value'); render(); };
App.actions['inbox.search'] = (el) => { App.state.inbox.query = el.value; renderKeepFocus('inbox.search'); };

App.actions['inbox.takeover'] = () => {
  const c = SEED.conversations.find(x => x.id === App.state.inbox.selected);
  if (!c) return;
  c.status = 'staff';
  c.needsAttention = false;
  c.attentionReason = '';
  c.unread = 0;
  logActivity('Took over conversation', (customerById(c.customerId)||{}).name + ' · assistant paused for this chat', 'ai');
  toast('You are now handling this chat. The assistant is paused.');
  render();
};

App.actions['inbox.handback'] = () => {
  const c = SEED.conversations.find(x => x.id === App.state.inbox.selected);
  if (!c) return;
  c.status = 'ai';
  logActivity('Returned conversation to AI', (customerById(c.customerId)||{}).name, 'ai');
  toast('Assistant is handling this chat again');
  render();
};

App.actions['inbox.quick'] = (el) => {
  const box = document.getElementById('inbox-input');
  if (box){ box.value = el.getAttribute('data-value'); box.focus(); }
};

App.actions['inbox.suggest'] = () => {
  const c = SEED.conversations.find(x => x.id === App.state.inbox.selected);
  if (!c) return;
  const lastCustomer = c.messages.slice().reverse().find(m => m.from === 'customer');
  if (!lastCustomer){ toast('No customer message to answer yet', 'info'); return; }
  const res = AIEngine.handle(lastCustomer.text, { conversationId: c.id, customerId: c.customerId });
  const box = document.getElementById('inbox-input');
  if (box){ box.value = res.reply; box.focus(); }
  toast('Draft suggestion ready — review before sending', 'info');
};

App.actions['inbox.send'] = () => {
  const box = document.getElementById('inbox-input');
  if (!box) return;
  const text = box.value.trim();
  if (!text) return;
  const c = SEED.conversations.find(x => x.id === App.state.inbox.selected);
  if (!c) return;
  const me = staffById(App.state.user || 'u1');
  const wasAI = c.status === 'ai';
  c.messages.push({ from:'staff', text, at:new Date().toISOString(), who: me.name.split(' ')[0] });
  c.status = 'staff';
  c.needsAttention = false;
  c.attentionReason = '';
  c.lastAt = new Date().toISOString();
  c.unread = 0;
  box.value = '';
  logActivity('Replied to ' + ((customerById(c.customerId)||{}).name || 'customer'), text.slice(0,90), 'customer');
  if (wasAI) toast('Sent · you have taken over from the assistant');
  render();
};

App.actions['inbox.share'] = () => {
  const number = SEED.business.whatsapp.replace(/[^\d]/g,'');
  const link = 'https://wa.me/' + number + '?text=' + encodeURIComponent('Hello ' + SEED.business.name + ', I would like to ask about an item.');
  const qr = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=' + encodeURIComponent(link);
  openModal({
    title: 'Click-to-chat and QR code',
    sub: 'Official WhatsApp link — no unofficial automation',
    size: 'narrow',
    body:
      '<div style="text-align:center;padding:8px 0 4px">' +
        '<img src="' + qr + '" width="180" height="180" alt="QR code to start a WhatsApp chat" style="border-radius:10px;border:1px solid var(--line);margin:0 auto">' +
        '<p class="hint" style="margin-top:8px">Demo QR is generated by a public QR service. Production uses the official WhatsApp Business account display name and verified number.</p>' +
      '</div>' +
      '<div class="field"><label class="field-label">Click-to-chat link</label>' +
        '<input class="input" readonly value="' + esc(link) + '" onclick="this.select()"></div>' +
      '<div class="banner banner--accent" style="margin-top:12px">' + icon('shield') +
        '<span>Customers message a number you own, on the official Business Platform. If a staff phone is lost, the chat history and contacts stay in this system.</span></div>',
    footer: '<button class="btn btn--secondary" data-close-modal>Close</button>' +
      '<button class="btn btn--primary" id="share-copy">' + icon('copy') + 'Copy link</button>',
    onMount(root){
      root.querySelector('#share-copy').addEventListener('click', () => {
        navigator.clipboard && navigator.clipboard.writeText(link);
        toast('Click-to-chat link copied');
      });
    }
  });
};

function scrollChat(){
  const el = document.getElementById('chat-msgs');
  if (el) el.scrollTop = el.scrollHeight;
}

/* ================= AI CONTROL PANEL ================= */
function aiStats(){
  const convs = SEED.conversations;
  const aiHandled = convs.filter(c => c.status === 'ai').length;
  const waiting = convs.filter(c => c.needsAttention || c.status === 'waiting').length;
  const captured = SEED.drafts.length;
  const aiMessages = sum(convs, c => c.messages.filter(m => m.from === 'ai').length);
  const escalated = convs.filter(c => c.messages.some(m => (m.tools||[]).some(t => t.indexOf('escalate') > -1))).length;
  return { aiHandled, waiting, captured, aiMessages, escalated, total: convs.length };
}

function viewAI(){
  if (App.state.role !== 'admin'){
    return UI.pageHead('AI assistant', 'Owner controls') +
      '<div class="card">' + UI.empty('lock', 'Owner only', 'AI settings, guardrails and order approval are restricted to the owner account. Staff can still reply to chats in the inbox.') + '</div>';
  }
  const tab = App.state.ai.tab || 'overview';
  const st = aiStats();
  const s = SEED.settings.ai;
  const pending = SEED.drafts.filter(d => d.status === 'awaiting_approval');

  const tabs = [['overview','Overview'],['behaviour','Behaviour & limits'],['orders','AI orders (' + pending.length + ')'],['console','Test console'],['analytics','Analytics']]
    .map(t => '<button role="tab" aria-selected="' + (tab === t[0]) + '" data-action="ai.tab" data-value="' + t[0] + '">' + t[1] + '</button>').join('');

  let body = '';

  if (tab === 'overview'){
    body =
      '<div class="ai-hero" style="margin-bottom:16px">' +
        '<div class="ai-hero__main">' +
          '<div class="ai-status ' + (s.enabled ? '' : 'ai-status--off') + '"><span class="ai-status__dot"></span>' + (s.enabled ? 'Assistant is ON' : 'Assistant is OFF') +
            ' · ' + (s.scheduleMode === 'always' ? 'answers all day' : s.scheduleMode === 'after-hours' ? 'covers ' + s.startTime + '–' + s.endTime + (s.weekends ? ' and weekends' : '') : 'manual only') + '</div>' +
          '<h2>It answers from your inventory — never from imagination.</h2>' +
          '<p>Every reply that mentions a product, size or price comes from a live lookup in this system. If the data is not there, it says so and asks you to step in.</p>' +
          '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">' +
            '<label class="switch"><input type="checkbox" data-change="ai.toggle" ' + (s.enabled ? 'checked' : '') + '><span class="switch__track"></span><span class="small">' + (s.enabled ? 'On' : 'Off') + '</span></label>' +
            '<button class="btn btn--secondary btn--sm" data-action="ai.tab" data-value="console">' + icon('play') + 'Test the assistant</button>' +
            '<button class="btn btn--secondary btn--sm" data-action="ai.tab" data-value="behaviour">' + icon('settings') + 'Edit limits</button>' +
          '</div>' +
        '</div>' +
        '<div class="ai-hero__side">' +
          '<p class="eyebrow">Today</p>' +
          '<div class="ai-metrics">' +
            '<div><span>Chats handled</span><strong>' + st.aiHandled + '</strong><small>of ' + st.total + ' conversations</small></div>' +
            '<div><span>Waiting for you</span><strong>' + st.waiting + '</strong><small>escalated</small></div>' +
            '<div><span>Orders captured</span><strong>' + pending.length + '</strong><small>awaiting approval</small></div>' +
            '<div><span>AI messages</span><strong>' + st.aiMessages + '</strong><small>all conversations</small></div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="dash__split dash__split--even">' +
        '<div class="card"><div class="card__head"><div><h2>Guardrails in force</h2><p>Hard rules the assistant cannot override</p></div>' +
          '<span class="chip chip--accent">' + icon('shield') + 'Enforced</span></div>' +
          '<div class="guard">' +
            '<div class="guard__row">' + icon('check') + '<div><strong>No invented products or prices</strong><span>Product, size, colour and price come from a live tool call. No match means it says so.</span></div></div>' +
            '<div class="guard__row">' + icon('check') + '<div><strong>No discounts</strong><span>Maximum authorised discount is ' + s.maxDiscountPct + '%. Requests are escalated to you.</span></div></div>' +
            '<div class="guard__row">' + icon('check') + '<div><strong>Never confirms payment</strong><span>Only staff or a verified payment webhook can mark money as received.</span></div></div>' +
            '<div class="guard__row">' + icon('check') + '<div><strong>Cost and profit stay private</strong><span>Never disclosed to a customer, under any wording.</span></div></div>' +
            '<div class="guard__row">' + icon('check') + '<div><strong>No other customers\' data</strong><span>One conversation cannot see another customer\'s record.</span></div></div>' +
            '<div class="guard__row">' + icon('check') + '<div><strong>Complaints, refunds, bulk orders → human</strong><span>Escalated with a summary and flagged on the dashboard.</span></div></div>' +
            '<div class="guard__row">' + icon('check') + '<div><strong>Always identified</strong><span>Each chat opens by naming it as the store\'s virtual assistant.</span></div></div>' +
          '</div>' +
        '</div>' +

        '<div class="card"><div class="card__head"><div><h2>Integrations</h2><p>Designed for, simulated in this preview</p></div></div>' +
          '<div class="card__body stack" style="gap:12px">' +
            '<div class="list-row" style="padding:0;border:0">' +
              '<span class="attention__icon" style="background:var(--accent-soft);border-color:var(--accent-line);color:var(--accent-ink)">' + icon('message') + '</span>' +
              '<span class="list-row__body"><strong>WhatsApp Business Cloud API</strong><span>Official platform · opt-in and message templates · no unofficial automation</span></span>' +
              '<span class="chip chip--line">Demo</span></div>' +
            '<div class="list-row" style="padding:0;border:0">' +
              '<span class="attention__icon">' + icon('phone') + '</span>' +
              '<span class="list-row__body"><strong>Voice — Twilio / Africa\'s Talking</strong><span>Local number, speech-to-text, text-to-speech, transcript saved</span></span>' +
              '<span class="chip chip--line">Demo</span></div>' +
            '<div class="list-row" style="padding:0;border:0">' +
              '<span class="attention__icon">' + icon('sparkles') + '</span>' +
              '<span class="list-row__body"><strong>Claude with tool calling</strong><span>Inventory lookup, reservation and customer creation as tools</span></span>' +
              '<span class="chip chip--line">Demo</span></div>' +
            '<div class="list-row" style="padding:0;border:0">' +
              '<span class="attention__icon">' + icon('wallet') + '</span>' +
              '<span class="list-row__body"><strong>Paystack / Flutterwave</strong><span>Payment links and verified webhooks — later phase</span></span>' +
              '<span class="chip chip--line">Later</span></div>' +
            '<div class="banner" style="margin-top:2px">' + icon('info') +
              '<span>Nothing is sent to a real customer in this prototype. The same tool calls and guardrails run locally so you can test the behaviour first.</span></div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  if (tab === 'behaviour'){
    body =
      '<div class="dash__split dash__split--even" style="align-items:start">' +
        '<div class="card"><div class="card__head"><div><h2>Availability</h2><p>When the assistant may reply on its own</p></div></div>' +
          '<div class="card__body">' +
            '<div class="setting-row"><div class="setting-row__body"><strong>Assistant enabled</strong><span>Turn off and all new messages wait for a human.</span></div>' +
              '<label class="switch"><input type="checkbox" id="ai-enabled" ' + (s.enabled ? 'checked' : '') + '><span class="switch__track"></span></label></div>' +
            '<div class="setting-row"><div class="setting-row__body"><strong>Schedule</strong><span>Answer all the time, or only outside opening hours.</span></div>' +
              '<div class="field"><select class="select" id="ai-mode">' +
                '<option value="always"' + (s.scheduleMode==='always'?' selected':'') + '>All day</option>' +
                '<option value="after-hours"' + (s.scheduleMode==='after-hours'?' selected':'') + '>After hours</option>' +
                '<option value="off"' + (s.scheduleMode==='off'?' selected':'') + '>Manual only</option>' +
              '</select></div></div>' +
            '<div class="setting-row"><div class="setting-row__body"><strong>Cover starts / ends</strong><span>Outside these hours the assistant answers first and escalates anything serious.</span></div>' +
              '<div style="display:flex;gap:6px"><input class="input" type="time" id="ai-start" value="' + esc(s.startTime) + '" style="width:105px"><input class="input" type="time" id="ai-end" value="' + esc(s.endTime) + '" style="width:105px"></div></div>' +
            '<div class="setting-row"><div class="setting-row__body"><strong>Weekend cover</strong><span>Saturday and Sunday handled by the assistant.</span></div>' +
              '<label class="switch"><input type="checkbox" id="ai-weekends" ' + (s.weekends ? 'checked' : '') + '><span class="switch__track"></span></label></div>' +
            '<div class="setting-row"><div class="setting-row__body"><strong>Answer phone calls</strong><span>Voice assistant with transcript and summary.</span></div>' +
              '<label class="switch"><input type="checkbox" id="ai-voice" ' + (s.voiceEnabled ? 'checked' : '') + '><span class="switch__track"></span></label></div>' +
          '</div></div>' +

        '<div class="card"><div class="card__head"><div><h2>Limits and escalation</h2><p>What it must never decide alone</p></div></div>' +
          '<div class="card__body">' +
            '<div class="setting-row"><div class="setting-row__body"><strong>Maximum discount</strong><span>0% means it never negotiates. Anything above zero is a business decision you own.</span></div>' +
              '<div class="field"><input class="input" type="number" min="0" max="50" id="ai-discount" value="' + s.maxDiscountPct + '"><span class="field-note">percent</span></div></div>' +
            '<div class="setting-row"><div class="setting-row__body"><strong>Approve holds above</strong><span>Draft orders above this value need your approval before staff confirm.</span></div>' +
              '<div class="field"><input class="input" type="number" min="0" step="1000" id="ai-approve" value="' + s.requireApprovalAbove + '"><span class="field-note">Naira</span></div></div>' +
            '<div class="setting-row"><div class="setting-row__body"><strong>Escalate unclear questions</strong><span>When it cannot find a confident answer, hand over instead of guessing.</span></div>' +
              '<label class="switch"><input type="checkbox" id="ai-escalate" ' + (s.escalateUnknown ? 'checked' : '') + '><span class="switch__track"></span></label></div>' +
            '<div class="setting-row"><div class="setting-row__body"><strong>Languages</strong><span>English and simple Nigerian Pidgin when the customer uses it.</span></div>' +
              '<span class="chip chip--line">English · Pidgin</span></div>' +
            '<div class="setting-row"><div class="setting-row__body"><strong>Tone</strong><span>How replies should sound.</span></div>' +
              '<div class="field" style="width:200px"><input class="input" id="ai-tone" value="' + esc(s.tone) + '"></div></div>' +
          '</div>' +
          '<div class="card__foot" style="display:flex;justify-content:flex-end;gap:8px">' +
            '<button class="btn btn--secondary" data-action="ai.tab" data-value="overview">Cancel</button>' +
            '<button class="btn btn--primary" data-action="ai.saveSettings">Save changes</button>' +
          '</div></div>' +
      '</div>' +

      '<div class="card" style="margin-top:16px"><div class="card__head"><div><h2>What customers are told</h2><p>Stored in settings and quoted by the assistant, never invented</p></div></div>' +
        '<div class="card__body"><div class="form-grid">' +
          '<div class="field span-2"><label class="field-label" for="ai-greeting">Opening message</label>' +
            '<textarea class="textarea" id="ai-greeting" rows="2">' + esc(s.greeting) + '</textarea></div>' +
          '<div class="field"><label class="field-label" for="ai-hours">Business hours</label>' +
            '<textarea class="textarea" id="ai-hours" rows="2">' + esc(SEED.business.hours) + '</textarea></div>' +
          '<div class="field"><label class="field-label" for="ai-delivery">Delivery policy</label>' +
            '<textarea class="textarea" id="ai-delivery" rows="2">' + esc(SEED.business.delivery) + '</textarea></div>' +
          '<div class="field"><label class="field-label" for="ai-returns">Returns / exchange</label>' +
            '<textarea class="textarea" id="ai-returns" rows="2">' + esc(SEED.business.returns) + '</textarea></div>' +
          '<div class="field"><label class="field-label" for="ai-payment">Payment policy</label>' +
            '<textarea class="textarea" id="ai-payment" rows="2">' + esc(SEED.business.payment) + '</textarea></div>' +
        '</div>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btn--primary" data-action="ai.saveSettings">Save business information</button></div>' +
        '</div></div>';
  }

  if (tab === 'orders'){
    const rows = SEED.drafts.map(d => {
      const cu = customerById(d.customerId);
      const total = sum(d.items, i => i.qty * i.unitPrice);
      const state = d.status === 'awaiting_approval' ? '<span class="chip chip--warn">Awaiting approval</span>'
        : d.status === 'approved' ? '<span class="chip chip--accent">Approved</span>'
        : d.status === 'converted' ? '<span class="chip chip--line">Converted to sale</span>'
        : '<span class="chip chip--danger">Expired</span>';
      return '<tr>' +
        '<td><span class="mono">' + esc(d.id) + '</span><div class="tiny muted">' + timeAgo(d.createdAt) + '</div></td>' +
        '<td><div class="cell">' + UI.avatar(cu ? cu.name : '?', null, 'sm') + '<div class="cell__text"><strong>' + esc(cu ? cu.name : 'Unknown') + '</strong><span>' + esc(cu ? cu.phone : '') + '</span></div></div></td>' +
        '<td class="small">' + d.items.map(i => { const p = productById(i.productId); return esc((p ? p.name : i.productId) + ' ×' + i.qty); }).join('<br>') + '</td>' +
        '<td class="num">' + money(total) + '</td>' +
        '<td class="small">' + esc(d.delivery) + '<div class="tiny muted">expires ' + fmtDate(d.expiresAt, {short:true}) + '</div></td>' +
        '<td>' + state + '</td>' +
        '<td><div class="row-actions">' +
          '<button class="icon-btn" title="View" data-action="ai.openOrder" data-id="' + d.id + '">' + icon('eye') + '</button>' +
          (d.status === 'awaiting_approval' ? '<button class="icon-btn" title="Approve" data-action="ai.approve" data-id="' + d.id + '">' + icon('check') + '</button>' +
            '<button class="icon-btn" title="Reject" data-action="ai.reject" data-id="' + d.id + '">' + icon('x') + '</button>' : '') +
          (d.status === 'approved' ? '<button class="icon-btn" title="Convert to sale" data-action="ai.convert" data-id="' + d.id + '">' + icon('receipt') + '</button>' : '') +
        '</div></td>' +
      '</tr>';
    }).join('');

    body = '<div class="banner banner--accent" style="margin-bottom:14px">' + icon('shield') +
      '<span>The assistant can create a hold, but <strong>never a confirmed sale</strong>. Approving here does not mark money as received — record the payment on the sale itself.</span></div>' +
      '<div class="card"><div class="card__head"><div><h2>Draft orders from the assistant</h2><p>Holds expire automatically and release stock</p></div>' +
        '<span class="chip chip--line">' + SEED.drafts.length + ' total</span></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Reference</th><th>Customer</th><th>Items</th><th class="num">Value</th><th>Delivery / expiry</th><th>Status</th><th class="num">Actions</th></tr></thead>' +
      '<tbody>' + (rows || '') + '</tbody></table></div>' +
      (!SEED.drafts.length ? UI.empty('bot','No draft orders yet','When a customer asks the assistant to hold an item, it appears here for approval.') : '') +
      '</div>';
  }

  if (tab === 'console'){
    const msgs = App.state.ai.consoleMessages.length
      ? App.state.ai.consoleMessages
      : [{ from:'ai', text: SEED.settings.ai.greeting + ' Try asking about stock, a price, delivery, a discount, or ask to hold an item.', tools:[] }];
    body =
      '<div class="dash__split" style="align-items:start">' +
        '<div class="console">' +
          '<div class="console__head">' +
            '<span class="attention__icon" style="width:26px;height:26px;background:var(--accent-soft);border-color:var(--accent-line);color:var(--accent-ink)">' + icon('message') + '</span>' +
            '<div class="grow"><strong style="font-size:12.5px">WhatsApp simulator</strong><div class="tiny muted">Customer: demo number · live inventory</div></div>' +
            '<button class="btn btn--ghost btn--sm" data-action="ai.console.reset">' + icon('refresh') + 'Reset</button>' +
          '</div>' +
          '<div class="console__log" id="ai-log">' +
            msgs.map(m =>
              '<div class="msg ' + (m.from !== 'customer' ? 'msg--out' : '') + '" style="max-width:86%">' +
                (m.from !== 'customer' ? '<span class="msg__avatar"><span class="avatar avatar--sm avatar--square" style="--av:#2B5C43">AI</span></span>' : '<span class="msg__avatar">' + UI.avatar('Demo Customer', null, 'sm') + '</span>') +
                '<div style="min-width:0"><div class="bubble">' + esc(m.text) + '</div>' +
                  '<div class="bubble__meta">' + (m.from === 'ai' ? '<span class="bubble__who">' + icon('bot') + 'Virtual assistant</span>' : '<span class="bubble__who">Customer</span>') + '</div>' +
                  (m.tools && m.tools.length ? '<div class="trace" style="margin-top:6px"><div style="color:var(--faint);margin-bottom:3px">tool calls</div>' +
                    m.tools.map(t => '<div class="trace__row"><span class="' + (t.ok === false ? 'trace__no' : 'trace__ok') + '">→</span><span>' + esc(t.name) + (t.result ? ' · ' + esc(t.result) : '') + '</span></div>').join('') +
                  '</div>' : '') +
                '</div>' +
              '</div>').join('') +
          '</div>' +
          '<div class="console__foot">' +
            '<div class="suggest" style="margin-bottom:8px">' +
              ['Do you have the adire dress in medium?','How much is the linen two-piece?','Can I get a discount?','I want to hold the tote bag. My name is Bola, 0803 555 1212','Do you have the satin slip dress?','Wetin dey for bags?','I have paid, please send it','How much is delivery to Ajek?']
                .map(q => '<button data-action="ai.console.sample" data-value="' + esc(q) + '">' + esc(q) + '</button>').join('') +
            '</div>' +
            '<div class="composer-row">' +
              '<textarea class="textarea" id="ai-input" rows="1" placeholder="Type as the customer…"></textarea>' +
              '<button class="btn btn--primary" data-action="ai.console.send">' + icon('send') + 'Send</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="stack">' +
          '<div class="card"><div class="card__head"><div><h2>Voice call simulator</h2><p>Answers, checks stock, speaks the reply, logs a transcript</p></div></div>' +
            '<div class="card__body">' +
              (App.state.ai.callLog && App.state.ai.callLog.length
                ? '<div class="console__log" style="height:230px;padding:0;background:transparent">' +
                    App.state.ai.callLog.map(line =>
                      '<div style="display:flex;gap:8px;font-size:11.5px;line-height:1.5">' +
                        '<span class="mono" style="color:var(--faint);flex:none">' + esc(line.at) + '</span>' +
                        '<span style="' + (line.speaker === 'ai' ? 'color:var(--ink)' : line.speaker === 'system' ? 'color:var(--muted)' : 'color:var(--ink-2)') + '">' +
                          (line.speaker === 'system' ? '' : '<b style="font-weight:500">' + esc(line.label) + ':</b> ') + esc(line.text) +
                          (line.tools && line.tools.length ? '<span class="mono" style="color:var(--accent-ink);display:block;font-size:10px">→ ' + esc(line.tools.join(' · ')) + '</span>' : '') +
                        '</span></div>').join('') +
                  '</div>'
                : '<div class="empty" style="padding:22px 10px"><div class="empty__icon">' + icon('phone') + '</div>' +
                    '<h3>No call running</h3><p>Start a simulated inbound call. It uses real stock and writes a transcript to the inbox.</p></div>') +
            '</div>' +
            '<div class="card__foot" style="display:flex;gap:8px;justify-content:flex-end">' +
              '<button class="btn btn--secondary btn--sm" data-action="ai.call.reset">' + icon('refresh') + 'Clear</button>' +
              '<button class="btn btn--primary btn--sm" data-action="ai.call.start"' + (App.state.ai.callRunning ? ' disabled' : '') + '>' + icon('play') + (App.state.ai.callRunning ? 'Call in progress…' : 'Start call') + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="card"><div class="card__head"><div><h2>What gets recorded</h2><p>Every simulated chat is real system data</p></div></div>' +
            '<div class="card__body"><ul class="help-list">' +
              '<li><span class="mono">01</span><span>New contact saved to the customer book automatically, with phone and channel.</span></li>' +
              '<li><span class="mono">02</span><span>Reservations create a draft order you must approve, with an expiry time.</span></li>' +
              '<li><span class="mono">03</span><span>Tool calls are shown with the reply so you can audit exactly what data was used.</span></li>' +
              '<li><span class="mono">04</span><span>Escalations appear on the dashboard and in the inbox as “needs human”.</span></li>' +
              '<li><span class="mono">05</span><span>Call transcripts and summaries are attached to the same customer record.</span></li>' +
            '</ul></div></div>' +
        '</div>' +
      '</div>';
  }

  if (tab === 'analytics'){
    const catCounts = {};
    SEED.conversations.forEach(c => c.messages.filter(m => m.from === 'ai').forEach(m => {
      (m.tools||[]).forEach(t => {
        const name = t.split('(')[0].trim();
        catCounts[name] = (catCounts[name] || 0) + 1;
      });
    }));
    const toolRows = Object.keys(catCounts).sort((a,b)=>catCounts[b]-catCounts[a]).map(k =>
      '<div class="list-row"><span class="rank">' + icon('arrowRight') + '</span><span class="list-row__body"><strong class="mono" style="font-size:11px">' + esc(k) + '</strong></span><span class="list-row__value">' + catCounts[k] + '</span></div>').join('');
    const missed = [
      { reason:'Sold out — customer wanted a size or colour not held', count:1, value:'₦42,000 potential', conv:'cnv-07' },
      { reason:'Asked for a discount above 0%', count:1, value:'₦42,000 held', conv:'cnv-06' },
      { reason:'Wholesale price not delegated to AI', count:1, value:'20 pieces', conv:'cnv-02' }
    ];
    body =
      '<div class="statstrip" style="margin-bottom:16px">' +
        UI.kpi('Conversations', String(st.total), '<span>' + st.aiHandled + ' AI · ' + st.waiting + ' waiting</span>', 'message') +
        UI.kpi('AI messages sent', String(st.aiMessages), '<span>guardrailed replies</span>', 'bot') +
        UI.kpi('Orders captured', String(SEED.drafts.length), '<span>' + pending.length + ' awaiting approval</span>', 'receipt') +
        UI.kpi('Escalated', String(st.escalated), '<span>needed a human</span>', 'alert') +
      '</div>' +
      '<div class="dash__split dash__split--even">' +
        '<div class="card"><div class="card__head"><div><h2>Tools it actually used</h2><p>Audit trail across all conversations</p></div></div>' +
          '<div class="list-rows">' + (toolRows || UI.empty('bot','No tool calls yet','Run a test in the console to see the calls appear here.')) + '</div></div>' +
        '<div class="card"><div class="card__head"><div><h2>Questions it could not answer</h2><p>Where a human was needed, and why</p></div></div>' +
          '<div class="list-rows">' + missed.map(m =>
            '<button class="list-row" data-action="go" data-route="inbox" data-id="' + m.conv + '" style="width:100%;text-align:left">' +
              '<span class="rank">!</span><span class="list-row__body"><strong>' + esc(m.reason) + '</strong><span>' + esc(m.value) + '</span></span>' +
              '<span class="chip chip--line">Open</span></button>').join('') +
          '</div>' +
          '<div class="attention-note">' + icon('info') + '<span>These are the conversations to review first. Sold-out reasons are also a buying signal — restock what customers ask for.</span></div>' +
        '</div>' +
      '</div>';
  }

  return '<div>' +
    UI.pageHead('AI sales assistant',
      'The assistant is a member of staff with limited rights: it can look, quote and hold — it cannot discount, confirm payment or see profit.',
      '<button class="btn btn--secondary" data-action="go" data-route="inbox">' + icon('inbox') + 'Open inbox</button>' +
      '<button class="btn btn--primary" data-action="ai.tab" data-value="console">' + icon('play') + 'Test assistant</button>') +
    '<div class="tabs" role="tablist">' + tabs + '</div>' +
    body +
    '</div>';
}

App.actions['ai.tab'] = (el) => { App.state.ai.tab = el.getAttribute('data-value'); render(); };
App.actions['ai.toggle'] = () => {
  SEED.settings.ai.enabled = !SEED.settings.ai.enabled;
  logActivity((SEED.settings.ai.enabled ? 'Enabled' : 'Paused') + ' the AI assistant', 'Owner control', 'ai');
  toast('Assistant ' + (SEED.settings.ai.enabled ? 'enabled' : 'paused'));
  render();
};
App.actions['ai.saveSettings'] = () => {
  const get = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
  const s = SEED.settings.ai;
  if (document.getElementById('ai-mode')){
    SEED.settings.ai.enabled = document.getElementById('ai-enabled').checked;
    s.scheduleMode = get('ai-mode');
    s.startTime = get('ai-start');
    s.endTime = get('ai-end');
    s.weekends = document.getElementById('ai-weekends').checked;
    s.voiceEnabled = document.getElementById('ai-voice').checked;
    s.maxDiscountPct = Number(get('ai-discount')) || 0;
    s.requireApprovalAbove = Number(get('ai-approve')) || 0;
    s.escalateUnknown = document.getElementById('ai-escalate').checked;
    s.tone = get('ai-tone');
  }
  if (document.getElementById('ai-greeting')){
    s.greeting = get('ai-greeting');
    SEED.business.hours = get('ai-hours');
    SEED.business.delivery = get('ai-delivery');
    SEED.business.returns = get('ai-returns');
    SEED.business.payment = get('ai-payment');
  }
  logActivity('Updated AI settings', 'Schedule, limits or business information changed', 'ai');
  toast('Settings saved'); render();
};

App.actions['ai.openOrder'] = (el) => {
  const d = SEED.drafts.find(x => x.id === el.getAttribute('data-id'));
  if (!d) return;
  const cu = customerById(d.customerId);
  const total = sum(d.items, i => i.qty * i.unitPrice);
  openModal({
    title: 'Draft order ' + d.id,
    sub: (cu ? cu.name : 'Customer') + ' · created ' + timeAgo(d.createdAt) + ' by the assistant',
    body:
      '<div class="detail-grid" style="margin-bottom:14px">' +
        '<div><div class="k">Value</div><div class="v">' + money(total) + '</div></div>' +
        '<div><div class="k">Held until</div><div class="v" style="font-size:12px">' + fmtDate(d.expiresAt) + '</div></div>' +
        '<div><div class="k">Channel</div><div class="v" style="font-size:12px">' + esc(d.channel) + '</div></div>' +
        '<div><div class="k">Delivery</div><div class="v" style="font-size:12px">' + esc(d.delivery) + '</div></div>' +
      '</div>' +
      '<div class="table-wrap" style="border:1px solid var(--line);border-radius:8px"><table class="table"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th></tr></thead><tbody>' +
        d.items.map(i => { const p = productById(i.productId);
          return '<tr><td><div class="cell">' + (p ? UI.thumb(p) : '') + '<div class="cell__text"><strong>' + esc(p ? p.name : i.productId) + '</strong><span>' + esc(p ? p.colour + ' · size ' + p.size : '') + '</span></div></div></td>' +
            '<td class="num">' + i.qty + '</td><td class="num">' + money(i.unitPrice) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' +
      '<p class="small" style="margin-top:12px;color:var(--ink-2)">' + esc(d.note) + '</p>' +
      '<div class="banner banner--warn" style="margin-top:12px">' + icon('alert') +
        '<span>Approving holds the item but does not record a payment. Convert to a sale once the customer pays or collects.</span></div>',
    footer: '<button class="btn btn--secondary" data-close-modal>Close</button>' +
      (d.status === 'awaiting_approval' ? '<button class="btn btn--danger" data-action="ai.reject" data-id="' + d.id + '">Reject</button>' +
        '<button class="btn btn--primary" data-action="ai.approve" data-id="' + d.id + '">Approve hold</button>' : '') +
      (d.status === 'approved' ? '<button class="btn btn--primary" data-action="ai.convert" data-id="' + d.id + '">Convert to sale</button>' : '')
  });
};

App.actions['ai.approve'] = (el) => {
  const d = SEED.drafts.find(x => x.id === el.getAttribute('data-id'));
  if (!d) return;
  d.status = 'approved';
  const conv = SEED.conversations.find(c => c.draftId === d.id);
  if (conv){ conv.needsAttention = false; conv.attentionReason = ''; }
  logActivity('Approved AI draft order ' + d.id, (customerById(d.customerId)||{}).name + ' · stock held', 'ai');
  closeModal(); toast('Hold approved — stock reserved for the customer'); render();
};
App.actions['ai.reject'] = (el) => {
  const d = SEED.drafts.find(x => x.id === el.getAttribute('data-id'));
  if (!d) return;
  d.status = 'expired';
  const conv = SEED.conversations.find(c => c.draftId === d.id);
  if (conv){ conv.status = 'staff'; conv.needsAttention = false; conv.attentionReason = ''; }
  logActivity('Rejected AI draft order ' + d.id, 'Staff decision', 'ai');
  closeModal(); toast('Hold rejected — stock released'); render();
};
App.actions['ai.convert'] = (el) => {
  const d = SEED.drafts.find(x => x.id === el.getAttribute('data-id'));
  if (!d) return;
  const short = d.items.find(i => { const p = productById(i.productId); return !p || p.qty < i.qty; });
  if (short){ toast('Not enough stock to convert this order', 'error'); return; }
  d.items.forEach(i => { const p = productById(i.productId); p.qty -= i.qty; p.status = Calc.productStatus(p); });
  const sale = {
    id: nextInvoiceNo(),
    date: new Date().toISOString().slice(0,10),
    customerId: d.customerId,
    items: d.items.map(i => { const p = productById(i.productId); return { productId:i.productId, name:p.name, qty:i.qty, unitPrice:i.unitPrice, cost:p.cost }; }),
    discount: 0, paid: 0,
    method: 'Pending payment',
    staffId: App.state.user || 'u1',
    aiAssisted: true,
    note: 'Converted from AI draft ' + d.id
  };
  SEED.sales.push(sale);
  d.status = 'converted';
  logActivity('Converted ' + d.id + ' to sale ' + sale.id, money(Calc.total(sale)) + ' · unpaid until payment recorded', 'sale');
  closeModal(); toast('Converted to ' + sale.id + ' — record payment when received');
  render();
  setTimeout(() => receiptModal(sale.id), 120);
};

App.actions['ai.console.send'] = () => {
  const box = document.getElementById('ai-input');
  if (!box) return;
  const text = box.value.trim();
  if (!text) return;
  if (!App.state.ai.consoleMessages.length) App.state.ai.consoleMessages = [];
  App.state.ai.consoleMessages.push({ from:'customer', text, tools:[] });
  const res = AIEngine.handle(text, {});
  App.state.ai.consoleMessages.push({ from:'ai', text: res.reply, tools: res.tools.map(t => ({ name:t.name, result:t.result, ok:t.ok })) });
  box.value = '';
  render();
  const log = document.getElementById('ai-log');
  if (log) log.scrollTop = log.scrollHeight;
};
App.actions['ai.console.sample'] = (el) => {
  const box = document.getElementById('ai-input');
  if (box){ box.value = el.getAttribute('data-value'); box.focus(); }
};
App.actions['ai.console.reset'] = () => { App.state.ai.consoleMessages = []; render(); };

App.actions['ai.call.start'] = () => {
  if (App.state.ai.callRunning) return;
  const script = AIEngine.callScript();
  App.state.ai.callLog = [];
  App.state.ai.callRunning = true;
  const step = (i) => {
    if (i >= script.length){
      App.state.ai.callRunning = false;
      const conv = SEED.conversations.find(c => c.id === 'cnv-call-demo');
      if (!conv){
        SEED.conversations.unshift({
          id: 'cnv-call-demo', customerId: 'c04', channel:'Call', status:'ai',
          unread:0, lastAt:new Date().toISOString(), startedAt:new Date().toISOString(),
          summary:'Simulated inbound call from the test console. Stock checked for Chunky Sneakers size 42, hold noted for tomorrow morning. Transcript saved.',
          needsAttention:false, attentionReason:'',
          messages: script.filter(l => l.speaker !== 'system').map(l => ({ from: l.speaker === 'ai' ? 'ai' : 'customer', text: l.text, at: new Date().toISOString(), tools: l.tools }))
        });
      }
      logActivity('AI answered a simulated call', 'Chunky Sneakers size 42 · transcript saved to Chiamaka/Aisha record', 'ai');
      toast('Call ended · transcript saved in the inbox');
      render();
      return;
    }
    App.state.ai.callLog.push(script[i]);
    if (App.state.route === 'ai') render();
    setTimeout(() => step(i+1), 1100);
  };
  step(0);
};
App.actions['ai.call.reset'] = () => { App.state.ai.callLog = []; App.state.ai.callRunning = false; render(); };
