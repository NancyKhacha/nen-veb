// «Ребёнок → Развитие» (экраны 5, 6): ориентиры возраста с датой отметки, лист «Видели?»,
// занятия лентой, заметка для педиатра, наблюдения, «Когда начинает» и страницы справочника.
import { html, useState } from '../../lib.js';
import { useStore, getState, update, now, uid } from '../../store.js';
import { Header, Back, SecTitle, Row, Ill, Pill, SaveButton, Field, openSheet, closeSheet, toast } from '../../ui.js';
import { DAY, dateLong, ageMonths, isPreterm, childAgeLine, startOfDay, dayKey } from '../../age.js';
import { CDC } from '../../content/reference.js';
import { activitiesFor, activityById, activityOfDay } from '../../content/activities.js';
import { SKILLS, CARE, ACT_EARLY, FAQ } from '../../content/rebyonok-spravka.js';
import { go } from '../../router.js';
import { track } from '../../stats.js';
import { R, rUpdate, forChild, bornChild, nameOf, Seg, FeedCard, isOffline, tasksOf, cap } from './util.js';
import { openNewMoment } from './momenty.js';

// Листы CDC по возрасту и подписи к ним
export const SHEETS = Object.entries(CDC).map(([key, v]) => ({ key, m: v.m, items: v.domains.flatMap((d) => d.items.map((it) => ({ ...it, domain: d.title }))), domains: v.domains })).sort((a, b) => a.m - b.m);
const LABEL = { 2: '2 месяца', 4: '4 месяца', 6: '6 месяцев', 9: '9 месяцев', 12: '1 год', 15: '1 год 3 месяца', 18: '1,5 года', 24: '2 года', 30: '2,5 года', 36: '3 года', 48: '4 года', 60: '5 лет' };
const GEN = { 2: '2 месяцев', 4: '4 месяцев', 6: '6 месяцев', 9: '9 месяцев', 12: 'года', 15: '1 года и 3 месяцев', 18: 'полутора лет', 24: '2 лет', 30: '2,5 лет', 36: '3 лет', 48: '4 лет', 60: '5 лет' };
const DAT = { 2: '2 месяцам', 4: '4 месяцам', 6: '6 месяцам', 9: '9 месяцам', 12: 'году', 15: '1 году и 3 месяцам', 18: 'полутора годам', 24: '2 годам', 30: '2,5 годам', 36: '3 годам', 48: '4 годам', 60: '5 годам' };
export const sheetGen = (sh) => GEN[sh.m];
export function currentSheet(months) {
  let cur = SHEETS[0];
  for (const sh of SHEETS) if (sh.m <= months) cur = sh;
  return cur;
}
// «Видели» — s.done['cdc:<ребёнок>:<id>'], «Ещё нет» — s.rebyonok.ms
export const seenAt = (child, id, s = getState()) => (s.done || {})['cdc:' + child.id + ':' + id] || null;
export const notYet = (child, id, s = getState()) => (forChild(R(s).ms, child.id)[id] || null);
export function lastSeen(child, s = getState()) {
  let best = null;
  for (const sh of SHEETS) for (const it of sh.items) { const at = seenAt(child, it.id, s); if (at && (!best || at > best.at)) best = { it, at, sheet: sh }; }
  return best;
}
const domainsLine = (sh) => [...new Set(sh.domains.map((d) => ({ 'Общение и эмоции': 'общение', 'Речь и понимание': 'речь', 'Мышление и игра': 'внимание', 'Движение': 'движение' }[d.title] || d.title.toLowerCase())))].join(', ');

function setMilestone(child, it, st) {
  const key = 'cdc:' + child.id + ':' + it.id;
  update((s) => {
    s.done = s.done || {};
    s.rebyonok = s.rebyonok || {};
    s.rebyonok.ms = s.rebyonok.ms || {};
    const ms = s.rebyonok.ms[child.id] = s.rebyonok.ms[child.id] || {};
    if (st === 'yes') { s.done[key] = now(); delete ms[it.id]; }
    else if (st === 'no') { delete s.done[key]; ms[it.id] = { st: 'no', at: now() }; }
    else { delete s.done[key]; delete ms[it.id]; }
  });
}

