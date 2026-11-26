import { esc } from './layout.js';
import { $, S, api, uid, ask, saveBookSoon, bookImg } from './core.js';

const view = $('#worldview');
const KINDS = {
  figures: { title: 'Figuren', one: 'Figur', sub: 'Rolle (z. B. Heldin, Gegenspieler)' },
  places: { title: 'Orte', one: 'Ort', sub: 'Art (z. B. Stadt, Gebirge)' },
};
let mapId = null;
const world = () => (S.book.world ||= { figures: [], places: [], maps: [], timeline: [] });
const bg = img => (img ? ` style='background-image:url("${bookImg(img)}")'` : '');

export function renderWorld(kind) {
  if (kind === 'maps') return renderMaps();
  if (kind === 'timeline') return renderTimeline();
  const k = KINDS[kind], list = world()[kind];
  view.innerHTML = `<h2>${k.title}<button data-a="add">+ ${k.one}</button></h2><div class="cards">${list.map(e => `<div class="card" data-id="${e.id}"><div class="pic"${bg(e.image)}></div><div class="body"><b>${esc(e.name)}</b><small>${esc(e.sub)}</small><p>${esc(e.text)}</p></div></div>`).join('')}</div>${list.length ? '' : `<p class="hint">Noch keine Einträge.</p>`}`;
  view.onclick = async e => {
    const card = e.target.closest('.card');
    const isAdd = e.target.dataset.a === 'add';
    if (!card && !isAdd) return;
    const entry = isAdd ? { id: uid(), name: '', sub: '', image: null, text: '' } : list.find(x => x.id === card.dataset.id);
    const v = await ask(isAdd ? `${k.one} anlegen` : entry.name, [
      { key: 'name', label: 'Name', value: entry.name },
      { key: 'sub', label: k.sub, value: entry.sub },
      { key: 'image', label: 'Bild', type: 'image', value: entry.image },
      { key: 'text', label: 'Beschreibung', type: 'textarea', value: entry.text },
    ], isAdd ? {} : { danger: 'Löschen' });
    if (!v) return;
    if (v._delete) list.splice(list.indexOf(entry), 1);
    else { Object.assign(entry, v, { name: v.name.trim() || 'Ohne Namen' }); if (isAdd) list.push(entry); }
    saveBookSoon(); renderWorld(kind);
  };
}

function renderMaps() {
  const maps = world().maps;
  const map = maps.find(m => m.id === mapId) || maps[0];
  mapId = map && map.id;
  view.innerHTML = `<h2>Karten<button data-a="add">+ Karte</button>${map ? '<button data-a="rename">Umbenennen</button><button data-a="del">Karte löschen</button>' : ''}</h2>
    <div class="mapbar">${maps.map(m => `<button data-map="${m.id}" class="${m === map ? 'on' : ''}">${esc(m.name)}</button>`).join('')}</div>
    ${map ? `<p class="hint">Auf die Karte klicken, um einen Ort zu markieren. Auf eine Markierung klicken, um sie zu ändern.</p><div class="map"><img src="${bookImg(map.image)}" draggable="false" alt="">${map.pins.map(p => `<span class="pin" data-pin="${p.id}" style="left:${p.x}%;top:${p.y}%">${esc(p.label)}</span>`).join('')}</div>` : '<p class="hint">Noch keine Karte. Füge ein Kartenbild hinzu.</p>'}`;
  const places = world().places.map(p => p.name);
  view.onclick = async e => {
    const d = e.target.dataset;
    if (d.map) { mapId = d.map; return renderMaps(); }
    if (d.a === 'add') {
      const [img] = await api('images:pick', S.book.id, false);
      if (!img) return;
      const v = await ask('Neue Karte', [{ key: 'name', label: 'Name der Karte', value: 'Karte ' + (maps.length + 1) }]);
      if (!v) return;
      maps.push({ id: mapId = uid(), name: v.name.trim() || 'Karte', image: img, pins: [] });
    } else if (d.a === 'rename') {
      const v = await ask('Karte umbenennen', [{ key: 'name', label: 'Name', value: map.name }]);
      if (!v) return;
      map.name = v.name.trim() || map.name;
    } else if (d.a === 'del') {
      if (!confirm(`Karte „${map.name}“ löschen?`)) return;
      maps.splice(maps.indexOf(map), 1);
    } else if (d.pin) {
      const pin = map.pins.find(p => p.id === d.pin);
      const v = await ask('Markierung', [{ key: 'label', label: 'Bezeichnung', value: pin.label, list: places }], { danger: 'Löschen' });
      if (!v) return;
      if (v._delete) map.pins.splice(map.pins.indexOf(pin), 1); else pin.label = v.label.trim() || pin.label;
    } else if (e.target.closest('.map')) {
      const r = e.target.closest('.map').getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100, y = ((e.clientY - r.top) / r.height) * 100;
      const v = await ask('Ort markieren', [{ key: 'label', label: 'Bezeichnung (Orte aus dem Ortsverzeichnis werden vorgeschlagen)', value: '', list: places }]);
      if (!v || !v.label.trim()) return;
      map.pins.push({ id: uid(), x: +x.toFixed(2), y: +y.toFixed(2), label: v.label.trim() });
    } else return;
    saveBookSoon(); renderMaps();
  };
}

function renderTimeline() {
  const tl = world().timeline;
  view.innerHTML = `<h2>Zeitleiste<button data-a="add">+ Ereignis</button></h2><div class="tl">${tl.map(ev => `<div class="ev" data-id="${ev.id}"><input type="text" data-f="date" placeholder="Zeitpunkt (frei, z. B. Jahr 312, Frühling)" value="${esc(ev.date)}"><input type="text" data-f="title" placeholder="Ereignis" value="${esc(ev.title)}"><div class="btns"><button data-a="up" title="Früher">↑</button><button data-a="down" title="Später">↓</button><button data-a="del" title="Löschen">×</button></div><textarea data-f="text" placeholder="Was geschieht?">${esc(ev.text)}</textarea></div>`).join('')}</div>${tl.length ? '' : '<p class="hint">Noch keine Ereignisse.</p>'}`;
  view.oninput = e => {
    const row = e.target.closest('.ev');
    if (!row || !e.target.dataset.f) return;
    tl.find(x => x.id === row.dataset.id)[e.target.dataset.f] = e.target.value;
    saveBookSoon();
  };
  view.onclick = e => {
    const a = e.target.dataset.a;
    if (!a) return;
    if (a === 'add') tl.push({ id: uid(), date: '', title: '', text: '' });
    else {
      const i = tl.findIndex(x => x.id === e.target.closest('.ev').dataset.id);
      if (a === 'del') tl.splice(i, 1);
      else { const j = a === 'up' ? i - 1 : i + 1; if (j < 0 || j >= tl.length) return; [tl[i], tl[j]] = [tl[j], tl[i]]; }
    }
    saveBookSoon(); renderTimeline();
  };
}
export function leaveWorld() { view.onclick = null; view.oninput = null; view.innerHTML = ''; }
