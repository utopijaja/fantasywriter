import { MM, PAGE, exclusionHTML, sheetsHTML, pagesNeeded, imagesHTML, hyphenateEl, unhyphenateEl, stripShy, esc } from './layout.js';
import { $, S, api, uid, saveBookSoon, bookImg, setSettings } from './core.js';

const GAP = 8;
const SPAN = PAGE.h + GAP;
const pv = $('#pageview'), wrap = $('#pagewrap'), pagesEl = $('#pages');
const sheetsEl = $('.sheets', pagesEl), flow = $('.flow', pagesEl), excl = $('.excl', flow);
const titleEl = $('.chtitle', flow), ed = $('.editor', flow), imgsEl = $('.imgs', pagesEl);

let ch = null, meta = null, pages = 1, built = 0, active = null, zoom = 1;
let undo = [], undoIdx = 0, undoTimer = null, saveTimer = null, dirty = false, layoutQueued = false;
export let onMetaChange = () => {};
export const setOnMetaChange = fn => { onMetaChange = fn; };
const lang = () => (S.book && S.book.lang) || 'de';

/* ---------- Auswahl sichern (zählt ohne weiche Trennstriche, damit Trennung die Position nicht verschiebt) ---------- */
function blockOf(node) {
  while (node && node.parentNode !== ed) node = node.parentNode;
  return node && node.nodeType === 1 ? node : null;
}
function pointOf(node, offset) {
  const b = blockOf(node);
  if (!b) return null;
  const r = document.createRange();
  r.setStart(b, 0); r.setEnd(node, offset);
  return { i: [...ed.children].indexOf(b), o: stripShy(r.toString()).length };
}
function saveSel() {
  const s = getSelection();
  if (!s.rangeCount || !ed.contains(s.anchorNode) || !ed.contains(s.focusNode)) return null;
  const a = pointOf(s.anchorNode, s.anchorOffset), f = pointOf(s.focusNode, s.focusOffset);
  return a && f ? { a, f } : null;
}
function resolve(p) {
  const b = ed.children[Math.min(p.i, ed.children.length - 1)];
  if (!b) return [ed, 0];
  const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
  let left = p.o, last = null;
  while (w.nextNode()) {
    const n = w.currentNode, d = n.data;
    let clean = 0, raw = 0;
    for (; raw < d.length && clean < left; raw++) if (d[raw] !== '­') clean++;
    if (clean === left) return [n, raw];
    left -= clean; last = n;
  }
  return last ? [last, last.data.length] : [b, 0];
}
function restoreSel(sel) {
  if (!sel) return;
  const [an, ao] = resolve(sel.a), [fn, fo] = resolve(sel.f);
  getSelection().setBaseAndExtent(an, ao, fn, fo);
}

/* ---------- Silbentrennung: überall außer im Absatz, in dem gerade geschrieben wird ---------- */
document.addEventListener('selectionchange', () => {
  if (!ch) return;
  const s = getSelection();
  const b = s.rangeCount && ed.contains(s.focusNode) ? blockOf(s.focusNode) : null;
  if (b === active) return;
  const old = active, sel = saveSel();
  active = b;
  if (old && old.isConnected) hyphenateEl(old, lang());
  if (b) unhyphenateEl(b);
  restoreSel(sel);
  queueLayout();
});

// Nach dem Einfügen mehrerer Absätze: alle außer dem aktiven trennen
function hyphenateOthers() {
  const sel = saveSel();
  for (const b of ed.children) if (b !== active) hyphenateEl(b, lang());
  restoreSel(sel);
}

/* ---------- Seitenaufbau ---------- */
function startPage() {
  let n = 1;
  for (const c of S.book.chapters) { if (c.id === meta.id) break; n += c.pages || 1; }
  return n;
}
function layout(rebuild) {
  if (!ch || pv.hidden) return; // versteckt lässt sich nichts messen
  const minPages = Math.max(1, ...ch.images.map(i => i.page + 1));
  let n = pages;
  for (let i = 0; i < 8; i++) {
    if (rebuild || built < n + 1) { built = n + 4; excl.innerHTML = exclusionHTML(built, GAP, ch.images); rebuild = false; }
    const need = Math.max(minPages, pagesNeeded(flow, GAP));
    if (need === n && built >= n + 1) break;
    n = need;
  }
  pages = n;
  if (meta.pages !== n) { meta.pages = n; saveBookSoon(); onMetaChange(); }
  renderSheets();
}
function renderSheets() {
  const key = [pages, startPage(), S.book.title, meta.title].join('|');
  if (sheetsEl.dataset.key !== key) {
    sheetsEl.dataset.key = key;
    sheetsEl.innerHTML = sheetsHTML(pages, { startPage: startPage(), bookTitle: S.book.title, chapterTitle: meta.title });
  }
  pagesEl.style.transform = `scale(${zoom})`;
  wrap.style.width = PAGE.w * MM * zoom + 'px';
  wrap.style.height = pages * SPAN * MM * zoom + 'px';
  const words = (stripShy(ed.innerText).match(/\S+/g) || []).length;
  meta.words = words;
  $('#stats').textContent = `${words.toLocaleString('de')} Wörter · ${pages} ${pages === 1 ? 'Seite' : 'Seiten'}`;
}
function queueLayout(rebuild) {
  if (rebuild) built = 0;
  if (layoutQueued) return;
  layoutQueued = true;
  requestAnimationFrame(() => { layoutQueued = false; layout(); });
}
export function relayout() { built = 0; sheetsEl.dataset.key = ''; layout(true); }