// ——— Лист «Видели?» ———
function SeenSheet({ childId, id, sheetKey }) {
  const s = useStore();
  const child = s.children.find((c) => c.id === childId);
  const sh = SHEETS.find((x) => x.key === sheetKey);
  const it = sh.items.find((x) => x.id === id);
  const was = seenAt(child, id, s) ? 'yes' : notYet(child, id, s) ? 'no' : null;
  const [st, setSt] = useState(was);
  const commit = (next = st) => {
    if (next === was) return;
    const before = was;
    setMilestone(child, it, next);
    track('развитие:' + (next === 'yes' ? 'видели' : next === 'no' ? 'ещё-нет' : 'снять'));
    toast({ text: next === 'yes' ? `Видели ${dateLong(now())}` : next === 'no' ? 'Попадёт в заметку для педиатра' : 'Отметку сняли', actions: [{ label: 'Отменить', onClick: () => setMilestone(child, it, before) }] });
  };
  return html`
    <div class="h2">${it.ru}</div>
    <div class="small">Ориентир ${GEN[sh.m]}</div>
    <div class="label">Видели?</div>
    <div class="pills">
      <${Pill} on=${st === 'yes'} onClick=${() => setSt(st === 'yes' ? null : 'yes')}>Видели<//>
      <${Pill} on=${st === 'no'} onClick=${() => setSt(st === 'no' ? null : 'no')}>Ещё нет<//>
    </div>
    <div class="label">Запомнить</div>
    <div class="pills"><button class="pill" onClick=${() => { commit('yes'); closeSheet(); openNewMoment(child, { text: it.ru }); }}>＋ Сохранить момент</button></div>
    <p class="small">«Ещё нет» — это не диагноз. Такие пункты сами попадут в заметку для педиатра.</p>
    <button class="btn btn-primary" onClick=${() => { commit(); closeSheet(); }}>Готово</button>`;
}
const openSeen = (child, it, sh) => { track('развитие:ориентир'); openSheet(SeenSheet, { childId: child.id, id: it.id, sheetKey: sh.key }); };

function MilestoneRow({ child, it, sh }) {
  const s = getState();
  const at = seenAt(child, it.id, s);
  const no = notYet(child, it.id, s);
  const sub = at ? `Видели ${dateLong(at)}` : no ? 'Пока нет — попадёт в заметку для педиатра' : 'Отметьте, когда увидите';
  return html`<${Row} title=${it.ru} sub=${sub} onClick=${() => openSeen(child, it, sh)} />`;
}

// Карточки занятий: сегодняшнее — первым
function activityCards(child, s, limit = 8) {
  const t = now();
  const m = ageMonths(child, t);
  const list = activitiesFor(Math.max(0, m));
  const today = activityOfDay(Math.max(0, m), dayKey(t), s.done || {}, t);
  const sorted = today ? [today, ...list.filter((a) => a.id !== today.id)] : list;
  return sorted.slice(0, limit).map((a) => ({ a, label: (s.done || {})['activity:' + a.id] ? 'Сделали' : today && a.id === today.id ? 'На сегодня' : 'Занятие' }));
}

