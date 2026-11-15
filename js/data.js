/* ============================================================
   DEMO DATA — clearly labelled sample data, held in memory only.
   Nothing here is real business data. Names, prices and stock
   figures are illustrative and should be replaced with the
   owner's exported Excel columns.
   ============================================================ */
'use strict';

const TODAY = new Date();
function iso(d){ return d.toISOString().slice(0,10); }
function daysAgo(n){ const d = new Date(TODAY); d.setDate(d.getDate()-n); return iso(d); }
function hoursAgo(n){ const d = new Date(TODAY.getTime() - n*3600e3); return d.toISOString(); }

const SEED = {
  business: {
    name: 'Adeola Collections',
    tagline: 'Clothes · Shoes · Bags · Accessories',
    phone: '+234 803 000 1122',
    whatsapp: '+234 803 000 1122',
    address: '12 Allen Avenue, Ikeja, Lagos',
    currency: '₦',
    hours: 'Mon–Sat, 9:00am – 7:00pm · Sunday closed',
    delivery: 'Lagos mainland ₦2,500 · Island ₦3,500 · Outside Lagos ₦5,000 (3–5 working days)',
    returns: 'Exchanges within 48 hours if the item is unworn and tags are intact. No refunds on sale items.',
    payment: 'Bank transfer or POS. Payment confirms the order — the assistant never confirms payment.',
    tone: 'polite, warm and brief'
  },

  categories: ['Dresses','Tops','Trousers','Shoes','Bags','Accessories'],
  grades: ['Premium','Grade A','Grade B'],
  colours: ['Black','White','Indigo','Sand','Wine','Charcoal','Tan','Gold','Cognac','Emerald','Champagne','Natural','Blue','Multi','Brass'],
  sizes: ['XS','S','M','L','XL','One size','38','39','40','41','42','30','32'],

  products: [
    { id:'p01', name:'Adire Wrap Dress',            category:'Dresses',     size:'M',        grade:'Grade A', colour:'Indigo',    cost:14500, price:32000, qty:6,  photo:'', status:'available',  lowStock:3 },
    { id:'p02', name:'Linen Two-Piece Set',         category:'Dresses',     size:'L',        grade:'Grade A', colour:'Sand',      cost:18000, price:42000, qty:3,  photo:'', status:'available',  lowStock:3 },
    { id:'p03', name:'Satin Slip Dress',            category:'Dresses',     size:'S',        grade:'Grade A', colour:'Wine',      cost:12000, price:28500, qty:0,  photo:'', status:'sold out',   lowStock:3 },
    { id:'p04', name:'Ankara Peplum Top',           category:'Tops',        size:'M',        grade:'Grade B', colour:'Multi',     cost:6500,  price:15000, qty:12, photo:'', status:'available',  lowStock:4 },
    { id:'p05', name:'Ribbed Bodysuit',             category:'Tops',        size:'S',        grade:'Grade A', colour:'Black',     cost:4800,  price:12000, qty:9,  photo:'', status:'available',  lowStock:4 },
    { id:'p06', name:'Oversized Cotton Shirt',      category:'Tops',        size:'L',        grade:'Grade A', colour:'White',     cost:7000,  price:18500, qty:5,  photo:'', status:'available',  lowStock:3 },
    { id:'p07', name:'High-Waist Tailored Trousers',category:'Trousers',    size:'32',       grade:'Grade A', colour:'Charcoal',  cost:11000, price:26000, qty:4,  photo:'', status:'available',  lowStock:3 },
    { id:'p08', name:'Wide-Leg Denim',              category:'Trousers',    size:'30',       grade:'Grade B', colour:'Blue',      cost:9500,  price:22000, qty:7,  photo:'', status:'available',  lowStock:3 },
    { id:'p09', name:'Leather Block Heel',          category:'Shoes',       size:'39',       grade:'Grade A', colour:'Tan',       cost:22000, price:48000, qty:2,  photo:'', status:'available',  lowStock:3 },
    { id:'p10', name:'Strappy Sandals',             category:'Shoes',       size:'38',       grade:'Grade A', colour:'Gold',      cost:15000, price:34000, qty:5,  photo:'', status:'available',  lowStock:3 },
    { id:'p11', name:'Chunky Sneakers',             category:'Shoes',       size:'42',       grade:'Grade B', colour:'White',     cost:19000, price:39500, qty:3,  photo:'', status:'available',  lowStock:3 },
    { id:'p12', name:'Structured Tote Bag',         category:'Bags',        size:'One size', grade:'Premium', colour:'Cognac',    cost:26000, price:58000, qty:4,  photo:'', status:'available',  lowStock:2 },
    { id:'p13', name:'Mini Crossbody',              category:'Bags',        size:'One size', grade:'Grade A', colour:'Black',     cost:17000, price:38000, qty:6,  photo:'', status:'available',  lowStock:2 },
    { id:'p14', name:'Woven Raffia Bag',            category:'Bags',        size:'One size', grade:'Grade B', colour:'Natural',   cost:9000,  price:21000, qty:1,  photo:'', status:'available',  lowStock:2 },
    { id:'p15', name:'Gold Layered Necklace',       category:'Accessories', size:'One size', grade:'Grade A', colour:'Gold',      cost:3500,  price:9500,  qty:14, photo:'', status:'available',  lowStock:5 },
    { id:'p16', name:'Silk Head Wrap',              category:'Accessories', size:'One size', grade:'Grade A', colour:'Emerald',   cost:2800,  price:7500,  qty:11, photo:'', status:'available',  lowStock:5 },
    { id:'p17', name:'Statement Earrings',          category:'Accessories', size:'One size', grade:'Grade B', colour:'Brass',     cost:2200,  price:6500,  qty:8,  photo:'', status:'available',  lowStock:5 },
    { id:'p18', name:'Lace Aso-Ebi Set',            category:'Dresses',     size:'M',        grade:'Premium', colour:'Champagne', cost:38000, price:85000, qty:2,  photo:'', status:'available',  lowStock:2 }
  ],

  customers: [
    { id:'c01', name:'Chiamaka Obi',   phone:'0803 441 2098', location:'Lekki Phase 1', tags:['VIP','Retail'],    notes:'Prefers size M. Pays on delivery. Likes receiving new arrivals first.', createdAt:'2023-04-12' },
    { id:'c02', name:'Fatima Bello',   phone:'0812 667 3901', location:'Ikeja GRA',      tags:['Wholesale','VIP'], notes:'Bulk buyer. Wholesale price is agreed by the owner only — never quoted by the assistant.', createdAt:'2022-11-03' },
    { id:'c03', name:'Ngozi Eze',      phone:'0906 112 8834', location:'Surulere',       tags:['Retail'],          notes:'Asks for discounts often. Owner has not approved any discount.', createdAt:'2024-01-20' },
    { id:'c04', name:'Aisha Lawal',    phone:'0705 998 2210', location:'Yaba',           tags:['VIP'],             notes:'Shoes buyer, size 38–39. WhatsApp only.', createdAt:'2023-08-09' },
    { id:'c05', name:'Tolu Adeyemi',   phone:'0813 224 7765', location:'Ajah',           tags:['Retail'],          notes:'Prefers delivery to workplace in Victoria Island.', createdAt:'2024-02-14' },
    { id:'c06', name:'Blessing Okon',  phone:'0809 553 1177', location:'Festac',         tags:['Retail'],          notes:'Had a colour complaint in October — handle personally.', createdAt:'2023-06-27' },
    { id:'c07', name:'Halima Sani',    phone:'0902 771 4432', location:'Abuja',          tags:['Wholesale'],       notes:'Bulk orders with dispatch by bus. Confirms payment before dispatch.', createdAt:'2024-03-05' },
    { id:'c08', name:'Ifeoma Nwosu',   phone:'0806 340 9921', location:'Magodo',         tags:['VIP','Retail'],    notes:'Buys bags. Birthday in November — good time for a check-in.', createdAt:'2022-09-18' },
    { id:'c09', name:'Zainab Yusuf',   phone:'0703 887 5520', location:'Ikorodu',        tags:['Retail'],          notes:'New customer from Instagram.', createdAt: daysAgo(18) },
    { id:'c10', name:'Adaobi Umeh',    phone:'0814 209 6633', location:'Victoria Island',tags:['Wholesale'],       notes:'Resells in Port Harcourt. Wants invoices for every order.', createdAt: daysAgo(9) }
  ],

  staff: [
    { id:'u1', name:'Adeola Ogun',      role:'admin', email:'adeola@adeolacollections.demo', initials:'AO', colour:'#2F4F3E', since:'2021' },
    { id:'u2', name:'Amaka Nwachukwu',  role:'staff', email:'amaka@adeolacollections.demo', initials:'AN', colour:'#6B4E31', since:'2023' }
  ]
};

