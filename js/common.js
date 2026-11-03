// Общие экраны: «Сохранённое» (сердечко в шапке) и поиск (кнопка помощника).
import { html, useState } from './lib.js';
import { useStore, getState } from './store.js';
import { go } from './router.js';
import { Back, Row, SecTitle } from './ui.js';
import { track } from './stats.js';

// Модули вкладок передаёт каркас (app.js), когда они загрузились
let tabModules = [];
export function setTabModules(m) { tabModules = m; }

const KIND = { article: 'Статьи', fact: 'Нет, это нормально', activity: 'Занятия', tale: 'Сказки и колыбельные', practice: 'Для себя', idea: 'Идеи', other: 'Другое' };

function Saved() {
  const s = useStore();
  const groups = {};
  for (const it of s.saved) (groups[it.kind] = groups[it.kind] || []).push(it);
  return html`
    <div class="screen">
      <${Back} title="Сохранённое" />
      ${!s.saved.length && html`<p class="lead">Здесь соберётся всё, что сохраните сердечком: статьи, факты, занятия, сказки, практики.</p>
        <p class="small">Сохраняется на этом телефоне и открывается без интернета.</p>`}
      ${Object.entries(groups).map(([k, items]) => html`
        <${SecTitle}>${KIND[k] || KIND.other}<//>
        <div class="rows">${items.map((it) => html`<${Row} title=${it.title} sub=${it.sub} onClick=${() => { track('сохранённое:открыть'); go(it.route); }} />`)}</div>`)}
    </div>`;
}

// Поиск по приложению: каждая вкладка отдаёт, что у неё можно найти
function allItems() {
  const s = getState();
  return tabModules.flatMap((m) => { try { return m.searchItems ? m.searchItems(s) : []; } catch (e) { return []; } });
}
const norm = (x) => (x || '').toLowerCase().replace(/ё/g, 'е');

function Search() {
  const [q, setQ] = useState('');
  const n = norm(q.trim());
  const seen = new Set();
  const res = n.length < 2 ? [] : allItems()
    .filter((it) => norm(it.title + ' ' + (it.sub || '') + ' ' + (it.text || '')).includes(n))
    .filter((it) => !seen.has(it.path) && seen.add(it.path))
    .slice(0, 40);
  return html`
    <div class="screen">
      <${Back} />
      <label class="field"><span class="label">Найти в приложении и в НЭН</span>
        <input autofocus value=${q} placeholder="Например, колики или прикорм" onInput=${(e) => setQ(e.target.value)} onBlur=${() => n && track('поиск')} /></label>
      ${n.length < 2 && html`
        <p class="small">Поиск по статьям, фактам, занятиям, сказкам и практикам. Работает и без интернета — всё это уже на телефоне.</p>
        <${SecTitle}>Часто ищут<//>
        <div class="pills">${['колики', 'сон', 'прикорм', 'прививки', 'зубы', 'температура', 'кризис'].map((w) => html`<button class="pill" onClick=${() => setQ(w)}>${w}</button>`)}</div>`}
      ${n.length >= 2 && !res.length && html`<p class="empty">Ничего не нашли. Попробуйте другое слово — например, «плач» вместо «колики».</p>`}
      <div class="rows">${res.map((it) => html`<${Row} title=${it.title} sub=${it.sub} onClick=${() => { track('поиск:открыть'); go(it.path); }} />`)}</div>
    </div>`;
}

export const commonRoutes = [
  { path: '/sohranyonnoe', view: Saved },
  { path: '/poisk', view: Search },
];
