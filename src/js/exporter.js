import { esc, fontCss, stripShy } from './layout.js';
import { $, S, api, guard, toast, setSettings, saveBookNow } from './core.js';
import { flush, currentChapter } from './editor.js';
import { pageBackground } from './themes.js';

async function collect() {
  await flush(); await saveBookNow();
  const cur = currentChapter(), out = [];
  for (const c of S.book.chapters) {
    const d = cur && cur.id === c.id ? cur : await api('chapter:load', S.book.id, c.id);
    out.push({ id: c.id, title: c.title, html: stripShy(d.html || ''), images: d.images || [] });
  }
  return out;
}

// EPUB kennt keine frei platzierten Bilder: sie stehen vor dem Absatz, neben dem sie auf der Seite liegen
function toXhtml(ch) {
  const doc = new DOMParser().parseFromString(`<div class="chapter"><h1></h1>${ch.html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  root.firstElementChild.textContent = ch.title;
  const blocks = [...root.children].slice(1);
  for (const im of [...ch.images].sort((a, b) => (b.anchor || 0) - (a.anchor || 0))) {
    const fig = doc.createElement('figure');
    const img = doc.createElement('img');
    img.setAttribute('src', 'images/' + encodeURIComponent(im.file)); img.setAttribute('alt', '');
    fig.append(img);
    const before = blocks[im.anchor || 0];
    if (before) root.insertBefore(fig, before); else root.append(fig);
  }
  root.querySelectorAll('[contenteditable],[spellcheck]').forEach(e => { e.removeAttribute('contenteditable'); e.removeAttribute('spellcheck'); });
  return new XMLSerializer().serializeToString(root);
}

$('#btn-export').onclick = () => {
  if (!S.book) return;
  const dlg = $('#dlg-export');
  $('#export-bg').checked = !!S.settings.exportBg;
  dlg.onclose = () => guard(async () => {
    const kind = dlg.returnValue;
    if (kind !== 'pdf' && kind !== 'epub') return;
    const background = $('#export-bg').checked;
    setSettings({ exportBg: background });
    toast('Export läuft …', 60000);
    const chapters = await collect();
    let file;
    if (kind === 'pdf') {
      file = await api('export:pdf', { book: S.book, chapters, opts: { background, ...pageBackground() } });
    } else {
      const css = `body{font-family:${fontCss(S.book.bodyFont)};line-height:1.5}h1,h2{font-family:${fontCss(S.book.titleFont)};font-weight:normal;text-align:center}h1{margin:2em 0 1.5em}p{margin:0;text-indent:1.3em;text-align:justify}p.scene{text-align:center;text-indent:0;margin:1.2em 0}figure{margin:1em 0;text-align:center}img{max-width:100%}.titlepage{text-align:center;margin-top:30%}.titlepage p{text-align:center;text-indent:0}`;
      file = await api('export:epub', {
        book: S.book, css,
        chapters: chapters.map(c => ({ title: c.title, xhtml: toXhtml(c) })),
        images: [...chapters.flatMap(c => c.images.map(i => i.file)), ...(S.book.cover ? [S.book.cover] : [])],
      });
    }
    toast(file ? 'Gespeichert: ' + file : 'Export abgebrochen.');
  });
  dlg.returnValue = '';
  dlg.showModal();
};
