import { esc, fileUrl, fontCss } from './layout.js';
import { $, $$, S, api, uid, ask, toast, guard, setSettings, saveBookSoon, saveBookNow, bookImg } from './core.js';
import { openChapter, flush, relayout, setZoom, addImage, setOnMetaChange } from './editor.js';
import { loadThemes } from './themes.js';
import { renderWorld, leaveWorld } from './world.js';
import './exporter.js';

const WORLD_TITLES = { figures: 'Figuren', places: 'Orte', maps: 'Karten', timeline: 'Zeitleiste' };

/* ---------- Bücher ---------- */
function applyBookLook() {
  const b = S.book, st = document.documentElement.style;
  st.setProperty('--title-font', fontCss(b.titleFont));
  st.setProperty('--body-font', fontCss(b.bodyFont));
  st.setProperty('--body-size', (b.fontSize || 11) + 'pt');
  const card = $('#bookcard');
  $('#bookcard-title').textContent = b.title;
  $('#bookcard-title').style.fontFamily = fontCss(b.titleFont);
  card.style.backgroundImage = b.cover ? `url("${bookImg(b.cover)}")` : '';
}
async function refreshLibrary() { S.books = await api('lib:list'); }

async function openBook(id) {
  await flush(); await saveBookNow();
  const b = await api('book:load', id);
  if (!b) return;
  b.notes ||= []; b.refImages ||= []; b.world ||= { figures: [], places: [], maps: [], timeline: [] };
  S.book = b;
  await setSettings({ bookId: id });
  $('#empty').hidden = true;
  applyBookLook(); renderNotes(); renderRefs();
  const last = (S.settings.lastChapter || {})[id];
  await showChapter(b.chapters.some(c => c.id === last) ? last : b.chapters[0].id);
}
async function newBook() {
  const v = await ask('Neues Buch', [{ key: 'title', label: 'Titel', value: '' }]);
  if (!v || !v.title.trim()) return;
  const id = await api('book:create', v.title.trim());
  await refreshLibrary();
  await openBook(id);
}
async function bookSettings() {
  const b = S.book;
  const v = await ask('Buch-Einstellungen', [
    { key: 'title', label: 'Titel', value: b.title },
    { key: 'author', label: 'Autorin / Autor', value: b.author },
    { key: 'titleFont', label: 'Schrift für Titel und Überschriften', type: 'font', value: b.titleFont },
    { key: 'bodyFont', label: 'Schrift für den Text', type: 'font', value: b.bodyFont },
    { key: 'fontSize', label: 'Schriftgröße', type: 'select', value: String(b.fontSize || 11), options: [9, 10, 10.5, 11, 11.5, 12, 13, 14].map(n => [String(n), n + ' pt']) },
    { key: 'lang', label: 'Sprache (für die Silbentrennung)', type: 'select', value: b.lang || 'de', options: [['de', 'Deutsch'], ['en', 'Englisch']] },
    { key: 'cover', label: 'Hintergrundbild des Buches', type: 'image', value: b.cover },
  ], { danger: 'Buch löschen' });
  if (!v) return;
  if (v._delete) {
    if (!confirm(`„${b.title}“ in den Papierkorb verschieben?`)) return;
    await flush(); await saveBookNow();
    await api('book:trash', b.id);
    S.book = null;
    await refreshLibrary();
    if (S.books.length) await openBook(S.books[0].id); else showEmpty();
    return;
  }
  Object.assign(b, v, { title: v.title.trim() || b.title, fontSize: +v.fontSize });
  await saveBookNow(); await refreshLibrary();
  applyBookLook();
  // Kapitel neu laden, damit Sprache und Schrift überall greifen
  if (S.view === 'chapter') { await flush(); await openChapter(S.chapterId); }
  renderChapters();
}
function showEmpty() {
  $('#empty').hidden = false; $('#pageview').hidden = true; $('#worldview').hidden = true;
  $('#bookcard-title').textContent = 'Kein Buch'; $('#chapters').innerHTML = ''; $('#crumb').textContent = '';
}