/* ---------- deterministic demo history ----------
   Seeded so the dashboard, charts and reports always reconcile.
   History is already reflected in the stock figures above; only
   sales you record inside the app reduce stock further. */
let _seed = 20261115;
function rnd(){ _seed = (_seed * 1664525 + 1013904223) % 4294967296; return _seed / 4294967296; }
function pick(arr){ return arr[Math.floor(rnd()*arr.length)]; }

const _prod = SEED.products;
const _cust = SEED.customers;
const _staffIds = ['u1','u2'];

function buildSales(){
  const out = [];
  const methods = ['Bank transfer','POS','Cash','Transfer'];
  const plan = [
    {d:0,c:1},{d:0,c:6},{d:0,c:2},
    {d:1,c:0},{d:1,c:3},{d:1,c:7},
    {d:2,c:4},{d:2,c:1},
    {d:3,c:5},{d:3,c:3},
    {d:4,c:0},{d:4,c:6},{d:4,c:8},
    {d:5,c:7},{d:6,c:3},{d:6,c:1},{d:7,c:4},{d:7,c:9},
    {d:8,c:2},{d:8,c:0},{d:9,c:5},{d:10,c:1},{d:10,c:3},
    {d:11,c:6},{d:12,c:8},{d:12,c:0},{d:13,c:4},{d:14,c:2},
    {d:15,c:9},{d:15,c:7},{d:16,c:1},{d:17,c:3},{d:18,c:5},
    {d:19,c:0},{d:20,c:4},{d:21,c:6},{d:22,c:2},{d:23,c:8},
    {d:25,c:1},{d:26,c:0},{d:27,c:5},{d:29,c:3},{d:30,c:7},
    {d:33,c:0},{d:35,c:4},{d:37,c:2},{d:39,c:6},{d:42,c:1},
    {d:45,c:5},{d:48,c:0},{d:52,c:3},{d:55,c:7},{d:58,c:2},
    {d:61,c:4},{d:64,c:0},{d:67,c:6},{d:71,c:1},{d:75,c:5},
    {d:79,c:2},{d:83,c:4},{d:87,c:0},
    /* previous period, so month-on-month comparisons stay believable */
    {d:31,c:2},{d:32,c:5},{d:32,c:0},{d:34,c:7},{d:34,c:3},{d:36,c:1},
    {d:36,c:6},{d:38,c:4},{d:38,c:0},{d:40,c:8},{d:41,c:2},{d:43,c:5},
    {d:44,c:1},{d:46,c:9},{d:47,c:3},{d:49,c:0},{d:50,c:6},{d:53,c:2},
    {d:54,c:4},{d:57,c:7},{d:59,c:1},{d:60,c:5}
  ];
  plan.forEach((p, idx) => {
    const nItems = rnd() > .62 ? 2 : 1;
    const items = [];
    for (let i=0;i<nItems;i++){
      const prod = _prod[Math.floor(rnd()*_prod.length)];
      if (items.some(x=>x.productId===prod.id)) continue;
      const qty = rnd() > .88 ? 2 : 1;
      items.push({ productId: prod.id, name: prod.name, qty, unitPrice: prod.price, cost: prod.cost });
    }
    if (!items.length){ const prod=_prod[0]; items.push({productId:prod.id,name:prod.name,qty:1,unitPrice:prod.price,cost:prod.cost}); }
    const subtotal = items.reduce((s,i)=>s+i.qty*i.unitPrice,0);
    const discount = rnd() > .85 ? Math.round(subtotal * .05 / 100) * 100 : 0;
    const total = subtotal - discount;
    const roll = rnd();
    let paid = total;
    if (roll > .82) paid = Math.round(total * .5);
    else if (roll > .74) paid = 0;
    const aiAssisted = idx % 4 === 1;
    out.push({
      id: 'temp',
      date: daysAgo(p.d),
      customerId: _cust[p.c].id,
      items, discount, paid,
      method: pick(methods),
      staffId: aiAssisted ? 'u1' : pick(_staffIds),
      aiAssisted,
      note: ''
    });
  });
  out.sort((a,b)=> a.date < b.date ? -1 : 1);
  out.forEach((s,i)=>{ s.id = 'INV-' + String(1043 + i); });
  return out;
}