export function setZoom(z) {
  zoom = Math.min(2, Math.max(0.5, Math.round(z * 10) / 10));
  $('#zoom-val').textContent = Math.round(zoom * 100) + ' %';
  setSettings({ zoom });
  if (ch) renderSheets();
}
export const getZoom = () => zoom;

/* ---------- Kapitel laden / speichern ---------- */
export async function openChapter(id) {
  await flush();
  meta = S.book.chapters.find(c => c.id === id);
  ch = null;
  const data = await api('chapter:load', S.book.id, id);
  data.images = data.images || [];
  ed.lang = lang();
  ed.innerHTML = data.html || '<p><br></p>';
  titleEl.textContent = meta.title;
  hyphenateEl(ed, lang());
  ch = data; active = null; pages = 1; built = 0;
  renderImages();
  layout(true);
  undo = [snapshot()]; undoIdx = 0;
  pv.scrollTop = 0;
}
function markDirty() {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 900);
}
function anchors() {
  const blocks = [...ed.children];
  for (const im of ch.images) {
    const y = (im.page * SPAN + im.y - PAGE.mt) * MM;
    const i = blocks.findIndex(b => b.offsetTop + b.offsetHeight > y);
    im.anchor = i < 0 ? blocks.length : i;
  }
}
export async function flush() {
  clearTimeout(saveTimer);
  if (!dirty || !ch) return;
  dirty = false;
  ch.html = stripShy(ed.innerHTML);
  anchors();
  await api('chapter:save', S.book.id, meta.id, ch);
  saveBookSoon();
}
export const currentChapter = () => (ch ? { id: meta.id, title: meta.title, html: stripShy(ed.innerHTML), images: ch.images } : null);

/* ---------- Rückgängig (eigener Verlauf, weil die Silbentrennung den Text per Skript ändert) ---------- */
const snapshot = () => ({ html: stripShy(ed.innerHTML), sel: saveSel() });
function pushUndo() {
  clearTimeout(undoTimer); undoTimer = null;
  const s = snapshot();
  if (undo[undoIdx].html === s.html) { undo[undoIdx].sel = s.sel; return; }
  undo.length = undoIdx + 1;
  undo.push(s);
  if (undo.length > 300) undo.shift();
  undoIdx = undo.length - 1;
}
function stepUndo(dir) {
  if (undoTimer) pushUndo();
  const s = undo[undoIdx + dir];
  if (!s) return;
  undoIdx += dir;
  ed.innerHTML = s.html;
  hyphenateEl(ed, lang());
  active = null;
  restoreSel(s.sel);
  queueLayout(); markDirty();
}

/* ---------- Eingabe ---------- */
document.execCommand('defaultParagraphSeparator', false, 'p');
ed.addEventListener('input', () => {
  if (!ed.firstElementChild) {
    const t = ed.textContent;
    ed.innerHTML = `<p>${esc(t) || '<br>'}</p>`;
    getSelection().selectAllChildren(ed.firstElementChild); getSelection().collapseToEnd();
  }
  clearTimeout(undoTimer); undoTimer = setTimeout(pushUndo, 350);
  queueLayout(); markDirty();
});
ed.addEventListener('beforeinput', e => {
  if (e.inputType === 'historyUndo') { e.preventDefault(); stepUndo(-1); }
  if (e.inputType === 'historyRedo') { e.preventDefault(); stepUndo(1); }
});
ed.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if (k === 'z') { e.preventDefault(); stepUndo(e.shiftKey ? 1 : -1); }
  if (k === 'y') { e.preventDefault(); stepUndo(1); }
});
ed.addEventListener('paste', e => {
  e.preventDefault();
  const lines = (e.clipboardData.getData('text/plain') || '').split(/\r?\n+/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 1) document.execCommand('insertText', false, lines[0]);
  else if (lines.length) document.execCommand('insertHTML', false, lines.map(l => `<p>${esc(l)}</p>`).join(''));
});
let hyTimer;
ed.addEventListener('input', e => {
  if (/^(insertText|insertCompositionText|deleteContent(Backward|Forward))$/.test(e.inputType)) return; // normales Tippen
  clearTimeout(hyTimer); hyTimer = setTimeout(hyphenateOthers, 60);
});
for (const ev of ['copy', 'cut']) ed.addEventListener(ev, e => {
  e.preventDefault();
  e.clipboardData.setData('text/plain', stripShy(getSelection().toString()));
  if (ev === 'cut') document.execCommand('delete');
});
titleEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ed.focus(); } });
titleEl.addEventListener('input', () => {
  meta.title = titleEl.textContent.replace(/\s+/g, ' ').trim() || 'Ohne Titel';
  saveBookSoon(); onMetaChange(); queueLayout();
});