function Development({ query }) {
  const s = useStore();
  const [pick, setPick] = useState(null);
  const child = bornChild(s);
  if (!child) return html`<div class="screen"><${Header} /><h1 class="h1">Развитие</h1><p class="lead">Ориентиры и занятия появятся, когда малыш родится.</p></div>`;
  const t = now();
  const m = ageMonths(child, t);
  const cur = currentSheet(Math.max(0, m));
  const idx = SHEETS.indexOf(cur);
  const tabs = SHEETS.slice(idx, idx + 3);
  const sh = SHEETS.find((x) => x.key === (pick || query.list)) || cur;
  const items = [...sh.items].sort((a, b) => (seenAt(child, a.id, s) ? 1 : 0) - (seenAt(child, b.id, s) ? 1 : 0) || (seenAt(child, b.id, s) || 0) - (seenAt(child, a.id, s) || 0));
  const no = SHEETS.flatMap((x) => x.items).filter((it) => notYet(child, it.id, s)).length;
  const qs = (forChild(R(s).questions, child.id) || []).length || 0;
  const visit = tasksOf(child, s).filter((x) => !x.done && x.kind === 'doctor' && x.when >= startOfDay(t)).sort((a, b) => a.when - b.when)[0];
  const obs = forChild(R(s).obs, child.id) || [];
  const obsList = Array.isArray(obs) ? obs : [];
  const n = no + qs;
  const cards = activityCards(child, s);
  const early = m < 2;
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Развитие</h1>
      <${Seg} items=${tabs.map((x) => [x.key, LABEL[x.m]])} value=${tabs.includes(sh) ? sh.key : null} onChange=${(k) => { track('развитие:лист'); setPick(k); }} />
      ${!tabs.includes(sh) && html`<p class="small">Прошлый лист — ориентиры ${GEN[sh.m]}. <button class="link" onClick=${() => setPick(cur.key)}>К нынешнему ›</button></p>`}
      <p class="quote">В списке — то, что умеет большинство детей к ${DAT[sh.m]}. Кто-то раньше, кто-то позже.${isPreterm(child) && m < 24 ? ' Ребёнок родился раньше срока, поэтому развитие сверяют по исправленному возрасту.' : ''}</p>
      ${early && sh === cur && html`<p class="small">Первый лист ориентиров — к 2 месяцам. Пока — занятия для первых недель ниже.</p>`}
      <${SecTitle}>Ориентиры ${GEN[sh.m]}<//>
      <div class="rows">
        ${items.slice(0, 4).map((it) => html`<${MilestoneRow} key=${it.id} child=${child} it=${it} sh=${sh} />`)}
        <${Row} title=${`Все ориентиры ${GEN[sh.m]}`} sub=${cap(domainsLine(sh))} onClick=${() => { track('развитие:все-ориентиры'); go('/rebyonok/razvitie/orientiry/' + sh.key); }} />
      </div>
      ${idx > 0 && html`<div class="pills">${SHEETS.slice(0, idx).reverse().slice(0, 4).map((x) => html`<button class="pill" onClick=${() => { track('развитие:прошлый-лист'); setPick(x.key); }}>${LABEL[x.m]}</button>`)}</div>`}
      <${SecTitle} more="Все" onMore=${() => { track('развитие:все-занятия'); go('/rebyonok/razvitie/zanyatiya'); }}>Занятия для ${monthsGen(m)}<//>
      <div class="feed">${cards.map(({ a, label }) => html`<${FeedCard} key=${a.id} label=${label} title=${a.title} onClick=${() => { track('развитие:занятие'); go('/rebyonok/zanyatie/' + a.id); }} />`)}</div>
      <${SecTitle}>Для врача и для себя<//>
      <div class="rows">
        <${Row} title="Заметка для педиатра" sub=${n ? `${n} ${n === 1 ? 'пункт' : n < 5 ? 'пункта' : 'пунктов'} ${visit ? 'к осмотру ' + dateLong(visit.when) : 'к ближайшему осмотру'}` : 'Что рассказать на осмотре'} onClick=${() => { track('развитие:заметка'); go('/rebyonok/razvitie/zametka'); }} />
        <${Row} title="Наблюдения" sub=${obsList.length ? `${obsList.length} ${obsList.length === 1 ? 'запись' : obsList.length < 5 ? 'записи' : 'записей'} · последняя ${dateLong(obsList[0].at)}` : 'Что заметили — своими словами'} onClick=${() => { track('развитие:наблюдения'); go('/rebyonok/razvitie/nablyudeniya'); }} />
        <${Row} title="Когда начинает" sub="Когда обычно начинают держать голову, сидеть, ходить" onClick=${() => { track('развитие:когда'); go('/rebyonok/razvitie/kogda'); }} />
        <${Row} title="Сон, экраны и движение" sub="Сколько спать, смотреть экран и двигаться — по возрасту" onClick=${() => { track('развитие:сон-экраны'); go('/rebyonok/razvitie/son-ekrany'); }} />
        <${Row} title="Когда поговорить с врачом" sub="Нет навыка из списка, навык пропал или вас что-то беспокоит" onClick=${() => { track('развитие:к-врачу'); go('/rebyonok/razvitie/k-vrachu'); }} />
        <${Row} title="Частые вопросы" sub="«Это задержка?», «По какому возрасту смотреть недоношенным?»" onClick=${() => { track('развитие:вопросы'); go('/rebyonok/razvitie/voprosy'); }} />
      </div>
    </div>`;
}
// «для 2 месяцев», «для 1 года и 8 месяцев»
function monthsGen(m) {
  const mon = (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'месяца' : 'месяцев'}`;
  if (m < 1) return 'первых недель';
  if (m < 12) return mon(m);
  const y = Math.floor(m / 12), r = m % 12;
  const yy = `${y} ${y % 10 === 1 && y % 100 !== 11 ? 'года' : 'лет'}`;
  return y >= 3 || !r ? yy : `${yy} и ${mon(r)}`;
}

