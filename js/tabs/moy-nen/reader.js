// Читалка статьи НЭН — экраны 3 и 13. Общая для всех вкладок: /statya/:id.
// Статьи веб-версии вшиты в сборку и читаются без сети; экран 13 — для того, чего в сборке нет.
import { html, useEffect } from '../../lib.js?v=20';
import { useStore, isSaved } from '../../store.js?v=20';
import { dateLong } from '../../age.js?v=20';
import { SecTitle, SaveButton, Ill } from '../../ui.js?v=20';
import { track } from '../../stats.js?v=20';
import { articleById, ARTICLES } from '../../content/articles.js?v=20';
import { Inner, ArticleRow, readingFor, todays, savedItem, useOffline, openSite } from './util.js?v=20';

const fullDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${dateLong(new Date(y, m - 1, d).getTime())} ${y}`; };

// Текст абзацами: подзаголовки и списки — как в статье на сайте
function Body({ a }) {
  const heads = new Set(a.h || []), items = new Set(a.li || []);
  const out = [];
  let list = null;
  a.body.forEach((p, i) => {
    if (items.has(i)) { (list = list || []).push(html`<li>${p}</li>`); return; }
    if (list) { out.push(html`<ul>${list}</ul>`); list = null; }
    out.push(heads.has(i) ? html`<h3>${p}</h3>` : html`<p>${p}</p>`);
  });
  if (list) out.push(html`<ul>${list}</ul>`);
  return html`<div class="prose mn-prose">${out}</div>`;
}

// Повод вернуться: ещё две статьи для возраста ребёнка из шапки
function More({ s, skip }) {
  const r = readingFor(s);
  const list = todays(r.list.filter((x) => x.id !== skip), undefined, 2);
  if (!list.length) return null;
  return html`
    <${SecTitle}>${r.more}<//>
    <div class="rows">${list.map((x) => html`<${ArticleRow} a=${x} from="статья-ещё" full />`)}</div>`;
}

function Reader({ params }) {
  const s = useStore();
  const offline = useOffline(s);
  const a = articleById(params.id);
  useEffect(() => { track(a ? 'статья:открыта' : 'статья:нет-в-сборке'); }, [params.id]);

  // Экран 13: статьи нет в сборке (например, сохранили в прошлой версии) — заголовок, лид и что читается сейчас
  if (!a) {
    const it = s.saved.find((x) => x.kind === 'article' && x.id === params.id);
    const readable = s.saved.filter((x) => x.kind === 'article' && articleById(x.id));
    return html`
      <div class="screen">
        <${Inner} eyebrow="" title=${it ? it.title : 'Этой статьи здесь нет'} />
        ${it && it.lead && html`<p class="lead">${it.lead}</p>`}
        ${it && html`<div class="mn-save"><${SaveButton} item=${{ ...it }} /></div>`}
        <p class="small">${offline
          ? 'Полный текст — на сайте НЭН, когда появится сеть. В пробную версию эта статья не вошла.'
          : 'В пробную версию эта статья не вошла — полный текст на сайте НЭН.'}</p>
        ${!offline && it && it.url && html`<button class="btn btn-gray" onClick=${() => openSite(it.url, 'статья')}>Открыть на сайте</button>`}
        <${SecTitle}>Читается без сети<//>
        <div class="rows">
          ${[...readable.map((x) => articleById(x.id)), ...todays(readingFor(s).list, undefined, 3)]
            .filter((x, i, arr) => arr.findIndex((y) => y.id === x.id) === i).slice(0, 3)
            .map((x) => html`<${ArticleRow} a=${x} from="статья-без-сети" full sub=${isSaved('article', x.id) ? '✓ Сохранено' : ''} />`)}
        </div>
      </div>`;
  }

  const saved = isSaved('article', a.id);
  return html`
    <div class="screen">
      <${Inner} eyebrow=${a.fromM === -4 ? 'Сегодня в НЭН' : ''} />
      <h1 class="h1 mn-h1">${a.title}</h1>
      <p class="small">${a.author ? a.author + ' · ' : ''}${fullDate(a.date)}</p>
      <${Ill} big id=${a.id} />
      <${Body} a=${a} />
      ${a.cut && html`<p class="small">${offline
        ? 'Продолжение — на сайте НЭН, когда появится сеть.'
        : html`Продолжение — <button class="mn-link" onClick=${() => openSite(a.url, 'продолжение')}>на сайте НЭН</button>.`}</p>`}
      <div class="mn-save"><${SaveButton} item=${savedItem(a)} /></div>
      <p class="small mn-under">${saved ? 'Сохранено — прочитаете без сети.' : 'Сохраните — прочитаете без сети.'}</p>
      <${More} s=${s} skip=${a.id} />
    </div>`;
}

export const readerRoutes = [{ path: '/statya/:id', view: Reader }];

// Поиск: все статьи — по заголовку и лиду
export function articleSearch() {
  return ARTICLES.map((a) => ({ title: a.title, sub: a.fromM === -4 ? 'Сегодня в НЭН' : '', path: '/statya/' + a.id, text: a.title + ' ' + a.lead }));
}
