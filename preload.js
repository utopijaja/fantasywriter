const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Electron liefert keine Silbentrennungs-Wörterbücher mit, daher eigene Trennung über weiche Trennstriche
const hy = {};
function hyph(lang) {
  if (!hy[lang]) {
    try { hy[lang] = require(lang === 'en' ? 'hyphen/en-us' : 'hyphen/de').hyphenateSync; } catch { hy[lang] = t => t; }
  }
  return hy[lang];
}

contextBridge.exposeInMainWorld('api', {
  invoke: (ch, ...a) => ipcRenderer.invoke(ch, ...a),
  hyphenate: (t, lang) => hyph(lang)(t, { minWordLength: 6 }),
  pathForFile: f => webUtils.getPathForFile(f),
  onPrintData: cb => ipcRenderer.on('print:data', (e, d) => cb(d)),
  printReady: () => ipcRenderer.send('print:ready'),
});