$('#toolbar').addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
$('#toolbar').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || !ch) return;
  if (b.dataset.cmd) document.execCommand(b.dataset.cmd);
  else if (b.dataset.block) document.execCommand('formatBlock', false, b.dataset.block);
  else if (b.id === 'btn-scene') document.execCommand('insertHTML', false, '<p class="scene">* * *</p><p><br></p>');
  else if (b.id === 'zoom-in') setZoom(zoom + 0.1);
  else if (b.id === 'zoom-out') setZoom(zoom - 0.1);
});

/* ---------- Bilder auf der Seite ---------- */
function renderImages() {
  imgsEl.innerHTML = imagesHTML(ch.images, GAP, S.book.dir + '/images');
  for (const el of imgsEl.children) el.insertAdjacentHTML('beforeend', '<span class="h"></span><button class="del">Entfernen</button>');
}
function place(el, im) {
  el.style.left = im.x + 'mm'; el.style.top = im.page * SPAN + im.y + 'mm';
  el.style.width = im.w + 'mm'; el.style.height = im.h + 'mm';
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
imgsEl.addEventListener('pointerdown', e => {
  const el = e.target.closest('.pimg');
  if (!el) return;
  e.preventDefault();
  const im = ch.images.find(i => i.id === el.dataset.id);
  imgsEl.querySelectorAll('.sel').forEach(x => x.classList.remove('sel'));
  el.classList.add('sel');
  if (e.target.classList.contains('del')) {
    ch.images = ch.images.filter(i => i !== im);
    el.remove(); relayout(); markDirty();
    return;
  }
  const resize = e.target.classList.contains('h');
  const s = { cx: e.clientX, cy: e.clientY, x: im.x, absY: im.page * SPAN + im.y, w: im.w, ratio: im.h / im.w };
  el.setPointerCapture(e.pointerId);
  const move = ev => {
    const dx = (ev.clientX - s.cx) / (MM * zoom), dy = (ev.clientY - s.cy) / (MM * zoom);
    if (resize) {
      im.w = clamp(s.w + dx, 15, Math.min(PAGE.w - im.x, (PAGE.h - im.y) / s.ratio));
      im.h = im.w * s.ratio;
    } else {
      const absY = s.absY + dy;
      im.x = clamp(s.x + dx, 0, PAGE.w - im.w);
      im.page = clamp(Math.floor((absY + im.h / 2) / SPAN), 0, pages - 1);
      im.y = clamp(absY - im.page * SPAN, 0, PAGE.h - im.h);
    }
    place(el, im);
    queueLayout(true);
  };
  const up = () => {
    el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
    relayout(); markDirty();
  };
  el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
});
document.addEventListener('pointerdown', e => { if (!e.target.closest('.pimg')) imgsEl.querySelectorAll('.sel').forEach(x => x.classList.remove('sel')); });

export async function addImage(file, at) {
  if (!ch) return;
  const probe = new Image();
  probe.src = bookImg(file);
  await probe.decode().catch(() => {});
  const ratio = probe.naturalWidth ? probe.naturalHeight / probe.naturalWidth : 0.75;
  let w = 50, h = w * ratio;
  if (h > 90) { h = 90; w = h / ratio; }
  const page = clamp(at ? at.page : Math.floor((pv.scrollTop / (MM * zoom) + 40) / SPAN), 0, pages - 1);
  const im = {
    id: uid(), file, page, w, h,
    x: clamp(at ? at.x - w / 2 : PAGE.w - PAGE.mr - w, 0, PAGE.w - w),
    y: clamp(at ? at.y - h / 2 : PAGE.mt + 30, 0, PAGE.h - h),
  };
  ch.images.push(im);
  renderImages(); relayout(); markDirty();
}
// Ablegen von Bildern aus der rechten Leiste oder aus dem Dateimanager
const isImgDrag = e => e.dataTransfer.types.includes('application/x-fw-image') || e.dataTransfer.types.includes('Files');
pv.addEventListener('dragover', e => { if (isImgDrag(e)) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; } }, true);
pv.addEventListener('drop', async e => {
  if (!isImgDrag(e)) return;
  e.preventDefault(); e.stopPropagation();
  const r = pagesEl.getBoundingClientRect();
  const x = (e.clientX - r.left) / (MM * zoom), absY = (e.clientY - r.top) / (MM * zoom);
  const page = clamp(Math.floor(absY / SPAN), 0, pages - 1);
  const at = { page, x, y: absY - page * SPAN };
  let name = e.dataTransfer.getData('application/x-fw-image');
  if (!name) {
    const paths = [...e.dataTransfer.files].map(f => window.api.pathForFile(f)).filter(Boolean);
    const names = await api('images:import', S.book.id, paths);
    S.book.refImages.push(...names); saveBookSoon(); onMetaChange('refs');
    name = names[0];
  }
  if (name) addImage(name, at);
}, true);

window.addEventListener('blur', flush);
window.addEventListener('beforeunload', () => { flush(); });
