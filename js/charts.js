/* ============================================================
   Charts — dependency-free SVG, themed by CSS variables.
   Every series comes straight from Calc, so charts and tables
   can never disagree.
   ============================================================ */
'use strict';

const Chr = {
  _niceMax(v){
    if (v <= 0) return 1000;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / pow;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * pow;
  },

  /* Smooth-ish area + line with a hover hit-strip per point */
  area(data, opts){
    const o = Object.assign({ value:'revenue', height:230, label:'Revenue', fmt: shortMoney, ticks:4 }, opts || {});
    const W = 720, H = o.height, padL = 46, padR = 8, padT = 12, padB = 26;
    const iw = W - padL - padR, ih = H - padT - padB;
    const vals = data.map(d => d[o.value] || 0);
    const max = Chr._niceMax(Math.max.apply(null, vals.concat([1])));
    const x = i => padL + (data.length <= 1 ? iw/2 : (i / (data.length - 1)) * iw);
    const y = v => padT + ih - (v / max) * ih;

    let grid = '';
    for (let i = 0; i <= o.ticks; i++){
      const gy = padT + (ih / o.ticks) * i;
      const gv = max - (max / o.ticks) * i;
      grid += '<line class="grid-line" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '"/>';
      grid += '<text x="' + (padL - 8) + '" y="' + (gy + 3.5).toFixed(1) + '" text-anchor="end">' + o.fmt(gv) + '</text>';
    }

    let line = '', areaPath = '', hits = '', dots = '';
    data.forEach((d, i) => {
      const px = x(i), py = y(d[o.value] || 0);
      line += (i === 0 ? 'M' : 'L') + px.toFixed(1) + ' ' + py.toFixed(1) + ' ';
      if (i === 0) areaPath = 'M' + px.toFixed(1) + ' ' + (padT + ih);
      areaPath += 'L' + px.toFixed(1) + ' ' + py.toFixed(1);
    });
    if (data.length){
      areaPath += 'L' + x(data.length - 1).toFixed(1) + ' ' + (padT + ih) + 'Z';
      const last = data[data.length - 1];
      dots = '<circle class="point" cx="' + x(data.length-1).toFixed(1) + '" cy="' + y(last[o.value]||0).toFixed(1) + '" r="3"/>';
      data.forEach((d,i) => {
        const px = x(i), py = y(d[o.value]||0);
        dots += '<circle class="point point--hover" data-hover-dot cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="3" opacity="0"/>';
      });
    }
    const step = Math.max(1, Math.ceil(data.length / 8));
    let labels = '';
    data.forEach((d,i) => {
      if (i % step !== 0 && i !== data.length - 1) return;
      labels += '<text class="x-lbl' + (i % 2 ? ' x-lbl--alt' : '') + '" x="' + x(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(d.label) + '</text>';
    });
    const stripW = data.length > 1 ? iw / (data.length - 1) : iw;
    data.forEach((d,i) => {
      const px = x(i);
      const tip = d.label + ' · ' + o.label + ' ' + money(d[o.value] || 0) + (d.orders !== undefined ? ' · ' + d.orders + ' sale' + (d.orders === 1 ? '' : 's') : '');
      hits += '<rect class="hit" x="' + (px - stripW/2).toFixed(1) + '" y="' + padT + '" width="' + stripW.toFixed(1) + '" height="' + ih + '" data-tip="' + esc(tip) + '" data-dot="' + i + '"/>';
    });

    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label) + ' chart">' +
      grid + '<path class="area-fill" d="' + areaPath + '"/>' +
      '<path class="line-path" d="' + line + '"/>' + dots + hits + labels +
      '</svg>';
  },

  /* Vertical bars */
  bars(data, opts){
    const o = Object.assign({ value:'revenue', height:220, label:'Revenue', fmt: shortMoney, ticks:4, color:'bar', labelsEvery:0 }, opts || {});
    const W = 720, H = o.height, padL = 46, padR = 8, padT = 12, padB = 26;
    const iw = W - padL - padR, ih = H - padT - padB;
    const max = Chr._niceMax(Math.max.apply(null, data.map(d => d[o.value] || 0).concat([1])));
    const slot = data.length ? iw / data.length : iw;
    const bw = Math.max(2, Math.min(26, slot * .62));
    let grid = '';
    for (let i = 0; i <= o.ticks; i++){
      const gy = padT + (ih / o.ticks) * i;
      grid += '<line class="grid-line" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '"/>';
      grid += '<text x="' + (padL - 8) + '" y="' + (gy + 3.5).toFixed(1) + '" text-anchor="end">' + o.fmt(max - (max/o.ticks)*i) + '</text>';
    }
    let bars = '', labels = '';
    const step = o.labelsEvery || Math.max(1, Math.ceil(data.length / 8));
    data.forEach((d, i) => {
      const v = d[o.value] || 0;
      const h = max ? (v / max) * ih : 0;
      const bx = padL + slot * i + (slot - bw) / 2;
      bars += '<rect class="' + o.color + '" x="' + bx.toFixed(1) + '" y="' + (padT + ih - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0,h).toFixed(1) + '" rx="2" data-tip="' + esc(d.label + ' · ' + o.label + ' ' + money(v)) + '"/>';
      if (i % step === 0 || i === data.length - 1){
        labels += '<text class="x-lbl' + (i % 2 ? ' x-lbl--alt' : '') + '" x="' + (padL + slot * i + slot/2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(d.label) + '</text>';
      }
    });
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label) + ' chart">' + grid + bars + labels + '</svg>';
  },

  donut(segments, opts){
    const o = Object.assign({ size:160, thickness:14, centerLabel:'', centerSub:'' }, opts || {});
    const size = o.size, r = size/2 - o.thickness/2, c = size/2;
    const total = sum(segments, s => s.value) || 1;
    let angle = -Math.PI/2, paths = '';
    segments.forEach(s => {
      const frac = s.value / total;
      const a2 = angle + frac * Math.PI * 2;
      const large = frac > .5 ? 1 : 0;
      const x1 = c + r * Math.cos(angle), y1 = c + r * Math.sin(angle);
      const x2 = c + r * Math.cos(a2), y2 = c + r * Math.sin(a2);
      if (frac > 0){
        paths += '<path d="M' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2) + '" fill="none" stroke="' + (s.color || 'var(--accent)') + '" stroke-width="' + o.thickness + '" stroke-linecap="butt"/>';
      }
      angle = a2;
    });
    return '<svg class="chart" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img" aria-label="' + esc(o.centerLabel) + '">' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="var(--surface-3)" stroke-width="' + o.thickness + '"/>' +
      paths +
      (o.centerLabel ? '<text x="' + c + '" y="' + (c - 2) + '" text-anchor="middle" class="donut-center">' + esc(o.centerLabel) + '</text>' : '') +
      (o.centerSub ? '<text x="' + c + '" y="' + (c + 13) + '" text-anchor="middle" style="font-size:9.5px;fill:var(--muted)">' + esc(o.centerSub) + '</text>' : '') +
      '</svg>';
  },

  mini(values, opts){
    const o = Object.assign({ width:120, height:30, color:'var(--accent)' }, opts || {});
    const max = Math.max.apply(null, values.concat([1]));
    const min = Math.min.apply(null, values.concat([0]));
    const span = max - min || 1;
    const pts = values.map((v,i) => {
      const x = (i / Math.max(1, values.length - 1)) * o.width;
      const y = o.height - ((v - min) / span) * (o.height - 4) - 2;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return '<svg viewBox="0 0 ' + o.width + ' ' + o.height + '" width="' + o.width + '" height="' + o.height + '" aria-hidden="true" style="overflow:visible">' +
      '<polyline points="' + pts + '" fill="none" stroke="' + o.color + '" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  },

  /* Horizontal category bars, plain HTML for crisp text */
  categoryList(rows, opts){
    const o = Object.assign({ max: 0 }, opts || {});
    const max = o.max || Math.max.apply(null, rows.map(r => r.revenue).concat([1]));
    return '<div class="bars">' + rows.map(r =>
      '<div class="bars__row">' +
        '<span class="bars__label">' + esc(r.category) + '</span>' +
        '<span class="bars__value">' + compact(r.revenue) + '</span>' +
        '<span class="bars__track"><span class="bars__fill" style="width:' + clamp((r.revenue/max)*100, 2, 100).toFixed(1) + '%"></span></span>' +
      '</div>'
    ).join('') + '</div>';
  }
};

/* tooltip wiring (delegated once) */
function initChartTips(){
  let tip = document.querySelector('.chart-tip');
  if (!tip){
    tip = document.createElement('div');
    tip.className = 'chart-tip';
    document.body.appendChild(tip);
  }
  document.addEventListener('mousemove', (e) => {
    const t = e.target.closest ? e.target.closest('[data-tip]') : null;
    if (!t){ tip.classList.remove('is-on'); return; }
    tip.textContent = t.getAttribute('data-tip');
    tip.classList.add('is-on');
    tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 10, e.clientX + 12) + 'px';
    tip.style.top = (e.clientY - 34) + 'px';
  });
}