const menu = $('#bookmenu');
$('#bookcard').onclick = e => {
  e.stopPropagation();
  if (!menu.hidden) { menu.hidden = true; return; }
  menu.innerHTML = S.books.map(b => `<button class="bookitem${S.book && b.id === S.book.id ? ' on' : ''}" data-id="${esc(b.id)}" style='font-family:${esc(fontCss(b.titleFont))};${b.cover ? `background-image:url("${fileUrl(b.dir + '/images', b.cover)}")` : ''}'><span>${esc(b.title)}</span></button>`).join('')
    + `<div class="row"><button data-a="new">+ Neues Buch</button>${S.book ? '<button data-a="settings">Buch-Einstellungen</button>' : ''}</div>`;
  menu.style.top = $('#top').offsetHeight + 4 + 'px';
  menu.hidden = false;
};
menu.onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  menu.hidden = true;
  if (b.dataset.id) { if (!S.book || b.dataset.id !== S.book.id) guard(() => openBook(b.dataset.id)); }
  else if (b.dataset.a === 'new') newBook();
  else bookSettings();
};
document.addEventListener('click', e => { if (!menu.contains(e.target)) menu.hidden = true; });
$('#btn-first-book').onclick = newBook;

/* ---------- Kapitel und Ansichten ---------- */
function renderChapters() {
  $('#chapters').innerHTML = S.book.chapters.map(c => `<li draggable="true" data-id="${c.id}" class="${S.view === 'chapter' && c.id === S.chapterId ? 'on' : ''}"><span class="t">${esc(c.title)}</span><span class="n">${c.pages || 1} S.</span><button class="x" title="Kapitel löschen">×</button></li>`).join('');
  $$('#worldnav li').forEach(li => li.classList.toggle('on', li.dataset.view === S.view));
  const cur = S.book.chapters.find(c => c.id === S.chapterId);
  $('#crumb').textContent = S.view === 'chapter' ? (cur ? cur.title : '') : WORLD_TITLES[S.view];
}
setOnMetaChange(what => { if (what === 'refs') renderRefs(); else renderChapters(); });