// Все ориентиры листа — по разделам
function AllMilestones({ params }) {
  const s = useStore();
  const child = bornChild(s);
  const sh = SHEETS.find((x) => x.key === params.key);
  if (!child || !sh) return html`<div class="screen"><${Back} title="Ориентиры" to="/rebyonok/razvitie" /><p class="empty">Такого листа нет.</p></div>`;
  const seen = sh.items.filter((it) => seenAt(child, it.id, s)).length;
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Ориентиры ${GEN[sh.m]}</h1>
      <p class="small">Видели ${seen} из ${sh.items.length}. Касание — отметить.</p>
      ${sh.domains.map((d) => html`<${SecTitle}>${d.title}<//><div class="rows">${d.items.map((it) => html`<${MilestoneRow} key=${it.id} child=${child} it=${it} sh=${sh} />`)}</div>`)}
      <button class="btn btn-gray" onClick=${() => go('/rebyonok/razvitie')}>К развитию</button>
    </div>`;
}

function Activities() {
  const s = useStore();
  const child = bornChild(s);
  if (!child) return html`<div class="screen"><${Back} title="Занятия" to="/rebyonok" /></div>`;
  const cards = activityCards(child, s, 100);
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Занятия</h1>
      <p class="small">Для возраста ${nameOf(child)} — ${cards.length}. Сделанное отмечено.</p>
      <div class="rows">${cards.map(({ a, label }) => html`<${Row} key=${a.id} title=${a.title} sub=${label} onClick=${() => go('/rebyonok/zanyatie/' + a.id)} />`)}</div>
    </div>`;
}

// ——— Занятие ———
function Activity({ params }) {
  const s = useStore();
  const a = activityById(params.id);
  if (!a) return html`<div class="screen"><${Back} title="Занятие" to="/rebyonok/razvitie" /><p class="empty">Такого занятия нет. Остальные — в «Развитии».</p><button class="btn btn-primary" onClick=${() => go('/rebyonok/razvitie')}>К занятиям</button></div>`;
  const key = 'activity:' + a.id;
  const done = (s.done || {})[key];
  const offline = isOffline(s);
  const toggle = () => {
    const prev = done;
    update((d) => { d.done = d.done || {}; if (prev) delete d.done[key]; else d.done[key] = now(); });
    track('занятие:' + (prev ? 'снять' : 'сделали'));
    if (!prev) toast({ text: 'Отметили — следующее занятие предложим завтра', actions: [{ label: 'Отменить', onClick: () => update((d) => { delete d.done[key]; }) }] });
  };
  return html`
    <div class="screen">
      <${Back} />
      <${Ill} big />
      <div class="tiny">Занятие${done ? ' · сделали ' + dateLong(done) : ''}</div>
      <h1 class="h1">${a.title}</h1>
      <p class="p">${a.text}</p>
      <div class="note-box">По материалу НЭН «${a.source}»${a.url ? html` · <a class="link" href=${a.url} target="_blank" rel="noopener">${offline ? 'нужна сеть' : 'читать на сайте'}</a>` : ''}</div>
      <button class=${'btn ' + (done ? 'btn-gray' : 'btn-primary')} onClick=${toggle}>${done ? '✓ Сделали' : 'Сделали'}</button>
      <div class="actions"><${SaveButton} item=${{ kind: 'activity', id: a.id, title: a.title, sub: 'Занятие', route: '/rebyonok/zanyatie/' + a.id }} /></div>
      <button class="btn-quiet" onClick=${() => go('/rebyonok/razvitie/zanyatiya')}>Другие занятия для этого возраста</button>
    </div>`;
}

