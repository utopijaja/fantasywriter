import { esc, fileUrl, fontCss } from './layout.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const api = (ch, ...a) => window.api.invoke(ch, ...a);
export const uid = () => Math.random().toString(36).slice(2, 10);

// Gemeinsamer Zustand der Anwendung
export const S = { settings: {}, books: [], book: null, chapterId: null, view: 'chapter', themes: [], fonts: [] };

export const bookImg = name => fileUrl(S.book.dir + '/images', name);
export async function setSettings(patch) { Object.assign(S.settings, patch); await api('settings:set', patch); }

let bookTimer;
export function saveBookSoon() {
  clearTimeout(bookTimer);
  const b = S.book;
  bookTimer = setTimeout(() => api('book:save', b.id, b), 400);
}
export function saveBookNow() { clearTimeout(bookTimer); return S.book ? api('book:save', S.book.id, S.book) : null; }

let toastTimer;
export function toast(msg, ms = 4000) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
export async function guard(fn) {
  try { return await fn(); } catch (e) { toast(String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), 7000); return null; }
}

/* Allgemeiner Eingabedialog. fields: [{key,label,type,value,options}], type: text|textarea|select|font|image
   Gibt die Werte zurück, null bei Abbruch oder {_delete:true}. */
export function ask(title, fields, { danger } = {}) {
  const dlg = $('#dlg-ask'), box = $('.fields', dlg), vals = {};
  $('h3', dlg).textContent = title;
  box.innerHTML = '';
  for (const f of fields) {
    vals[f.key] = f.value ?? '';
    if (f.type === 'image') {
      const row = document.createElement('div');
      row.className = 'imgfield';
      row.innerHTML = `<div class="thumb"></div><span class="grow">${esc(f.label)}</span><button type="button">Bild wählen</button><button type="button">Entfernen</button>`;
      const show = () => { $('.thumb', row).style.backgroundImage = vals[f.key] ? `url("${bookImg(vals[f.key])}")` : ''; };
      const [pick, rm] = $$('button', row);
      pick.onclick = async () => { const [n] = await api('images:pick', S.book.id, false); if (n) { vals[f.key] = n; show(); } };
      rm.onclick = () => { vals[f.key] = null; show(); };
      show(); box.append(row);
      continue;
    }
    const lab = document.createElement('label');
    lab.textContent = f.label;
    let inp;
    if (f.type === 'textarea') inp = document.createElement('textarea');
    else if (f.type === 'select' || f.type === 'font') {
      inp = document.createElement('select');
      const opts = f.type === 'font' ? [['serif', 'Standard mit Serifen'], ['sans-serif', 'Standard ohne Serifen'], ...S.fonts.map(n => [n, n])] : f.options;
      for (const [v, l] of opts) { const o = new Option(l, v); if (f.type === 'font') o.style.fontFamily = fontCss(v); inp.add(o); }
    } else { inp = document.createElement('input'); inp.type = 'text'; if (f.list) { inp.setAttribute('list', 'ask-list'); } }
    inp.value = vals[f.key];
    inp.oninput = () => { vals[f.key] = inp.value; };
    lab.append(inp); box.append(lab);
    if (f.list) { const dl = document.createElement('datalist'); dl.id = 'ask-list'; for (const v of f.list) dl.append(new Option(v)); box.append(dl); }
  }
  const menu = $('menu', dlg);
  $('.danger', menu)?.remove();
  let deleted = false;
  if (danger) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'danger'; b.textContent = danger; b.style.marginRight = 'auto';
    b.onclick = () => { deleted = true; dlg.close('delete'); };
    menu.prepend(b);
  }
  return new Promise(res => {
    dlg.onclose = () => res(deleted ? { _delete: true } : dlg.returnValue === 'ok' ? vals : null);
    dlg.returnValue = '';
    dlg.showModal();
    const first = $('input,textarea', box); if (first) { first.focus(); first.select?.(); }
  });
}