async function showChapter(id) {
  leaveWorld();
  S.view = 'chapter'; S.chapterId = id;
  document.body.classList.remove('world');
  $('#pageview').hidden = false; $('#worldview').hidden = true;
  await openChapter(id);
  setSettings({ lastChapter: { ...(S.settings.lastChapter || {}), [S.book.id]: id } });
  renderChapters();
}
async function showWorld(kind) {
  await flush();
  S.view = kind;
  document.body.classList.add('world');
  $('#pageview').hidden = true; $('#worldview').hidden = false;
  renderWorld(kind); renderChapters();
}
$('#worldnav').onclick = e => { const li = e.target.closest('li'); if (li && S.book) showWorld(li.dataset.view); };
$('#btn-add-chapter').onclick = async () => {
  if (!S.book) return;
  const c = { id: uid(), title: 'Kapitel ' + (S.book.chapters.length + 1), pages: 1, words: 0 };
  S.book.chapters.push(c);
  await saveBookNow();
  await showChapter(c.id);
};
const chList = $('#chapters');
chList.onclick = async e => {
  const li = e.target.closest('li');
  if (!li) return;
  const id = li.dataset.id, chs = S.book.chapters;
  if (e.target.classList.contains('x')) {
    const c = chs.find(x => x.id === id);
    if (chs.length < 2) return toast('Ein Buch braucht mindestens ein Kapitel.');
    if (!confirm(`Kapitel „${c.title}“ samt Text löschen?`)) return;
    await flush();
    chs.splice(chs.indexOf(c), 1);
    await saveBookNow(); await api('chapter:delete', S.book.id, id);
    if (S.chapterId === id) { S.chapterId = null; await showChapter(chs[0].id); } else { relayout(); renderChapters(); }
    return;
  }
  if (id !== S.chapterId || S.view !== 'chapter') await showChapter(id);
};
// Kapitel per Ziehen umsortieren
let dragId = null;
chList.addEventListener('dragstart', e => { dragId = e.target.closest('li')?.dataset.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/x-fw-chapter', dragId); });
chList.addEventListener('dragover', e => {
  const li = e.target.closest('li');
  if (!dragId || !li) return;
  e.preventDefault();
  $$('li', chList).forEach(x => x.classList.toggle('dragover', x === li));
});
chList.addEventListener('dragend', () => { dragId = null; $$('li', chList).forEach(x => x.classList.remove('dragover')); });
chList.addEventListener('drop', e => {
  const li = e.target.closest('li'), chs = S.book.chapters;
  if (!dragId || !li) return;
  e.preventDefault();
  const from = chs.findIndex(c => c.id === dragId);
  const [c] = chs.splice(from, 1);
  chs.splice(chs.findIndex(x => x.id === li.dataset.id), 0, c);
  dragId = null;
  saveBookSoon(); renderChapters();
  if (S.view === 'chapter') relayout();
});

/* ---------- Rechte Leiste ---------- */
$('.tabs').onclick = e => {
  const t = e.target.dataset.tab;
  if (!t) return;
  $$('.tabs button').forEach(b => b.classList.toggle('on', b === e.target));
  $('#tab-notes').hidden = t !== 'notes'; $('#tab-refs').hidden = t !== 'refs';
  if (t === 'notes') $$('#notes textarea').forEach(grow);
};
const grow = ta => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; };
function renderNotes() {
  $('#notes').innerHTML = S.book.notes.map(n => `<div class="note" data-id="${n.id}"><textarea placeholder="Notiz …">${esc(n.text)}</textarea><button class="x" title="Notiz löschen">×</button></div>`).join('');
  $$('#notes textarea').forEach(grow);
}
$('#btn-add-note').onclick = () => {
  if (!S.book) return;
  S.book.notes.unshift({ id: uid(), text: '' });
  saveBookSoon(); renderNotes();
  $('#notes textarea').focus();
};
$('#notes').oninput = e => {
  S.book.notes.find(n => n.id === e.target.closest('.note').dataset.id).text = e.target.value;
  grow(e.target); saveBookSoon();
};
$('#notes').onclick = e => {
  if (!e.target.classList.contains('x')) return;
  const n = S.book.notes.find(x => x.id === e.target.closest('.note').dataset.id);
  if (n.text.trim() && !confirm('Diese Notiz löschen?')) return;
  S.book.notes.splice(S.book.notes.indexOf(n), 1);
  saveBookSoon(); renderNotes();
};
function renderRefs() {
  $('#refs').innerHTML = S.book.refImages.map(f => `<div class="ref" draggable="true" data-f="${esc(f)}"><img src="${bookImg(f)}" draggable="false" alt=""><button class="x" title="Aus der Sammlung entfernen">×</button></div>`).join('');
}
$('#btn-add-ref').onclick = async () => {
  if (!S.book) return;
  S.book.refImages.push(...await api('images:pick', S.book.id, true));
  saveBookSoon(); renderRefs();
};
const refs = $('#refs');
refs.addEventListener('dragstart', e => {
  const r = e.target.closest('.ref');
  if (!r) return;
  e.dataTransfer.setData('application/x-fw-image', r.dataset.f);
  e.dataTransfer.effectAllowed = 'copy';
});
refs.onclick = e => {
  const r = e.target.closest('.ref');
  if (!r) return;
  if (e.target.classList.contains('x')) {
    S.book.refImages = S.book.refImages.filter(f => f !== r.dataset.f);
    saveBookSoon(); renderRefs();
  } else { $('#lightbox img').src = bookImg(r.dataset.f); $('#lightbox').hidden = false; }
};
$('#lightbox').onclick = () => { $('#lightbox').hidden = true; };
const tabRefs = $('#tab-refs');
tabRefs.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
tabRefs.addEventListener('drop', async e => {
  if (!e.dataTransfer.types.includes('Files') || !S.book) return;
  e.preventDefault();
  const paths = [...e.dataTransfer.files].map(f => window.api.pathForFile(f)).filter(Boolean);
  S.book.refImages.push(...await api('images:import', S.book.id, paths));
  saveBookSoon(); renderRefs();
});
$('#btn-image').onclick = async () => {
  if (!S.book || S.view !== 'chapter') return;
  const [f] = await api('images:pick', S.book.id, false);
  if (f) addImage(f);
};
// Außerhalb der Ablageflächen darf ein fallen gelassenes Bild die App nicht ersetzen
for (const ev of ['dragover', 'drop']) window.addEventListener(ev, e => { if (!e.defaultPrevented && e.dataTransfer.types.includes('Files')) e.preventDefault(); });

/* ---------- Start ---------- */
(async () => {
  S.settings = await api('settings:get');
  await loadThemes();
  setZoom(S.settings.zoom || 1.2);
  [S.fonts] = await Promise.all([api('fonts:list'), refreshLibrary()]);
  const first = S.books.find(b => b.id === S.settings.bookId) || S.books[0];
  if (first) await guard(() => openBook(first.id)); else showEmpty();
})();
