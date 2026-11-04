// Общие экраны: «Сохранённое» (сердечко в шапке), поиск (лупа в шапке)
// и помощник (капсула «✦ Спросить» над меню).
import { html, useState } from './lib.js';
import { useStore, getState, activeChild } from './store.js';
import { go } from './router.js';
import { Back, Row, SecTitle, openSheet, closeSheet } from './ui.js';
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

function Search({ query }) {
  const [q, setQ] = useState((query && query.q) || '');
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
      ${n.length >= 2 && html`
        <div class="rows">
          <${Row} title=${`✦ Спросить про «${q.trim()}»`} sub="Помощник ответит по вашим записям и статьям НЭН · в Плюсе"
            onClick=${() => { track('поиск:помощник'); go('/sprosit?q=' + encodeURIComponent(q.trim())); }} />
        </div>`}
    </div>`;
}

// Помощник — в Плюсе. В веб-версии он не отвечает: считаем, сколько людей до него дошли.
function AskPlusSheet() {
  return html`
    <div class="h2">Помощник — в Плюсе</div>
    <p class="small">Он отвечает на вопрос о ребёнке по вашим записям и статьям НЭН. Поиск остаётся бесплатным.</p>
    <p class="tiny">Пробная версия: здесь помощник не отвечает. Мы отметили, что он вам нужен.</p>
    <button class="btn btn-primary" onClick=${() => { closeSheet(); go('/poisk'); }}>К поиску</button>
    <button class="btn-quiet" onClick=${closeSheet}>Не сейчас</button>`;
}

function Ask({ query }) {
  const s = useStore();
  const child = activeChild(s);
  const name = child && !child.expecting && child.name ? child.name : null;
  const [q, setQ] = useState((query && query.q) || '');
  const examples = [`Почему ${name || 'малыш'} просыпается ночью?`, 'Когда пора вводить прикорм?', 'Сколько гулять в мороз?'];
  return html`
    <div class="screen">
      <${Back} title="Спросите НЭН" />
      <p class="small">ИИ-помощник отвечает по вашим записям и статьям НЭН. Диагнозов не ставит: если тревожно, звоните врачу.</p>
      <label class="field"><span class="label">Ваш вопрос</span>
        <textarea value=${q} placeholder="Например, сколько сна нужно в этом возрасте" onInput=${(e) => setQ(e.target.value)}></textarea></label>
      <div class="pills">${examples.map((w) => html`<button class="pill" onClick=${() => setQ(w)}>${w}</button>`)}</div>
      <button class="btn btn-primary" disabled=${!q.trim()} onClick=${() => { track('помощник:вопрос'); openSheet(AskPlusSheet); }}>Спросить</button>
    </div>`;
}

export const commonRoutes = [
  { path: '/sohranyonnoe', view: Saved },
  { path: '/poisk', view: Search, noAsk: true },
  { path: '/sprosit', view: Ask, noAsk: true },
];