SEED.sales = buildSales();

/* ---------- reservations / draft orders created by the AI ---------- */
SEED.drafts = [
  {
    id:'DRF-208', customerId:'c01', createdAt: hoursAgo(3), expiresAt: hoursAgo(-21),
    items:[{ productId:'p01', qty:1, unitPrice:32000 }],
    status:'awaiting_approval', createdBy:'AI', channel:'WhatsApp',
    delivery:'Pickup at Ikeja store',
    note:'Customer asked to hold the Adire Wrap Dress in M until Saturday.'
  },
  {
    id:'DRF-207', customerId:'c04', createdAt: hoursAgo(26), expiresAt: hoursAgo(2),
    items:[{ productId:'p10', qty:1, unitPrice:34000 }],
    status:'expired', createdBy:'AI', channel:'WhatsApp',
    delivery:'Deliver to Yaba',
    note:'Hold expired — customer did not confirm.'
  }
];

/* ---------- customer conversations ---------- */
SEED.conversations = [
  {
    id:'cnv-01', customerId:'c01', channel:'WhatsApp', status:'ai',
    unread:2, lastAt: hoursAgo(0.4), startedAt: hoursAgo(3),
    summary:'Asked about the Adire Wrap Dress in size M, price and Saturday pickup. AI quoted ₦32,000, confirmed 6 in stock and created a draft hold for approval.',
    needsAttention:true, attentionReason:'Draft order awaiting approval',
    messages:[
      { from:'customer', text:'Good evening. Do you have the adire dress in medium?', at: hoursAgo(3) },
      { from:'ai', text:'Good evening! Yes — the Adire Wrap Dress in M is available at ₦32,000. It is indigo, Grade A. We have 6 in stock. Would you like me to hold one for you?', at: hoursAgo(2.9), tools:['lookup_inventory("adire dress", size M) → 1 match','quote_price(p01) → ₦32,000'] },
      { from:'customer', text:'I like it. Can I pick up on Saturday?', at: hoursAgo(2.6) },
      { from:'ai', text:'Yes. I can hold one for you until Saturday closing (7pm). Please send your full name and phone number so I can prepare it. — store virtual assistant', at: hoursAgo(2.55), tools:['create_reservation(p01, qty 1, 48h) → DRF-208','create_draft_order(DRF-208)'] },
      { from:'customer', text:'Chiamaka Obi, 0803 441 2098', at: hoursAgo(0.6) },
      { from:'ai', text:'Thank you Chiamaka. I have saved your details and created a hold — reference DRF-208. A staff member will confirm it shortly. Payment is made in store or by transfer; I cannot confirm payments myself.', at: hoursAgo(0.5), tools:['create_customer(Chiamaka Obi) → c01 (existing)','link_conversation(c01)'] }
    ]
  },
  {
    id:'cnv-02', customerId:'c02', channel:'WhatsApp', status:'waiting',
    unread:1, lastAt: hoursAgo(1.2), startedAt: hoursAgo(1.4),
    summary:'Wholesale request for 20 pieces across three styles. AI escalated: bulk pricing must be agreed by the owner.',
    needsAttention:true, attentionReason:'Bulk order — needs owner pricing',
    messages:[
      { from:'customer', text:'I want to buy 20 pieces for my shop. What is your wholesale price?', at: hoursAgo(1.4) },
      { from:'ai', text:'Thank you for reaching out. I can confirm stock, but wholesale prices are agreed by the owner — I cannot quote a bulk price myself. I have passed this to Adeola now, and she will reply with a price. — store virtual assistant', at: hoursAgo(1.35), tools:['escalate_to_human(reason: bulk order)','lookup_inventory(category: all) → 18 products'] },
      { from:'customer', text:'Okay, I will wait. I need Ankara tops and two dresses.', at: hoursAgo(1.2) }
    ]
  },
  {
    id:'cnv-03', customerId:'c05', channel:'WhatsApp', status:'ai',
    unread:0, lastAt: hoursAgo(5), startedAt: hoursAgo(5.4),
    summary:'Asked for delivery cost to Ajah. AI quoted the saved delivery policy and gave business hours.',
    needsAttention:false, attentionReason:'',
    messages:[
      { from:'customer', text:'How much is delivery to Ajah?', at: hoursAgo(5.4) },
      { from:'ai', text:'Delivery to Ajah (Lagos mainland) is ₦2,500 and usually arrives the same or next working day. We are open Mon–Sat, 9am–7pm. — store virtual assistant', at: hoursAgo(5.35), tools:['get_business_info(delivery_zones) → mainland ₦2,500'] },
      { from:'customer', text:'Thank you', at: hoursAgo(5) }
    ]
  },
  {
    id:'cnv-04', customerId:'c06', channel:'WhatsApp', status:'staff',
    unread:0, lastAt: hoursAgo(28), startedAt: hoursAgo(30),
    summary:'Colour complaint on a bag delivered last week. Amaka handled it and offered an exchange under the 48-hour policy.',
    needsAttention:false, attentionReason:'',
    messages:[
      { from:'customer', text:'The bag I received is brown, I ordered black. I am not happy.', at: hoursAgo(30) },
      { from:'ai', text:'I am sorry about that. A complaint like this needs a person, so I have alerted the store team. — store virtual assistant', at: hoursAgo(29.9), tools:['escalate_to_human(reason: complaint)'] },
      { from:'staff', text:'Good afternoon Blessing, this is Amaka from Adeola Collections. I am sorry about the mix-up. Please bring it in this week and we will exchange it for the black one — it is still in stock.', at: hoursAgo(28.4), who:'Amaka' },
      { from:'customer', text:'Thank you Amaka, I will come on Friday.', at: hoursAgo(28) }
    ]
  },
  {
    id:'cnv-05', customerId:'c04', channel:'Call', status:'ai',
    unread:0, lastAt: hoursAgo(7), startedAt: hoursAgo(7.1),
    summary:'Inbound call after hours. Customer asked if chunky sneakers in size 42 were available. AI confirmed 3 in stock at ₦39,500 and read the store address. Transcript logged.',
    needsAttention:false, attentionReason:'',
    messages:[
      { from:'customer', text:'[voice] Hello? Do you have those white sneakers in 42?', at: hoursAgo(7.1) },
      { from:'ai', text:'[voice] Hello, you have reached Adeola Collections. This is the store virtual assistant. Yes — the Chunky Sneakers in size 42 are available at ₦39,500. We have 3 pairs. We are at 12 Allen Avenue, Ikeja, open Monday to Saturday, 9am to 7pm.', at: hoursAgo(7.08), tools:['speech_to_text() → intent: product_availability','lookup_inventory("chunky sneakers", size 42) → 3 in stock','text_to_speech(reply)'] },
      { from:'customer', text:'[voice] Okay, I will come tomorrow.', at: hoursAgo(7.02) },
      { from:'ai', text:'[voice] See you tomorrow. Thank you for calling Adeola Collections. Goodbye.', at: hoursAgo(7) }
    ]
  },
  {
    id:'cnv-06', customerId:'c03', channel:'WhatsApp', status:'waiting',
    unread:1, lastAt: hoursAgo(2.2), startedAt: hoursAgo(2.4),
    summary:'Asked for a discount on the linen set. AI explained no discount is authorised and offered a human follow-up.',
    needsAttention:true, attentionReason:'Discount request — owner decision',
    messages:[
      { from:'customer', text:'Last price for the linen two piece? Any discount?', at: hoursAgo(2.4) },
      { from:'ai', text:'The Linen Two-Piece Set is ₦42,000 and I am not able to give a discount — only the owner can approve that. I have flagged your chat so she can respond. — store virtual assistant', at: hoursAgo(2.35), tools:['guardrail_check(discount) → max 0%','escalate_to_human(reason: discount request)','lookup_inventory("linen two-piece") → 3 in stock'] },
      { from:'customer', text:'Okay I will wait for her.', at: hoursAgo(2.2) }
    ]
  },
  {
    id:'cnv-07', customerId:'c09', channel:'WhatsApp', status:'ai',
    unread:0, lastAt: hoursAgo(19), startedAt: hoursAgo(19.3),
    summary:'New customer asked whether the satin slip dress was available. AI confirmed sold out, suggested two similar dresses, and saved her as a contact.',
    needsAttention:false, attentionReason:'',
    messages:[
      { from:'customer', text:'Hi, is the satin slip dress still available?', at: hoursAgo(19.3) },
      { from:'ai', text:'Hello! The Satin Slip Dress in Wine is sold out at the moment. Similar options in stock: the Adire Wrap Dress (₦32,000, size M) and the Linen Two-Piece Set (₦42,000, size L). Would you like details on either? — store virtual assistant', at: hoursAgo(19.25), tools:['lookup_inventory("satin slip dress") → 0 in stock','suggest_similar(category: Dresses) → p01, p02','create_customer("Zainab Yusuf") → c09 (new)'] },
      { from:'customer', text:'Send me the linen one please', at: hoursAgo(19.1) },
      { from:'ai', text:'The Linen Two-Piece Set is ₦42,000, size L, sand colour, Grade A. 3 available. I can reserve one for 24 hours if you like. — store virtual assistant', at: hoursAgo(19.05), tools:['lookup_inventory(p02) → 3 in stock'] },
      { from:'customer', text:'I will think about it', at: hoursAgo(19) }
    ]
  }
];