// ——— Заметка для педиатра ———
function Memo() {
  const s = useStore();
  const child = bornChild(s);
  const [q, setQ] = useState('');
  if (!child) return html`<div class="screen"><${Back} title="Заметка для педиатра" to="/rebyonok" /></div>`;
  const t = now();
  const sh = currentSheet(Math.max(0, ageMonths(child, t)));
  const yes = sh.items.filter((it) => seenAt(child, it.id, s));
  const no = SHEETS.flatMap((x) => x.items).filter((it) => notYet(child, it.id, s));
  const qs = forChild(R(s).questions, child.id);
  const list = Array.isArray(qs) ? qs : [];
  const add = () => { const id = uid(); rUpdate((r) => { r.questions = r.questions || {}; r.questions[child.id] = [{ id, text: q.trim(), at: now() }, ...(r.questions[child.id] || [])]; }); setQ(''); track('развитие:вопрос'); };
  const del = (id) => rUpdate((r) => { r.questions[child.id] = (r.questions[child.id] || []).filter((x) => x.id !== id); });
  const text = [`${nameOf(child)}. Возраст: ${childAgeLine(child, t)}. ${dateLong(t)}.`, '',
    `Уже умеет (${yes.length}):`, ...(yes.length ? yes.map((x) => '— ' + x.ru) : ['— пока ничего не отмечено']), '',
    `Пока не делает или не уверены (${no.length}):`, ...(no.length ? no.map((x) => '— ' + x.ru) : ['— всё отмечено']), '',
    ...(list.length ? ['Мои вопросы:', ...list.map((x) => '— ' + x.text), ''] : [])].join('\n');
  const share = () => { track('развитие:заметка-поделиться'); if (navigator.share) navigator.share({ text }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast({ text: 'Скопировали — можно вставить в сообщение', ms: 2500 })); };
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Заметка для педиатра</h1>
      <p class="small">${childAgeLine(child, t)} · ориентиры ${GEN[sh.m]}</p>
      <${SecTitle}>Уже умеет · ${yes.length}<//>
      ${yes.length ? html`<ul class="rb-list">${yes.map((x) => html`<li>${x.ru}</li>`)}</ul>` : html`<p class="small">Пока ничего не отмечено — отметки ставятся в «Развитии».</p>`}
      <${SecTitle}>Пока не делает или не уверены · ${no.length}<//>
      ${no.length ? html`<ul class="rb-list">${no.map((x) => html`<li>${x.ru}</li>`)}</ul>` : html`<p class="small">Пунктов «Ещё нет» нет.</p>`}
      <${SecTitle}>О чём ещё рассказать врачу<//>
      <ul class="rb-list">
        <li>что вы с ребёнком делаете вместе и что он любит делать;</li>
        <li>что в его поведении вас беспокоит;</li>
        <li>не утратил ли он навыки, которые уже были;</li>
        <li>есть ли особенности здоровья, родился ли он раньше срока.</li>
      </ul>
      <${SecTitle}>Мои вопросы<//>
      <div class="rows">${list.map((x) => html`<div class="row"><span class="row-text"><span class="row-title">${x.text}</span><span class="row-sub">${dateLong(x.at)}</span></span><button class="row-end" onClick=${() => del(x.id)}>Убрать</button></div>`)}</div>
      <${Field} label="Новый вопрос" value=${q} onInput=${setQ} placeholder="Почему всё время срыгивает?" />
      <button class="btn btn-gray" disabled=${!q.trim()} onClick=${add}>Добавить вопрос</button>
      <button class="btn btn-primary" onClick=${share}>Поделиться заметкой</button>
    </div>`;
}

// ——— Наблюдения ———
function Observations() {
  const s = useStore();
  const child = bornChild(s);
  const [text, setText] = useState('');
  if (!child) return html`<div class="screen"><${Back} title="Наблюдения" to="/rebyonok" /></div>`;
  const raw = forChild(R(s).obs, child.id);
  const list = Array.isArray(raw) ? raw : [];
  const add = () => { const id = uid(); rUpdate((r) => { r.obs = r.obs || {}; r.obs[child.id] = [{ id, text: text.trim(), at: now() }, ...(r.obs[child.id] || [])]; }); setText(''); track('развитие:наблюдение'); toast({ text: 'Записали', actions: [{ label: 'Отменить', onClick: () => rUpdate((r) => { r.obs[child.id] = r.obs[child.id].filter((x) => x.id !== id); }) }] }); };
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Наблюдения</h1>
      <p class="small">Что заметили в развитии — своими словами. Пригодится на осмотре.</p>
      <label class="field"><span class="label">Что заметили</span><textarea value=${text} placeholder="Стал дольше смотреть на погремушку" onInput=${(e) => setText(e.target.value)}></textarea></label>
      <button class="btn btn-primary" disabled=${!text.trim()} onClick=${add}>Записать</button>
      <div class="rows">${list.map((x) => html`<div class="row"><span class="row-text"><span class="row-title">${x.text}</span><span class="row-sub">${dateLong(x.at)}</span></span><button class="row-end" onClick=${() => rUpdate((r) => { r.obs[child.id] = r.obs[child.id].filter((y) => y.id !== x.id); })}>Убрать</button></div>`)}</div>
    </div>`;
}

