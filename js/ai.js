/* ============================================================
   AI sales assistant — simulation engine.
   Rule-based locally, but modelled on the real production shape:
   intent → guardrail check → tool call(s) against live data →
   composed reply. Every tool call is logged so the owner can see
   exactly why the assistant said what it said.
   ============================================================ */
'use strict';

const AIEngine = {
  stop: ['do','you','have','is','the','a','an','in','of','for','my','me','i','want','need','please','and','to','on','with','how','much','what','which','are','there','any','still','available','size','colour','color','can','it','this','that','get','pls','abeg'],

  normalize(t){ return String(t||'').toLowerCase().replace(/[^\w\s₦-]/g,' ').replace(/\s+/g,' ').trim(); },

  isPidgin(text){
    const t = this.normalize(text);
    return /\b(abeg|wetin|dey|na|oya|sha|wahala|abi|nna|biko|how far|e go|no vex|shey|sef|plenti)\b/.test(t);
  },

  detectSize(text){
    const t = this.normalize(text);
    const words = { 'extra small':'XS', 'small':'S', 'medium':'M', 'large':'L', 'extra large':'XL' };
    for (const w in words){ if (t.indexOf(w) > -1) return words[w]; }
    const m = t.match(/\b(xs|s|m|l|xl|xxl)\b/);
    if (m) return m[1].toUpperCase();
    const shoe = t.match(/\b(3[6-9]|4[0-6])\b/);
    if (shoe) return shoe[1];
    const waist = t.match(/\b(2[89]|3[0-6])\b/);
    if (waist) return waist[1];
    return null;
  },

  detectColour(text){
    const t = this.normalize(text);
    return SEED.colours.find(c => t.indexOf(c.toLowerCase()) !== -1) || null;
  },

  detectCategory(text){
    const t = this.normalize(text);
    return SEED.categories.find(c => t.indexOf(c.toLowerCase().replace(/s$/,'')) !== -1) || null;
  },

  searchProducts(text){
    const t = this.normalize(text);
    const tokens = t.split(' ').filter(w => w.length > 2 && this.stop.indexOf(w) === -1);
    const size = this.detectSize(text);
    const colour = this.detectColour(text);
    const category = this.detectCategory(text);
    const scored = SEED.products.map(p => {
      const hay = this.normalize(p.name + ' ' + p.category + ' ' + p.colour + ' ' + p.grade + ' ' + p.size);
      let score = 0;
      tokens.forEach(tok => {
        if (hay.indexOf(tok) !== -1) score += 3;
        else if (hay.indexOf(tok.slice(0, Math.max(3, tok.length-2))) !== -1) score += 1;
      });
      if (category && p.category === category) score += 2;
      if (colour && p.colour.toLowerCase() === colour.toLowerCase()) score += 2;
      if (size && String(p.size).toUpperCase() === size) score += 3;
      return { p, score };
    }).filter(x => x.score > 0).sort((a,b) => b.score - a.score);
    return {
      matches: scored.map(x => x.p),
      size, colour, category,
      strong: scored.filter(x => x.score >= 3).map(x => x.p)
    };
  },

  money, 

  facts(p){
    return p.name + ' — ' + p.colour + ', ' + p.grade + ', size ' + p.size + ', ' + money(p.price);
  },

  /* phrase a stock answer honestly */
  stockAnswer(p){
    if (p.qty <= 0) return null;
    const free = Calc.availableNow ? Calc.availableNow(p) : p.qty;
    if (free <= 0) return null;
    return p.name + ' is available at ' + money(p.price) + ' (' + p.colour + ', ' + p.grade + ', size ' + p.size + '). ' + free + ' available.';
  },

  alternatives(excluded){
    return SEED.products
      .filter(p => p.qty > 0 && (!excluded || p.category === excluded))
      .sort((a,b) => b.qty - a.qty)
      .slice(0,2);
  },

  tool(name, args, result, ok){
    return { name, args, result, ok: ok !== false };
  },

  /* ---------------- main entry ---------------- */
  handle(text, ctx){
    ctx = ctx || {};
    const s = SEED.settings.ai;
    const raw = String(text || '').trim();
    const t = this.normalize(raw);
    const pidgin = this.isPidgin(raw);
    const tools = [];
    const out = { reply:'', tools, escalated:false, reason:'', draft:null, customer:null, intent:'unknown', guardrail:null, pidgin };

    if (!raw){ out.reply = 'Please type your question.'; return out; }

    /* --- hard guardrails first: these never depend on stock data --- */
    if (/\b(cost price|cost price\?|your profit|profit margin|how much did you buy|buying price)\b/.test(t)){
      tools.push(this.tool('guardrail_check(confidential)', t.slice(0,40), 'blocked: cost and profit are internal only', false));
      out.guardrail = 'privacy';
      out.intent = 'confidential';
      out.escalated = true;
      out.reason = 'Asked for cost price / profit';
      out.reply = 'I am not able to share buying prices or profit figures — that information belongs to the store owner. If you need a special price, I can ask her to speak with you.';
      return out;
    }

    if (/\b(paid|payment made|sent the money|transferred|i have paid|i don pay|transfer don land)\b/.test(t) && !/how (do|can) i pay|payment method|pay with/.test(t)){
      tools.push(this.tool('guardrail_check(payment)', 'customer claims payment', 'cannot confirm payment — staff must verify', false));
      out.guardrail = 'payment';
      out.intent = 'payment_claim';
      out.escalated = true;
      out.reason = 'Customer says they have paid — needs manual verification';
      out.reply = 'Thank you for letting me know. I cannot confirm payments myself — a staff member will check the account and confirm your order shortly. Please keep your transfer receipt.';
      return out;
    }

    if (/\b(other customer|who else bought|another customer|their number|her number|his number)\b/.test(t)){
      tools.push(this.tool('guardrail_check(privacy)', 'request for another customer', 'blocked: customer data is private', false));
      out.guardrail = 'privacy';
      out.intent = 'privacy';
      out.reply = 'I cannot share other customers\' details. If you need a reference or a receipt, I can ask a staff member to help you.';
      return out;
    }

    if (/\b(refund|complain|complaint|damaged|wrong (item|colour|color|size)|not happy|return the|exchange)\b/.test(t)){
      tools.push(this.tool('escalate_to_human(reason: complaint)', raw.slice(0,60), 'queued for staff', true));
      out.guardrail = 'escalation';
      out.intent = 'complaint';
      out.escalated = true;
      out.reason = 'Complaint or return — requires a person';
      out.reply = 'I am sorry about that. Complaints and returns are handled by a person, so I have alerted the store team and they will reply here shortly. Please keep the item and your receipt.';
      return out;
    }

    const discountAsk = /\b(discount|last price|reduce|negoti|cheaper|less price|final price|lower)\b/.test(t);
    if (discountAsk){
      const found = this.searchProducts(raw);
      const p = found.strong[0] || found.matches[0];
      const maxPct = Number(s.maxDiscountPct) || 0;
      out.guardrail = 'discount';
      out.intent = 'discount';
      out.escalated = true;
      if (maxPct > 0 && p){
        const off = Math.round((p.price * maxPct) / 100);
        tools.push(this.tool('guardrail_check(discount)', 'max authorised ' + maxPct + '%', 'within limit — staff must confirm', true));
        out.reason = 'Discount within authorised limit — staff confirmation needed';
        out.reply = p.name + ' is ' + money(p.price) + '. I can ask about up to ' + maxPct + '% off (about ' + money(off) + '), but a staff member has to confirm it before it is applied. I have flagged your chat for that.';
      } else {
        tools.push(this.tool('guardrail_check(discount)', 'max allowed ' + maxPct + '%', 'blocked: no discount authorised', false));
        out.reason = 'Discount request — owner approval needed';
        out.reply = (p ? p.name + ' is ' + money(p.price) + '. ' : '') +
          'I am not able to give a discount — only the owner can approve that, and no discount is authorised on my side. I have flagged your chat so she can reply personally.' +
          (pidgin ? ' No vex, she go answer you soon.' : '');
      }
      return out;
    }

    const bulk = /\b(wholesale|bulk|carton|dozen|resell|reseller)\b/.test(t) || /\b([6-9]|[1-9]\d+)\s*(pieces|pcs|units|of them)\b/.test(t);
    if (bulk){
      tools.push(this.tool('escalate_to_human(reason: bulk order)', raw.slice(0,60), 'queued for owner pricing', true));
      out.intent = 'bulk';
      out.escalated = true;
      out.reason = 'Bulk / wholesale pricing';
      out.reply = 'I can confirm what is in stock, but wholesale prices are set by the owner and I cannot quote them. I have passed your message to her — she will reply with a price.';
      return out;
    }

    if (/\b(custom|bespoke|tailor|sew|made to measure)\b/.test(t)){
      tools.push(this.tool('escalate_to_human(reason: custom order)', raw.slice(0,60), 'queued for owner', true));
      out.intent = 'custom';
      out.escalated = true;
      out.reason = 'Custom / made-to-measure request';
      out.reply = 'Custom orders are handled personally by the store. I have passed your message on with the details — someone will reply to you here.';
      return out;
    }

    /* --- business information --- */
    if (/\b(deliver|delivery|shipping|dispatch|send to|waybill)\b/.test(t)){
      tools.push(this.tool('get_business_info(delivery)', 'settings.delivery', SEED.business.delivery));
      out.intent = 'delivery';
      out.reply = 'Delivery: ' + SEED.business.delivery + ' You can also pick up at ' + SEED.business.address + '.';
      return out;
    }
    if (/\b(open|opening|close|closing|hours|what time|where are you|location|address|shop address)\b/.test(t) && !/\bdo you have\b/.test(t)){
      tools.push(this.tool('get_business_info(hours, address)', 'settings.business', SEED.business.hours + ' · ' + SEED.business.address));
      out.intent = 'store_info';
      out.reply = 'We are open ' + SEED.business.hours + '. Address: ' + SEED.business.address + '.';
      return out;
    }
    if (/\b(how (do|can) i pay|payment|pay with|account number|pos|transfer)\b/.test(t)){
      tools.push(this.tool('get_business_info(payment)', 'settings.payment', SEED.business.payment));
      out.intent = 'payment_info';
      out.reply = SEED.business.payment + ' A staff member confirms every payment before an order is released.';
      return out;
    }
    if (/\b(what do you sell|categories|types of|kind of)\b/.test(t)){
      tools.push(this.tool('list_categories()', '', SEED.categories.join(', ')));
      out.intent = 'catalogue';
      out.reply = 'We sell ' + SEED.categories.join(', ').toLowerCase() + '. Tell me the item and your size and I will check what is in stock.';
      return out;
    }

    /* --- reservations --- */
    if (/\b(reserve|hold|keep for me|book|pick up|pickup|come and pick)\b/.test(t)){
      return this.reserve(text, ctx, pidgin);
    }

    /* --- availability / price / product search --- */
    const found = this.searchProducts(raw);
    const best = found.strong[0] || found.matches[0];

    if (best){
      out.intent = 'product_enquiry';
      const askSize = found.size && String(best.size).toUpperCase() !== found.size;
      if (best.qty > 0 && !askSize){
        tools.push(this.tool('lookup_inventory("' + raw.slice(0,38) + '")', 'colour ' + (found.colour||'any') + ', size ' + (found.size||'any'), '1 match · ' + Calc.availableNow(best) + ' available'));
        tools.push(this.tool('quote_price(' + best.id + ')', '', money(best.price)));
        const answer = this.stockAnswer(best);
        if (!answer){
          out.escalated = true;
          out.reason = 'All units on hold — staff decision';
          out.reply = 'Every ' + best.name + ' in the shop is currently held for other customers, so I cannot promise you one. I have asked a staff member to check with you.';
          return out;
        }
        out.reply = answer + ' Would you like me to hold one for you?';
        if (pidgin) out.reply = 'Yes, e dey. ' + answer + ' You want make I hold one for you?';
        return out;
      }
      if (best.qty > 0 && askSize){
        const inSize = SEED.products.filter(p => p.name === best.name && String(p.size).toUpperCase() === found.size);
        tools.push(this.tool('lookup_inventory(size ' + found.size + ')', best.name, inSize.length ? 'size found' : 'size not held'));
        if (inSize.length && inSize[0].qty > 0 && this.stockAnswer(inSize[0])){
          out.reply = this.stockAnswer(inSize[0]) + ' Would you like me to hold it?';
          return out;
        }
        const alt = this.alternatives(best.category);
        out.reply = 'The ' + best.name + ' in size ' + found.size + ' is not in stock right now. I have size ' + best.size + ' at ' + money(best.price) + '. Similar options: ' +
          alt.map(p => this.facts(p)).join('; ') + '. Would you like details on any of these?';
        return out;
      }
      tools.push(this.tool('lookup_inventory("' + raw.slice(0,38) + '")', '', '0 in stock', true));
      const alt = this.alternatives(best.category);
      if (alt.length){
        tools.push(this.tool('suggest_similar(' + best.category + ')', '', alt.map(a=>a.id).join(', ')));
        out.reply = best.name + ' is sold out at the moment. Similar items in stock: ' + alt.map(p => this.facts(p)).join('; ') + '. Would you like details on either?';
        return out;
      }
      out.escalated = true;
      out.reason = 'Sold out with no alternative';
      out.reply = best.name + ' is sold out and I do not have a similar item to suggest. I have asked a staff member to follow up with you.';
      return out;
    }

    /* --- several possible products --- */
    if (found.matches.length > 1){
      out.intent = 'product_enquiry';
      tools.push(this.tool('lookup_inventory("' + raw.slice(0,38) + '")', '', found.matches.length + ' possible matches'));
      out.reply = 'I found these that may match: ' + found.matches.slice(0,3).map(p => this.facts(p) + (p.qty > 0 ? '' : ' (sold out)')).join('; ') + '. Which one do you mean?';
      return out;
    }

    /* --- price asked without a product --- */
    if (/\b(price|how much|cost)\b/.test(t)){
      tools.push(this.tool('lookup_inventory()', raw.slice(0,40), 'no product matched'));
      out.intent = 'price';
      out.escalated = true;
      out.reason = 'Price question without a clear product';
      out.reply = 'I could not tell which item you mean. Please send the item name — for example "linen two-piece" or "block heel" — and I will check the price and stock. I have also flagged this for a staff member.';
      return out;
    }

    /* --- greetings --- */
    if (/^(hi|hello|hey|good (morning|afternoon|evening)|how far)\b/.test(t) && t.split(' ').length <= 5){
      out.intent = 'greeting';
      out.reply = SEED.settings.ai.greeting + ' You can ask about stock, prices, sizes or delivery.';
      if (pidgin) out.reply = 'How far! You dey chat with the Adeola Collections virtual assistant. Ask me about stock, price, size or delivery.';
      return out;
    }

    if (/\b(human|agent|person|speak to|call me|manager|owner|staff)\b/.test(t)){
      out.intent = 'handoff';
      out.escalated = true;
      out.reason = 'Customer asked for a human';
      tools.push(this.tool('escalate_to_human(reason: requested)', '', 'queued for staff'));
      out.reply = 'Of course — I have asked a staff member to reply to you here. They usually respond within business hours.';
      return out;
    }

    /* --- fallback --- */
    out.intent = 'unknown';
    tools.push(this.tool('lookup_inventory()', raw.slice(0,40), 'no confident match'));
    if (SEED.settings.ai.escalateUnknown){
      out.escalated = true;
      out.reason = 'Unrecognised question';
      tools.push(this.tool('escalate_to_human(reason: unclear question)', '', 'queued for staff'));
      out.reply = 'I do not have that information in the store records, so I have asked a staff member to answer you. I will not guess at stock or prices.';
    } else {
      out.reply = 'I could not find that in the store records. Please ask about a product name, size, price, delivery or our opening hours.';
    }
    return out;
  },

  /* reservation flow — creates a real draft order the owner must approve */
  reserve(text, ctx, pidgin){
    const tools = [];
    const out = { reply:'', tools, escalated:false, reason:'', draft:null, customer:null, intent:'reservation', guardrail:null, pidgin };
    const found = this.searchProducts(text);
    const p = found.strong[0] || found.matches[0];
    if (!p){
      out.reply = 'Which item would you like me to hold? Please send the product name and your size.';
      return out;
    }
    if (p.qty <= 0){
      tools.push(this.tool('check_availability(' + p.id + ')', '', '0 in stock', true));
      out.reply = p.name + ' is sold out, so I cannot hold it. ' + (this.alternatives(p.category).map(a => this.facts(a)).join('; ') || '');
      return out;
    }
    if (Calc.availableNow(p) <= 0){
      tools.push(this.tool('check_availability(' + p.id + ')', '', 'all units already on hold', true));
      out.escalated = true;
      out.reason = 'All units on hold — staff decision';
      out.reply = 'Every ' + p.name + ' currently in the shop is already held for another customer. I cannot promise one, so I have asked a staff member to check with you.';
      return out;
    }
    const phoneMatch = String(text).match(/(?:\+?234|0)[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{4}/);
    const nameMatch = String(text).replace(/\s+/g,' ').match(/(?:my name is|i am|i'm|na)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
    let customer = ctx.customerId ? customerById(ctx.customerId) : null;

    if (!customer && phoneMatch){
      const phone = phoneMatch[0].trim();
      customer = SEED.customers.find(c => c.phone.replace(/\s/g,'') === phone.replace(/\s/g,''));
      if (!customer){
        customer = {
          id: uid('c'), name: nameMatch ? nameMatch[1] : 'WhatsApp customer',
          phone, location: 'Not provided', tags: ['Retail'], notes: 'Created automatically by the AI assistant.',
          createdAt: new Date().toISOString().slice(0,10)
        };
        SEED.customers.unshift(customer);
        tools.push(this.tool('create_customer', customer.name + ' · ' + customer.phone, 'saved as ' + customer.id));
      }
      out.customer = customer;
    }

    if (!customer){
      tools.push(this.tool('check_availability(' + p.id + ')', '', p.qty + ' in stock'));
      out.reply = p.name + ' is available at ' + money(p.price) + '. To hold one, please send your full name and phone number.';
      return out;
    }

    const draft = {
      id: nextDraftNo(),
      customerId: customer.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24*3600e3).toISOString(),
      items: [{ productId: p.id, qty: 1, unitPrice: p.price }],
      status: SEED.settings.ai.requireApprovalAbove >= 0 ? 'awaiting_approval' : 'approved',
      createdBy: 'AI',
      channel: 'WhatsApp',
      delivery: 'To be confirmed',
      note: 'Created from a chat by the AI assistant.'
    };
    SEED.drafts.unshift(draft);
    tools.push(this.tool('create_reservation(' + p.id + ', qty 1, 24h)', '', draft.id));
    tools.push(this.tool('create_draft_order(' + draft.id + ')', money(p.price), 'awaiting owner approval'));
    const conv = SEED.conversations.find(c => c.id === ctx.conversationId);
    if (conv){ conv.needsAttention = true; conv.attentionReason = 'Draft order awaiting approval'; conv.draftId = draft.id; }
    logActivity('Created draft order ' + draft.id, p.name + ' ×1 · ' + customer.name + ' · awaiting approval', 'ai');
    out.draft = draft;
    out.reply = 'I have held the ' + p.name + ' (' + p.size + ', ' + p.colour + ') for 24 hours under reference ' + draft.id + '. A staff member will confirm it. Payment is made in store or by transfer — I cannot confirm payments myself.';
    if (pidgin) out.reply = 'I don hold the ' + p.name + ' for you for 24 hours. Reference na ' + draft.id + '. Staff go confirm am.';
    return out;
  },

  /* scripted inbound call used by the voice tester */
  callScript(){
    const p = SEED.products.find(x => x.id === 'p11');
    return [
      { at:'00:00', speaker:'system', label:'Incoming call', text:'+234 705 998 2210 · answering with the store voice assistant', tools:[] },
      { at:'00:01', speaker:'ai', label:'Assistant', text:'Hello, you have reached ' + SEED.business.name + '. This is the store virtual assistant. How can I help you today?', tools:[] },
      { at:'00:05', speaker:'customer', label:'Caller', text:'Hello? Do you have those white sneakers in size 42?', tools:['speech_to_text'] },
      { at:'00:07', speaker:'ai', label:'Assistant', text:'Let me check the live stock for you.', tools:['lookup_inventory("chunky sneakers", size 42) → ' + p.qty + ' in stock'] },
      { at:'00:09', speaker:'ai', label:'Assistant', text:'Yes — the Chunky Sneakers in size 42 are available at ' + money(p.price) + '. We have ' + p.qty + ' pairs. Would you like me to keep one for you?', tools:['text_to_speech'] },
      { at:'00:16', speaker:'customer', label:'Caller', text:'Yes please. I will come tomorrow morning.', tools:['speech_to_text'] },
      { at:'00:19', speaker:'ai', label:'Assistant', text:'I have noted that. We open at 9am at ' + SEED.business.address + '. What is your name?', tools:[] },
      { at:'00:24', speaker:'customer', label:'Caller', text:'Aisha Lawal.', tools:['speech_to_text'] },
      { at:'00:26', speaker:'ai', label:'Assistant', text:'Thank you Aisha, your hold is saved. A staff member will confirm it. Goodbye.', tools:['create_customer(Aisha Lawal) → existing contact','log_call_summary'] }
    ];
  }
};
