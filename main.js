const { app, BrowserWindow, ipcMain, dialog, shell, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const zlib = require('zlib');
const crypto = require('crypto');
const { execFile } = require('child_process');
const AdmZip = require('adm-zip');

// Für Tests: eigener Datenordner, damit die echte Bibliothek unberührt bleibt
if (process.env.FW_DATA) {
  app.setPath('userData', path.join(process.env.FW_DATA, 'config'));
  app.setPath('documents', path.join(process.env.FW_DATA, 'docs'));
} else if (process.env.FLATPAK_ID && process.env.XDG_CONFIG_HOME) {
  // Flatpak legt XDG_CONFIG_HOME nach ~/.var/app/<id>/config. Einstellungen und
  // Designs gehören dorthin, nicht nach ~/.config im Home des Wirts.
  app.setPath('userData', path.join(process.env.XDG_CONFIG_HOME, 'FantasyWriter'));
}
// Fenster der Desktop-Datei der Flatpak-App zuordnen (Wayland app_id / WM_CLASS).
if (process.env.FLATPAK_ID && process.platform === 'linux' && typeof app.setDesktopName === 'function') {
  app.setDesktopName(process.env.FLATPAK_ID + '.desktop');
}

const LIB = () => path.join(app.getPath('documents'), 'FantasyWriter');
const UD = () => app.getPath('userData');
const THEMES = () => path.join(UD(), 'themes');
const SETTINGS = () => path.join(UD(), 'settings.json');
const IMG_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.bmp'];

let win;
const uid = () => crypto.randomBytes(5).toString('hex');
const slug = s => (String(s).normalize('NFKD').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'x');
// Namen aus dem Renderer dürfen nie aus ihrem Ordner herausführen
const safe = n => { n = String(n); if (!n || n !== path.basename(n) || n.startsWith('.')) throw new Error('Ungültiger Name'); return n; };

async function readJson(file, fallback) {
  try { return JSON.parse(await fsp.readFile(file, 'utf8')); } catch { return fallback; }
}
async function writeJson(file, data) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(data, null, 1));
  await fsp.rename(tmp, file);
}
const bookDir = id => path.join(LIB(), safe(id));

async function copyImage(src, destDir) {
  const ext = path.extname(src).toLowerCase();
  if (!IMG_EXT.includes(ext)) throw new Error('Kein unterstütztes Bildformat: ' + path.basename(src));
  await fsp.mkdir(destDir, { recursive: true });
  const name = uid() + '-' + slug(path.basename(src, ext)) + ext;
  await fsp.copyFile(src, path.join(destDir, name));
  return name;
}
async function pickImages(multi) {
  const r = await dialog.showOpenDialog(win, {
    title: 'Bild auswählen',
    properties: multi ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: [{ name: 'Bilder', extensions: IMG_EXT.map(e => e.slice(1)) }],
  });
  return r.canceled ? [] : r.filePaths;
}