// ——— Справочник: «Когда начинает», «Сон, экраны и движение», «Когда поговорить с врачом», «Частые вопросы» ———
function Skills() {
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Когда начинает</h1>
      <div class="rows">${SKILLS.map((x) => html`<${Row} key=${x.slug} title=${x.chip} sub=${x.short || x.v || ''} onClick=${() => { track('развитие:навык'); go('/rebyonok/razvitie/kogda/' + x.slug); }} />`)}</div>
    </div>`;
}
function Skill({ params }) {
  const x = SKILLS.find((k) => k.slug === params.slug);
  if (!x) return html`<div class="screen"><${Back} title="Когда начинает" to="/rebyonok/razvitie/kogda" /><p class="empty">Такой страницы нет.</p></div>`;
  return html`
    <div class="screen">
      <${Back} />
      <h1 class="h1">${x.h1}</h1>
      ${x.v && html`<p class="lead"><b>${x.v}</b></p>`}
      ${x.text && html`<p class="p">${x.text}</p>`}
      ${x.blocks.map((b) => html`
        ${b.title && html`<div class="h3">${b.title}</div>`}
        ${b.items.length ? html`<ul class="rb-list">${b.items.map((i) => html`<li>${i}</li>`)}</ul>` : ''}
        ${b.text.map((p) => html`<p class="p">${p}</p>`)}`)}
      ${x.faq.length ? html`<${SecTitle}>Вопросы<//>${x.faq.map((f) => html`<div class="h3">${f.q}</div><p class="p">${f.a}</p>`)}` : ''}
    </div>`;
}
const pick = (arr, m) => arr.find((r) => m >= r.from && m < r.to);
function Care() {
  const s = useStore();
  const child = bornChild(s);
  const m = child ? Math.max(0, ageMonths(child, now())) : 0;
  const rows = ['sleep', 'screens', 'move'].map((k) => pick(CARE[k] || [], m)).filter(Boolean);
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">${CARE.title}</h1>
      ${rows.map((r) => html`<p class="p">${r.t}</p>`)}
      <p class="quote">${CARE.note}</p>
    </div>`;
}
function ActEarly() {
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">${ACT_EARLY.title}</h1>
      <p class="lead">${ACT_EARLY.lead}</p>
      <ul class="rb-list">${ACT_EARLY.items.map((x) => html`<li>${x}</li>`)}</ul>
      ${ACT_EARLY.text.map((p) => html`<p class="p">${p}</p>`)}
      <button class="btn btn-gray" onClick=${() => go('/rebyonok/razvitie/zametka')}>Заметка для педиатра</button>
    </div>`;
}
function Faq() {
  const s = useStore();
  const child = bornChild(s);
  const m = child ? ageMonths(child, now()) : 0;
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Частые вопросы</h1>
      ${FAQ.filter((f) => !f.maxM || m <= f.maxM).map((f) => html`<div class="h3">${f.q}</div><p class="p">${f.a}</p>`)}
    </div>`;
}

export const razvitieRoutes = [
  { path: '/rebyonok/razvitie', view: Development, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/razvitie/orientiry/:key', view: AllMilestones, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/razvitie/zanyatiya', view: Activities, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/razvitie/zametka', view: Memo, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/razvitie/nablyudeniya', view: Observations, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/razvitie/kogda', view: Skills, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/razvitie/kogda/:slug', view: Skill, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/razvitie/son-ekrany', view: Care, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/razvitie/k-vrachu', view: ActEarly, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/razvitie/voprosy', view: Faq, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/zanyatie/:id', view: Activity, tab: '/rebyonok', strip: true },
];
