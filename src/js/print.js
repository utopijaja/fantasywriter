import { renderStatic, esc, fontCss, fileUrl } from './layout.js';

const TOC_PER_SHEET = 24;

window.api.onPrintData(async ({ book, chapters, opts }) => {
  const st = document.documentElement.style;
  st.setProperty('--title-font', fontCss(book.titleFont));
  st.setProperty('--body-font', fontCss(book.bodyFont));
  st.setProperty('--body-size', (book.fontSize || 11) + 'pt');
  if (opts.background && opts.pageImage) {
    st.setProperty('--page-img', `url("${opts.pageImage}")`);
    st.setProperty('--page-img-opacity', opts.pageOpacity);
  }
  const lang = book.lang || 'de';
  const front = document.createElement('div');
  front.className = 'pages';
  document.body.append(front);

  let start = 1;
  const toc = [];
  for (const ch of chapters) {
    const root = document.createElement('div');
    document.body.append(root);
    const n = renderStatic(root, { html: ch.html, title: ch.title, images: ch.images || [], gap: 0, startPage: start, bookTitle: book.title, dir: book.dir + '/images', lang });
    toc.push({ title: ch.title, page: start });
    start += n;
  }
  let html = `<div class="sheet front"><h1>${esc(book.title)}</h1><p>${esc(book.author)}</p></div>`;
  for (let i = 0; i < toc.length; i += TOC_PER_SHEET) {
    html += `<div class="sheet toc">${i ? '' : '<h2>Inhalt</h2>'}${toc.slice(i, i + TOC_PER_SHEET).map(t => `<div><span>${esc(t.title)}</span><i></i><span>${t.page}</span></div>`).join('')}</div>`;
  }
  front.innerHTML = html;
  front.style.breakBefore = 'auto';

  await document.fonts.ready;
  await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  window.api.printReady();
});
