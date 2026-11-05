// Общие экраны: «Сохранённое» (сердечко в шапке), поиск (лупа в шапке)
// и помощник (капсула «✦ Спросить» над меню).
import { html, useState } from './lib.js';
import { useStore, getState, activeChild } from './store.js';
import { go } from './router.js';
import { Back, Row, SecTitle } from './ui.js';
import { track } from './stats.js';
import { genitive } from './onboarding.js';

// Модули вкладок передаёт каркас (app.js), когда они загрузились
let tabModules = [];
export function setTabModules(m) { tabModules = m; }

const KIND = { article: 'Статьи', fact: 'Факты по возрасту', activity: 'Занятия', tale: 'Сказки и колыбельные', practice: 'Для себя', idea: 'Идеи', other: 'Другое' };

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

// Поиск по словам: для вопроса целиком («Почему Соня просыпается ночью?») — по основам слов,
// без служебных слов и имени ребёнка. Одно слово ищем как раньше — вхождением.
const STOP = new Set(('почему зачем когда как какой какая какое какие что чего чем сколько можно нужно надо пора ли это этот эта эти ' +
  'мой моя мое мои мне нам наш наша наши если или уже еще очень все так такое там тут где кто для про при над под без был была ' +
  'было будет есть нет она они его ее ему ей вот лет год года месяц месяца месяцев малыш малыша малышу ребенок ребенка ребенку дети детей').split(' '));
const stem = (w) => (w.length <= 3 ? w : w.length <= 5 ? w.slice(0, -1) : w.length <= 8 ? w.slice(0, -2) : w.slice(0, -4));
export function findItems(q, { name = '', limit = 40 } = {}) {
  const n = norm(q.trim());
  if (n.length < 2) return [];
  const seen = new Set();
  const uniq = (arr) => arr.filter((it) => !seen.has(it.path) && seen.add(it.path));
  const all = allItems();
  if (!/\s/.test(n)) return uniq(all.filter((it) => norm(it.title + ' ' + (it.sub || '') + ' ' + (it.text || '')).includes(n))).slice(0, limit);
  const own = norm(name);
  const stems = [...new Set(n.split(/[^a-zа-я0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w) && w !== own && !(own && w.startsWith(own.slice(0, -1)))).map(stem))];
  if (!stems.length) return [];
  const need = Math.min(2, stems.length);
  return uniq(all.map((it) => {
    const t = norm(it.title);
    const rest = norm((it.sub || '') + ' ' + (it.text || ''));
    let sc = 0; let hit = 0;
    for (const x of stems) { if (t.includes(x)) { sc += 3; hit += 1; } else if (rest.includes(x)) { sc += 1; hit += 1; } }
    return { it, sc, hit };
  }).filter((x) => x.hit >= need || x.sc >= 3).sort((a, b) => b.sc - a.sc).map((x) => x.it)).slice(0, limit);
}

function Search({ query }) {
  const [q, setQ] = useState((query && query.q) || '');
  const n = norm(q.trim());
  const res = findItems(q);
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
          <${Row} title=${`✦ Спросить помощника про «${q.trim()}»`} sub="Ответит своими словами по вашим записям и статьям НЭН · в Плюсе"
            onClick=${() => { track('поиск:помощник'); go('/sprosit?q=' + encodeURIComponent(q.trim())); }} />
        </div>`}
    </div>`;
}

// Помощник — в Плюсе. С первого экрана видно, что он платный; в пробной версии он не отвечает,
// но вопрос не уходит в пустоту: на втором экране — всё, что у НЭН есть по этому вопросу.
const childName = (s) => { const c = activeChild(s); return c && !c.expecting && c.name ? c.name : null; };

function Ask({ query }) {
  const s = useStore();
  const name = childName(s);
  const [q, setQ] = useState((query && query.q) || '');
  const examples = [`Почему ${name || 'малыш'} просыпается ночью?`, 'Когда пора вводить прикорм?', 'Сколько гулять в мороз?'];
  const ask = (text) => { const t = (text || q).trim(); if (!t) return; track('помощник:вопрос'); go('/sprosit/otvet?q=' + encodeURIComponent(t)); };
  return html`
    <div class="screen">
      <${Back} title="Спросите НЭН" />
      <div class="ask-badge">✦ Помощник · в Плюсе</div>
      <p class="p">Спросите своими словами. Помощник посмотрит ${name ? 'записи ' + genitive(name) : 'ваши записи'} и статьи НЭН и ответит коротко, со ссылками.</p>
      <label class="field"><span class="label">Ваш вопрос</span>
        <textarea value=${q} placeholder="Например, сколько сна нужно в этом возрасте" onInput=${(e) => setQ(e.target.value)}></textarea></label>
      <div class="pills">${examples.map((w) => html`<button class="pill" onClick=${() => ask(w)}>${w}</button>`)}</div>
      <button class="btn btn-primary" disabled=${!q.trim()} onClick=${() => ask()}>Спросить</button>
      <p class="small">Это ИИ. Диагнозов он не ставит: если тревожно, звоните врачу.</p>
    </div>`;
}

function Answer({ query }) {
  const s = useStore();
  const name = childName(s);
  const q = ((query && query.q) || '').trim();
  const res = findItems(q, { name: name || '', limit: 8 });
  return html`
    <div class="screen">
      <${Back} />
      <div class="ask-q">${q}</div>
      <div class="card ask-plus">
        <div class="h2">✦ Ответ помощника — в Плюсе</div>
        <p class="small">Помощник прочитал бы ${res.length ? 'статьи ниже' : 'статьи НЭН'} и ${name ? 'записи ' + genitive(name) : 'ваши записи'} и ответил бы коротко. В пробной версии он пока молчит.</p>
      </div>
      ${res.length ? html`
        <${SecTitle}>Что есть у НЭН по вашему вопросу<//>
        <div class="rows">${res.map((it) => html`<${Row} title=${it.title} sub=${it.sub} onClick=${() => { track('помощник:открыть'); go(it.path); }} />`)}</div>`
      : html`<p class="empty">Прямо по этому вопросу у НЭН пока ничего нет. Попробуйте спросить иначе — или поищите одним словом.</p>`}
      <button class="btn btn-gray" onClick=${() => go('/sprosit', { replace: true })}>Спросить ещё</button>
    </div>`;
}

export const commonRoutes = [
  { path: '/sohranyonnoe', view: Saved },
  { path: '/poisk', view: Search, noAsk: true },
  { path: '/sprosit', view: Ask, noAsk: true },
  { path: '/sprosit/otvet', view: Answer, noAsk: true },
];