/* ---------- Bibliothek ---------- */
ipcMain.handle('lib:list', async () => {
  await fsp.mkdir(LIB(), { recursive: true });
  const out = [];
  for (const d of await fsp.readdir(LIB(), { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const b = await readJson(path.join(LIB(), d.name, 'book.json'), null);
    if (b) out.push({ id: d.name, dir: path.join(LIB(), d.name), title: b.title, titleFont: b.titleFont, cover: b.cover });
  }
  return out.sort((a, b) => a.title.localeCompare(b.title, 'de'));
});
ipcMain.handle('book:create', async (e, title) => {
  const id = slug(title) + '-' + uid();
  const ch = uid();
  await writeJson(path.join(bookDir(id), 'book.json'), {
    title, author: '', lang: 'de', titleFont: 'serif', bodyFont: 'serif', fontSize: 11, cover: null,
    chapters: [{ id: ch, title: 'Kapitel 1', pages: 1, words: 0 }],
    notes: [], refImages: [],
    world: { figures: [], places: [], maps: [], timeline: [] },
  });
  await writeJson(path.join(bookDir(id), 'chapters', ch + '.json'), { html: '<p><br></p>', images: [] });
  return id;
});
ipcMain.handle('book:load', async (e, id) => {
  const b = await readJson(path.join(bookDir(id), 'book.json'), null);
  return b && { ...b, id, dir: bookDir(id) };
});
ipcMain.handle('book:save', (e, id, data) => { const { id: _i, dir: _d, ...rest } = data; return writeJson(path.join(bookDir(id), 'book.json'), rest); });
ipcMain.handle('book:trash', (e, id) => shell.trashItem(bookDir(id)));
ipcMain.handle('book:open-folder', (e, id) => shell.openPath(bookDir(id)));
ipcMain.handle('chapter:load', (e, id, ch) => readJson(path.join(bookDir(id), 'chapters', safe(ch) + '.json'), { html: '<p><br></p>', images: [] }));
ipcMain.handle('chapter:save', (e, id, ch, data) => writeJson(path.join(bookDir(id), 'chapters', safe(ch) + '.json'), data));
ipcMain.handle('chapter:delete', (e, id, ch) => fsp.rm(path.join(bookDir(id), 'chapters', safe(ch) + '.json'), { force: true }));
ipcMain.handle('images:pick', async (e, id, multi) => {
  const out = [];
  for (const p of await pickImages(multi)) out.push(await copyImage(p, path.join(bookDir(id), 'images')));
  return out;
});
ipcMain.handle('images:import', async (e, id, paths) => {
  const out = [];
  for (const p of paths) { try { out.push(await copyImage(p, path.join(bookDir(id), 'images'))); } catch { /* kein Bild */ } }
  return out;
});

/* ---------- Einstellungen, Schriften ---------- */
ipcMain.handle('settings:get', () => readJson(SETTINGS(), {}));
ipcMain.handle('settings:set', async (e, patch) => writeJson(SETTINGS(), { ...(await readJson(SETTINGS(), {})), ...patch }));
ipcMain.handle('fonts:list', () => new Promise(res => {
  execFile('fc-list', [':', 'family'], { maxBuffer: 8e6 }, (err, out) => {
    if (err) return res(['serif', 'sans-serif']);
    const set = new Set(out.split('\n').map(l => l.split(',')[0].trim().replace(/\\/g, '')).filter(Boolean));
    res([...set].sort((a, b) => a.localeCompare(b)));
  });
}));
ipcMain.handle('open-external', (e, url) => { if (/^https:\/\/addons\.mozilla\.org\//.test(url)) shell.openExternal(url); });

/* ---------- Designs ---------- */
async function ensureBuiltinThemes() {
  const src = path.join(__dirname, 'assets', 'themes');
  for (const d of await fsp.readdir(src)) {
    const dest = path.join(THEMES(), d);
    if (!fs.existsSync(dest)) await fsp.cp(path.join(src, d), dest, { recursive: true });
  }
}
ipcMain.handle('themes:list', async () => {
  await ensureBuiltinThemes();
  const out = [];
  for (const d of await fsp.readdir(THEMES(), { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const t = await readJson(path.join(THEMES(), d.name, 'theme.json'), null);
    if (t) out.push({ ...t, id: d.name, dir: path.join(THEMES(), d.name) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'de'));
});
ipcMain.handle('themes:save', (e, t) => { const { id, dir, ...rest } = t; return writeJson(path.join(THEMES(), safe(id), 'theme.json'), rest); });
ipcMain.handle('themes:delete', (e, id) => fsp.rm(path.join(THEMES(), safe(id)), { recursive: true, force: true }));
ipcMain.handle('themes:pick-image', async (e, id) => {
  const [p] = await pickImages(false);
  return p ? copyImage(p, path.join(THEMES(), safe(id))) : null;
});
ipcMain.handle('themes:create', async (e, name) => {
  const id = slug(name) + '-' + uid();
  await writeJson(path.join(THEMES(), id, 'theme.json'), { name, source: 'custom', colors: {}, headerLayers: [], images: {}, pageOpacity: 0.1 });
  return id;
});

const cssColor = c => {
  if (Array.isArray(c) && c.length >= 3 && c.every(n => typeof n === 'number')) return c.length > 3 ? `rgba(${c.slice(0, 4).join(',')})` : `rgb(${c.join(',')})`;
  if (typeof c === 'string' && /^[#\w(),.%\s/-]{1,80}$/.test(c)) return c;
  return null;
};
function mapColors(c = {}) {
  const m = {
    frame: c.frame || c.accentcolor, frameText: c.tab_background_text || c.textcolor,
    toolbar: c.toolbar, toolbarText: c.toolbar_text || c.bookmark_text,
    field: c.toolbar_field, fieldText: c.toolbar_field_text,
    accent: c.tab_line || c.icons_attention || c.toolbar_field_border_focus,
  };
  const out = {};
  for (const k in m) { const v = cssColor(m[k]); if (v) out[k] = v; }
  return out;
}
function xpiName(zip, man) {
  const name = String(man.name || 'Firefox-Design');
  const msg = name.match(/^__MSG_(.+)__$/);
  if (!msg) return name;
  try {
    const en = zip.getEntry(`_locales/${man.default_locale}/messages.json`);
    const loc = JSON.parse(zip.readAsText(en).replace(/^\uFEFF/, ''));
    const key = Object.keys(loc).find(k => k.toLowerCase() === msg[1].toLowerCase());
    return (key && loc[key].message) || 'Firefox-Design';
  } catch { return 'Firefox-Design'; }
}
// Designs, die im eigenen Firefox installiert sind (auch Flatpak, Snap und verwandte Browser)
async function firefoxThemes() {
  const home = app.getPath('home'), out = [];
  const roots = ['.mozilla/firefox', '.config/mozilla/firefox', '.var/app/org.mozilla.firefox/.mozilla/firefox', '.var/app/org.mozilla.firefox/config/mozilla/firefox', 'snap/firefox/common/.mozilla/firefox', '.librewolf', '.var/app/io.gitlab.librewolf-community/.librewolf', '.zen', '.var/app/app.zen_browser.zen/.zen', '.floorp'];
  for (const root of roots) {
    let profiles = [];
    try { profiles = await fsp.readdir(path.join(home, root), { withFileTypes: true }); } catch { continue; }
    for (const pr of profiles) {
      if (!pr.isDirectory()) continue;
      const pdir = path.join(home, root, pr.name);
      let files = [];
      try { files = await fsp.readdir(path.join(pdir, 'extensions')); } catch { continue; }
      let active = null;
      try { active = ((await fsp.readFile(path.join(pdir, 'prefs.js'), 'utf8')).match(/"extensions\.activeThemeID",\s*"([^"]+)"/) || [])[1]; } catch { /* kein prefs.js */ }
      for (const f of files) {
        if (!f.endsWith('.xpi')) continue;
        try {
          const file = path.join(pdir, 'extensions', f);
          if ((await fsp.stat(file)).size > 30e6) continue;
          const zip = new AdmZip(file);
          const man = JSON.parse(zip.readAsText('manifest.json').replace(/^\uFEFF/, ''));
          if (man.theme) out.push({ file, name: xpiName(zip, man), active: f === active + '.xpi' });
        } catch { /* keine lesbare Erweiterung */ }
      }
    }
  }
  return out.sort((a, b) => b.active - a.active || a.name.localeCompare(b.name, 'de'));
}
ipcMain.handle('themes:firefox-list', firefoxThemes);
ipcMain.handle('themes:import-firefox', async (e, file) => {
  if (!(await firefoxThemes()).some(t => t.file === file)) throw new Error('Design nicht gefunden.');
  return importXpi(await fsp.readFile(file));
});
// Firefox-Design (.xpi = ZIP mit manifest.json) in das eigene Format übernehmen
async function importXpi(buf) {
  const zip = new AdmZip(buf);
  const txt = n => { const en = zip.getEntry(n); return en ? zip.readAsText(en).replace(/^﻿/, '') : null; };
  const mtxt = txt('manifest.json');
  if (!mtxt) throw new Error('Keine manifest.json gefunden – das ist kein Firefox-Design.');
  const man = JSON.parse(mtxt);
  if (!man.theme) throw new Error('Diese Erweiterung ist kein Design (kein "theme"-Abschnitt).');
  const name = xpiName(zip, man);
  const id = slug(name) + '-' + uid();
  const dir = path.join(THEMES(), id);
  await fsp.mkdir(dir, { recursive: true });
  let n = 0;
  const extract = async p => {
    if (typeof p !== 'string') return null;
    const en = zip.getEntry(p.replace(/^\.?\//, ''));
    const ext = path.extname(p).toLowerCase();
    if (!en || !IMG_EXT.includes(ext)) return null;
    const file = `bild${n++}${ext}`;
    await fsp.writeFile(path.join(dir, file), en.getData());
    return file;
  };
  const layers = async t => {
    const im = t.images || {}, pr = t.properties || {}, out = [];
    const frame = await extract(im.theme_frame || im.headerURL);
    if (frame) out.push({ file: frame, position: 'right top', repeat: 'no-repeat' });
    const add = Array.isArray(im.additional_backgrounds) ? im.additional_backgrounds : [];
    for (let i = 0; i < add.length; i++) {
      const f = await extract(add[i]);
      const pos = (pr.additional_backgrounds_alignment || [])[i], rep = (pr.additional_backgrounds_tiling || [])[i];
      if (f) out.push({
        file: f,
        position: /^[a-z ]{1,30}$/.test(pos || '') ? pos : 'right top',
        repeat: ['repeat', 'repeat-x', 'repeat-y', 'no-repeat'].includes(rep) ? rep : 'no-repeat',
      });
    }
    return out;
  };
  const theme = { name, source: 'firefox', colors: mapColors(man.theme.colors), headerLayers: await layers(man.theme), images: {}, pageOpacity: 0.1 };
  if (man.dark_theme) {
    theme.darkColors = mapColors(man.dark_theme.colors);
    const dl = await layers(man.dark_theme);
    if (dl.length) theme.darkHeaderLayers = dl;
  }
  await writeJson(path.join(dir, 'theme.json'), theme);
  return id;
}
ipcMain.handle('themes:import-file', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Firefox-Design importieren', properties: ['openFile'], filters: [{ name: 'Firefox-Design', extensions: ['xpi', 'zip'] }] });
  if (r.canceled) return null;
  return importXpi(await fsp.readFile(r.filePaths[0]));
});
ipcMain.handle('themes:import-url', async (e, url) => {
  const m = String(url).match(/^https:\/\/addons\.mozilla\.org\/(?:[\w-]+\/)?(?:firefox|android)\/addon\/([^/?#]+)/);
  if (!m) throw new Error('Bitte einen Link von addons.mozilla.org einfügen (…/firefox/addon/name/).');
  const info = await fetch(`https://addons.mozilla.org/api/v5/addons/addon/${encodeURIComponent(decodeURIComponent(m[1]))}/`);
  if (!info.ok) throw new Error('Design nicht gefunden (' + info.status + ').');
  const j = await info.json();
  if (j.type !== 'statictheme') throw new Error('Das ist eine Erweiterung, kein Design.');
  const fileUrl = j.current_version && j.current_version.file && j.current_version.file.url;
  if (!fileUrl || !/^https:\/\/addons\.mozilla\.org\//.test(fileUrl)) throw new Error('Keine Download-Datei gefunden.');
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error('Download fehlgeschlagen (' + res.status + ').');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 30e6) throw new Error('Datei zu groß.');
  return importXpi(buf);
});

/* ---------- Export ---------- */
ipcMain.handle('export:pdf', async (e, payload) => {
  const r = await dialog.showSaveDialog(win, { title: 'Als PDF exportieren', defaultPath: slug(payload.book.title) + '.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (r.canceled) return null;
  const buf = await renderPdf(payload);
  await fsp.writeFile(r.filePath, buf);
  return r.filePath;
});
async function renderPdf(payload) {
  const pw = new BrowserWindow({ show: false, width: 900, height: 1200, webPreferences: { preload: path.join(__dirname, 'preload.js'), sandbox: false } });
  try {
    await pw.loadFile(path.join(__dirname, 'src', 'print.html'));
    const ready = new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('Zeitüberschreitung beim Seitenaufbau')), 180000);
      ipcMain.once('print:ready', () => { clearTimeout(t); res(); });
    });
    pw.webContents.send('print:data', payload);
    await ready;
    return await pw.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, margins: { marginType: 'none' } });
  } finally { pw.destroy(); }
}

// Kleiner ZIP-Schreiber: EPUB verlangt "mimetype" unkomprimiert als ersten Eintrag
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function makeZip(files) {
  const parts = [], central = [];
  let off = 0;
  for (const f of files) {
    const name = Buffer.from(f.name), data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data);
    const comp = f.store ? data : zlib.deflateRawSync(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x800, 6); h.writeUInt16LE(f.store ? 0 : 8, 8);
    h.writeUInt32LE(0x00210000, 10); h.writeUInt32LE(crc32(data), 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); h.copy(c, 6, 4, 30); c.writeUInt32LE(off, 42);
    parts.push(h, name, comp); central.push(c, name);
    off += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.bmp': 'image/bmp' };
async function buildEpub(p) {
  const b = p.book, lang = b.lang || 'de';
  const page = (title, body) => `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}"><head><meta charset="utf-8"/><title>${esc(title)}</title><link rel="stylesheet" href="style.css"/></head><body>${body}</body></html>`;
  const files = [
    { name: 'mimetype', data: 'application/epub+zip', store: true },
    { name: 'META-INF/container.xml', data: '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>' },
    { name: 'OEBPS/style.css', data: p.css },
    { name: 'OEBPS/title.xhtml', data: page(b.title, `<section class="titlepage"><h1>${esc(b.title)}</h1><p>${esc(b.author)}</p></section>`) },
    { name: 'OEBPS/nav.xhtml', data: page('Inhalt', `<nav epub:type="toc"><h1>Inhalt</h1><ol>${p.chapters.map((c, i) => `<li><a href="k${i + 1}.xhtml">${esc(c.title)}</a></li>`).join('')}</ol></nav>`) },
  ];
  let manifest = '<item id="css" href="style.css" media-type="text/css"/><item id="title" href="title.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>';
  let spine = '<itemref idref="title"/><itemref idref="nav"/>';
  p.chapters.forEach((c, i) => {
    files.push({ name: `OEBPS/k${i + 1}.xhtml`, data: page(c.title, c.xhtml) });
    manifest += `<item id="k${i + 1}" href="k${i + 1}.xhtml" media-type="application/xhtml+xml"/>`;
    spine += `<itemref idref="k${i + 1}"/>`;
  });
  let n = 0;
  for (const img of new Set(p.images)) {
    const mime = MIME[path.extname(img).toLowerCase()];
    if (!mime) continue;
    try {
      files.push({ name: 'OEBPS/images/' + safe(img), data: await fsp.readFile(path.join(bookDir(b.id), 'images', safe(img))), store: true });
      manifest += `<item id="img${n++}" href="images/${esc(encodeURIComponent(img))}" media-type="${mime}"${img === b.cover ? ' properties="cover-image"' : ''}/>`;
    } catch { /* Bild fehlt */ }
  }
  files.push({ name: 'OEBPS/content.opf', data: `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">urn:uuid:${crypto.randomUUID()}</dc:identifier><dc:title>${esc(b.title)}</dc:title><dc:creator>${esc(b.author || 'Unbekannt')}</dc:creator><dc:language>${lang}</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta></metadata><manifest>${manifest}</manifest><spine>${spine}</spine></package>` });
  return makeZip(files);
}
ipcMain.handle('export:epub', async (e, payload) => {
  const r = await dialog.showSaveDialog(win, { title: 'Als EPUB exportieren', defaultPath: slug(payload.book.title) + '.epub', filters: [{ name: 'EPUB', extensions: ['epub'] }] });
  if (r.canceled) return null;
  await fsp.writeFile(r.filePath, await buildEpub(payload));
  return r.filePath;
});

/* ---------- Fenster ---------- */
// Starter-Eintrag fürs Startmenü und die Taskleiste anlegen: ein AppImage bringt dem System sonst
// weder Symbol noch Startbefehl mit, und angeheftete Einträge führen ins Leere.
async function installLauncher() {
  // Flatpak liefert Desktop-Datei und Icon selbst aus. Ein zweiter Starter
  // im Sandbox-Datenordner würde auf die interne Electron-Binary zeigen.
  if (!app.isPackaged || process.platform !== 'linux' || process.env.FLATPAK_ID) return;
  const exe = process.env.APPIMAGE || process.execPath;
  const data = process.env.XDG_DATA_HOME || path.join(app.getPath('home'), '.local', 'share');
  const icon = path.join(data, 'icons', 'hicolor', '512x512', 'apps', 'fantasywriter.png');
  const file = path.join(data, 'applications', 'fantasywriter.desktop');
  const text = `[Desktop Entry]\nType=Application\nName=FantasyWriter\nComment=Bücher schreiben\nExec="${exe.replace(/(["\\$`])/g, '\\$1')}" %U\nIcon=${icon}\nTerminal=false\nCategories=Office;\nStartupWMClass=fantasywriter\nStartupNotify=true\n`;
  try {
    if ((await fsp.readFile(file, 'utf8').catch(() => '')) === text && fs.existsSync(icon)) return;
    await fsp.mkdir(path.dirname(icon), { recursive: true });
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.copyFile(path.join(__dirname, 'assets', 'icon.png'), icon);
    await fsp.writeFile(file, text);
    // Menü-Zwischenspeicher der Desktop-Umgebung auffrischen (was es nicht gibt, schlägt still fehl)
    for (const [cmd, args] of [['update-desktop-database', [path.dirname(file)]], ['kbuildsycoca6', []], ['kbuildsycoca5', []]]) execFile(cmd, args, () => {});
  } catch (e) { console.error('Starter-Eintrag nicht angelegt:', e.message); }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1500, height: 960, minWidth: 1000, minHeight: 600, autoHideMenuBar: true, backgroundColor: '#1c1b22', title: 'FantasyWriter', icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), sandbox: false, spellcheck: true },
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  const wc = win.webContents;
  win.on('page-title-updated', e => { e.preventDefault(); win.setTitle('FantasyWriter ' + app.getVersion()); });
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-navigate', e => e.preventDefault());
  wc.on('context-menu', (e, p) => {
    const items = p.dictionarySuggestions.map(s => ({ label: s, click: () => wc.replaceMisspelling(s) }));
    if (p.misspelledWord) items.push({ label: `„${p.misspelledWord}“ ins Wörterbuch`, click: () => wc.session.addWordToSpellCheckerDictionary(p.misspelledWord) }, { type: 'separator' });
    if (p.isEditable) items.push({ role: 'cut', label: 'Ausschneiden' }, { role: 'copy', label: 'Kopieren' }, { role: 'paste', label: 'Einfügen' }, { role: 'selectAll', label: 'Alles auswählen' });
    else if (p.selectionText) items.push({ role: 'copy', label: 'Kopieren' });
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });
}
app.whenReady().then(() => {
  const ses = session.defaultSession;
  const langs = ['de-DE', 'en-US'].filter(l => ses.availableSpellCheckerLanguages.includes(l));
  if (langs.length) ses.setSpellCheckerLanguages(langs);
  if (process.env.FW_TEST) return require(process.env.FW_TEST)({ renderPdf, buildEpub, importXpi, createWindow, getWin: () => win });
  installLauncher();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