/* ---------- settings ---------- */
SEED.settings = {
  ai: {
    enabled: true,
    scheduleMode: 'after-hours',      // always | after-hours | off
    startTime: '18:00',
    endTime: '08:00',
    weekends: true,
    maxDiscountPct: 0,
    requireApprovalAbove: 50000,
    escalateUnknown: true,
    voiceEnabled: true,
    languages: ['English', 'Nigerian Pidgin'],
    tone: 'Warm, brief, no emoji unless the customer uses one first',
    greeting: 'Good day, you are chatting with the Adeola Collections virtual assistant. How can I help you today?'
  },
  alerts: { lowStock: true, notifyOwner: true, channel: 'WhatsApp' },
  backup: { frequency: 'Daily', time: '22:00', lastRun: hoursAgo(13), keep: 30 },
  privacy: { optOut: true, retentionMonths: 24, consent: 'Customers are told they are chatting with a virtual assistant and can ask for a human at any time.' }
};

/* ---------- activity log (seeded) ---------- */
SEED.activity = [
  { id:'a1', at: hoursAgo(0.5), actor:'AI Assistant', type:'ai', action:'Created draft order DRF-208', detail:'Adire Wrap Dress ×1 · Chiamaka Obi · hold awaiting approval' },
  { id:'a2', at: hoursAgo(1.3), actor:'AI Assistant', type:'ai', action:'Escalated conversation', detail:'Bulk pricing request from Fatima Bello — needs owner' },
  { id:'a3', at: hoursAgo(2.4), actor:'AI Assistant', type:'guardrail', action:'Declined discount request', detail:'Ngozi Eze asked for a discount on Linen Two-Piece Set. Max discount is 0%.' },
  { id:'a4', at: hoursAgo(4.2), actor:'Amaka Nwachukwu', type:'sale', action:'Recorded sale INV-1105', detail:'₦42,000 · part payment ₦21,000 · Ajah delivery' },
  { id:'a5', at: hoursAgo(6.1), actor:'Adeola Ogun', type:'inventory', action:'Restocked Linen Two-Piece Set', detail:'Quantity 1 → 3 · cost price unchanged' },
  { id:'a6', at: hoursAgo(13), actor:'System', type:'system', action:'Automatic backup completed', detail:'Products, customers, sales and conversations · 30-day retention' },
  { id:'a7', at: hoursAgo(25), actor:'AI Assistant', type:'ai', action:'Answered a call', detail:'Aisha Lawal · stock check for size 42 sneakers · transcript saved' },
  { id:'a8', at: hoursAgo(29), actor:'Amaka Nwachukwu', type:'customer', action:'Updated customer note', detail:'Blessing Okon — colour complaint, exchange agreed' },
  { id:'a9', at: hoursAgo(36), actor:'Adeola Ogun', type:'settings', action:'Changed AI schedule', detail:'After-hours cover now starts at 18:00 and includes weekends' }
];

/* ---------- derived helpers used across the app ---------- */
function productById(id){ return SEED.products.find(p => p.id === id) || null; }
function customerById(id){ return SEED.customers.find(c => c.id === id) || null; }
function staffById(id){ return SEED.staff.find(u => u.id === id) || { name:'—', initials:'—', colour:'#4B4D42' }; }
