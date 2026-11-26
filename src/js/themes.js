import { fileUrl, esc } from './layout.js';
import { $, S, api, setSettings, ask, guard, toast } from './core.js';

const DEFAULTS = {
  dark: { frame: '#1c1b22', frameText: '#fbfbfe', toolbar: 'rgba(66,65,77,.72)', toolbarText: '#fbfbfe', accent: '#7aa2ff' },
  light: { frame: '#e9e9ef', frameText: '#15141a', toolbar: 'rgba(255,255,255,.72)', toolbarText: '#15141a', accent: '#0a66d8' },
};
const SURFACES = [['header', 'Kopfleiste'], ['left', 'Linke Leiste'], ['right', 'Rechte Leiste'], ['workspace', 'Arbeitsfläche'], ['page', 'Seite']];

const mode = () => (S.settings.mode === 'light' ? 'light' : 'dark');
export const currentTheme = () => S.themes.find(t => t.id === S.settings.themeId) || S.themes[0];
const url = (t, f) => `url("${fileUrl(t.dir, f)}")`;

function resolved(t) {
  const m = mode();
  const own = { ...t.colors, ...(m === 'dark' ? t.darkColors : null) };
  const c = { ...DEFAULTS[m], ...own };
  // Design bringt eigene Rahmenfarben, aber keine Werkzeugleiste mit: neutral bleiben statt Standardfarbe
  if (own.frame && !own.toolbar) c.toolbar = 'rgba(127,127,127,.2)';
  if (!own.toolbarText && own.frameText) c.toolbarText = own.frameText;
  const im = t.images || {};
  const layers = im.header ? [{ file: im.header, position: 'center', repeat: 'no-repeat', size: 'cover' }]
    : ((m === 'dark' && t.darkHeaderLayers) || t.headerLayers || []);
  return { c, layers, im, fallback: layers[0] && layers[0].file };
}

export function applyTheme() {
  const t = currentTheme(), root = document.documentElement, st = root.style;
  root.dataset.mode = mode();
  $('#btn-mode').textContent = mode() === 'dark' ? '☾ Dunkel' : '☀ Hell';
  if (!t) return;
  const { c, layers, im, fallback } = resolved(t);
  st.setProperty('--frame-bg', c.frame); st.setProperty('--frame-text', c.frameText);
  st.setProperty('--toolbar-bg', c.toolbar); st.setProperty('--toolbar-text', c.toolbarText);
  st.setProperty('--accent', c.accent);
  const top = $('#top').style;
  top.backgroundImage = layers.map(l => url(t, l.file)).join(',') || 'none';
  top.backgroundPosition = layers.map(l => l.position || 'right top').join(',');
  top.backgroundRepeat = layers.map(l => l.repeat || 'no-repeat').join(',');
  top.backgroundSize = layers.map(l => l.size || 'auto').join(',');
  // Flächen ohne eigenes Bild übernehmen abgeschwächt das Kopfbild
  const surf = k => (im[k] || fallback ? url(t, im[k] || fallback) : 'none');
  st.setProperty('--left-img', surf('left')); st.setProperty('--right-img', surf('right'));
  st.setProperty('--work-img', surf('workspace')); st.setProperty('--page-img', surf('page'));
  st.setProperty('--page-img-opacity', t.pageOpacity ?? 0.1);
}
export function pageBackground() {
  const t = currentTheme();
  if (!t) return {};
  const { im, fallback } = resolved(t), f = im.page || fallback;
  return { pageImage: f ? fileUrl(t.dir, f) : null, pageOpacity: t.pageOpacity ?? 0.1 };
}
export async function loadThemes() { S.themes = await api('themes:list'); applyTheme(); }

/* ---------- Design-Dialog ---------- */
const dlg = $('#dlg-design');
function render() {
  const cur = currentTheme();
  $('#theme-list').innerHTML = S.themes.map(t => {
    const { c, layers } = resolved(t);
    const bg = layers[0] ? `${url(t, layers[0].file)} ${layers[0].position || 'right top'} / ${layers[0].size || 'auto'} no-repeat, ` : '';
    return `<button class="themecard${t === cur ? ' on' : ''}" data-id="${esc(t.id)}" style='background:${bg}${c.frame};color:${c.frameText}'><span>${esc(t.name)}</span></button>`;
  }).join('');
  $('#surfaces').innerHTML = SURFACES.map(([k, label]) => `<div class="surface" data-k="${k}"><div class="thumb" style='${cur.images && cur.images[k] ? `background-image:${url(cur, cur.images[k])}` : ''}'></div><span class="name">${label}</span><button data-a="pick">Bild wählen</button><button data-a="rm">Entfernen</button></div>`).join('');
  $('#page-opacity').value = cur.pageOpacity ?? 0.1;
}
async function select(id) { await setSettings({ themeId: id }); applyTheme(); render(); }
const saveCur = () => api('themes:save', currentTheme());

$('#btn-design').onclick = () => { render(); dlg.showModal(); };
$('#btn-design-close').onclick = () => dlg.close();
$('#btn-mode').onclick = async () => { await setSettings({ mode: mode() === 'dark' ? 'light' : 'dark' }); applyTheme(); };
$('#theme-list').onclick = e => { const b = e.target.closest('.themecard'); if (b) select(b.dataset.id); };
$('#surfaces').onclick = async e => {
  const a = e.target.dataset.a, row = e.target.closest('.surface');
  if (!a) return;
  const t = currentTheme(), k = row.dataset.k;
  t.images = t.images || {};
  if (a === 'pick') { const f = await api('themes:pick-image', t.id); if (!f) return; t.images[k] = f; } else delete t.images[k];
  await saveCur(); applyTheme(); render();
};
$('#page-opacity').oninput = e => { currentTheme().pageOpacity = +e.target.value; applyTheme(); };
$('#page-opacity').onchange = saveCur;
async function imported(id) {
  if (!id) return;
  S.themes = await api('themes:list');
  await select(id);
  toast('Design „' + currentTheme().name + '“ übernommen.');
}
$('#btn-theme-file').onclick = () => guard(async () => imported(await api('themes:import-file')));
$('#btn-theme-url').onclick = () => guard(async () => {
  const u = $('#theme-url').value.trim();
  if (!u) return;
  toast('Design wird geladen …');
  await imported(await api('themes:import-url', u));
  $('#theme-url').value = '';
});
$('#btn-theme-firefox').onclick = () => guard(async () => {
  const list = await api('themes:firefox-list');
  if (!list.length) return toast('In deinem Firefox ist kein importierbares Design installiert. Die mitgelieferten Designs (Hell, Dunkel, Alpenglow) lassen sich nicht übernehmen.', 9000);
  const v = await ask('Design aus Firefox übernehmen', [{ key: 'file', label: 'Installierte Designs', type: 'select', value: list[0].file, options: list.map(t => [t.file, t.name + (t.active ? ' (gerade aktiv)' : '')]) }]);
  if (v) await imported(await api('themes:import-firefox', v.file));
});
$('#btn-theme-browse').onclick = () => api('open-external', 'https://addons.mozilla.org/de/firefox/themes/');
$('#btn-theme-new').onclick = async () => {
  const v = await ask('Eigenes Design', [{ key: 'name', label: 'Name', value: 'Mein Design' }]);
  if (v && v.name.trim()) imported(await api('themes:create', v.name.trim()));
};
$('#btn-theme-delete').onclick = async () => {
  const t = currentTheme();
  if (S.themes.length < 2 || !confirm(`Design „${t.name}“ wirklich löschen?`)) return;
  await api('themes:delete', t.id);
  S.themes = await api('themes:list');
  select(S.themes[0].id);
};
