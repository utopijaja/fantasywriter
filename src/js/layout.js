// Gemeinsames Seitenlayout für Editor und PDF-Export (alle Maße in mm, Seite fest A5)
export const MM = 96 / 25.4;
export const PAGE = { w: 148, h: 210, mt: 20, mb: 22, ml: 17, mr: 17 };
export const CW = PAGE.w - PAGE.ml - PAGE.mr;
export const CH = PAGE.h - PAGE.mt - PAGE.mb;
const WRAP = 3;   // Abstand Text–Bild
const MINW = 28;  // schmalere Textspalten werden nicht gesetzt
const SHY = /\u00AD/g;

export const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const fileUrl = (dir, name) => ('file://' + dir.split('/').map(encodeURIComponent).join('/') + '/' + encodeURIComponent(name)).replace(/'/g, '%27');
export const fontCss = f => (!f || /^(serif|sans-serif|monospace)$/.test(f)) ? (f || 'serif') : `"${f.replace(/["\\]/g, '')}", serif`;
const r3 = n => Math.round(n * 1000) / 1000;

// Breitester freier Streifen neben den Bildern eines Bandes
function widest(rects) {
  const xs = rects.map(r => [Math.max(0, r.x0), Math.min(CW, r.x1)]).sort((p, q) => p[0] - q[0]);
  let best = [0, 0], cur = 0;
  for (const [x0, x1] of xs) {
    if (x0 - cur > best[1] - best[0]) best = [cur, x0];
    cur = Math.max(cur, x1);
  }
  if (CW - cur > best[1] - best[0]) best = [cur, CW];
  return best[1] - best[0] < MINW ? [CW, CW] : best;
}

/* Der Text läuft als ein durchgehender Fluss über alle Seiten. Unsichtbare Floats
   sperren die Seitenränder (Seitenumbruch) und die Bildflächen (Textumfluss). */
export function exclusionHTML(pages, gap, images) {
  let out = '';
  const band = (h, a, r) => { out += `<div class="xl" style="height:${r3(h)}mm;width:${r3(a)}mm"></div><div class="xr" style="height:${r3(h)}mm;width:${r3(r)}mm"></div>`; };
  const cl = v => Math.min(CH, Math.max(0, v));
  for (let p = 0; p < pages; p++) {
    const rects = images.filter(i => i.page === p)
      .map(i => ({ x0: i.x - PAGE.ml - WRAP, x1: i.x + i.w - PAGE.ml + WRAP, y0: cl(i.y - PAGE.mt - WRAP), y1: cl(i.y + i.h - PAGE.mt + WRAP) }))
      .filter(r => r.x1 > 0 && r.x0 < CW && r.y1 > r.y0);
    const ys = [...new Set([0, CH, ...rects.flatMap(r => [r.y0, r.y1])])].sort((a, b) => a - b);
    const bands = [];
    for (let k = 0; k < ys.length - 1; k++) {
      const y0 = ys[k], y1 = ys[k + 1];
      const [a, b] = widest(rects.filter(r => r.y0 < y1 && r.y1 > y0));
      const last = bands[bands.length - 1];
      if (last && last.a === a && last.b === b) last.h += y1 - y0; else bands.push({ h: y1 - y0, a, b });
    }
    for (const b of bands) band(b.h, b.a, CW - b.b);
    band(PAGE.mb + gap + PAGE.mt, CW, 0);
  }
  return out;
}

export function sheetsHTML(pages, { startPage, bookTitle, chapterTitle }) {
  let out = '';
  for (let p = 0; p < pages; p++) {
    const no = startPage + p;
    const head = p === 0 ? '' : (no % 2 ? chapterTitle : bookTitle);
    out += `<div class="sheet"><div class="sheet-head">${esc(head)}</div><div class="sheet-num">${no}</div></div>`;
  }
  return out;
}

export function pagesNeeded(flow, gap) {
  const ed = flow.querySelector('.editor');
  const bottom = ed.offsetTop + ed.offsetHeight;
  return Math.max(1, Math.floor((bottom - 1) / ((PAGE.h + gap) * MM)) + 1);
}

export const stripShy = s => s.replace(SHY, '');
function textNodes(el) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), out = [];
  while (w.nextNode()) out.push(w.currentNode);
  return out;
}
export function hyphenateEl(el, lang) {
  for (const n of textNodes(el)) {
    const t = window.api.hyphenate(stripShy(n.data), lang);
    if (t !== n.data) n.data = t;
  }
}
export function unhyphenateEl(el) {
  for (const n of textNodes(el)) if (n.data.includes('\u00AD')) n.data = stripShy(n.data);
}

export function imagesHTML(images, gap, dir) {
  return images.map(i => `<div class="pimg" data-id="${esc(i.id)}" style="left:${r3(i.x)}mm;top:${r3(i.page * (PAGE.h + gap) + i.y)}mm;width:${r3(i.w)}mm;height:${r3(i.h)}mm"><img src="${fileUrl(dir, i.file)}" draggable="false" alt=""></div>`).join('');
}

// Stellt ein Kapitel fest auf (für den Export). Gibt die Seitenzahl zurück.
export function renderStatic(root, { html, title, images, gap, startPage, bookTitle, dir, lang }) {
  root.className = 'pages';
  root.style.setProperty('--gap', gap + 'mm');
  root.innerHTML = `<div class="sheets"></div><div class="flow"><div class="excl"></div><h1 class="chtitle">${esc(title)}</h1><div class="editor" lang="${lang}">${html}</div></div><div class="imgs">${imagesHTML(images, gap, dir)}</div>`;
  const flow = root.querySelector('.flow'), excl = flow.querySelector('.excl');
  hyphenateEl(flow.querySelector('.editor'), lang);
  let built = 0, pages = 1;
  for (let i = 0; i < 8; i++) {
    if (built < pages + 1) { built = pages + 4; excl.innerHTML = exclusionHTML(built, gap, images); }
    const n = pagesNeeded(flow, gap);
    if (n === pages && built >= pages + 1) break;
    pages = n;
  }
  root.querySelector('.sheets').innerHTML = sheetsHTML(pages, { startPage, bookTitle, chapterTitle: title });
  return pages;
}
