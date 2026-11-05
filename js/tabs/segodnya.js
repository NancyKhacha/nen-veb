// Вкладка «Сегодня» — Фигма «32 · V3 · Сегодня», экраны 1–17, и «36 · V3 · Первый вход», экраны 4, 6, 8.
// Что показать, решают этап, возраст (у недоношенных до двух лет — исправленный), время суток и записи.
import { html, useState, useEffect } from '../lib.js';
import { useStore, useTick, update, now, activeChild } from '../store.js';
import { DAY, startOfDay, dayKey, ageMonths, dateWithWeekday, pl, partOfDay, durShort } from '../age.js';
import { summaryLine, finishRecord, SIDE } from '../records.js';
import { Plaques, OtherSheet, finishSleep, finishFeed } from '../strip.js';
import { Header, Back, Row, SecTitle, Ill, SaveButton, Field, openSheet, toast } from '../ui.js';
import { go } from '../router.js';
import { track } from '../stats.js';
import { playNoise, usePlayer, stop as stopPlayer } from '../player.js';
import { FACTS, factsFor, factById } from '../content/facts.js';
import { activitiesFor } from '../content/activities.js';
import { articleById } from '../content/articles.js';
import { PREP } from '../content/segodnya-expecting.js';
import {
  ROUTES, seg, stageOf, splitFact, articleByUrl, shortUrl, hash, lowerFirst,
  sleepNormLine, promiseLine, firstHint, FIRST_WEEKS, everNightSleep, anyRecords, hardSleepWeek,
  factsOfDay, activityPick, activityTitle, activityText, articlePool, nenToday, newInAge,
  calendarVaccine, plannedVaccines, calendarCheckup, tasksOf, isVisit, whenLine, dayPlan, urgentItem,
  weekDays, expectingWeek, weekArticle, nextClubLive, newsItems, hasNews,
} from './segodnya/logic.js';
import {
  setSeg, markOpened, WeekStrip, Total, Note, DayCard, Feed, ThisWeek, WeatherCard,
  NewTaskSheet, TaskSheet, VaccineSheet, CheckupSheet,
} from './segodnya/parts.js';
import { refreshWeather, useOnline } from './segodnya/weather.js';

export { hasNews, NewTaskSheet };

// Подпись статьи: лид годится, только если это текст, а не подпись к фото
const leadOf = (a) => (a.lead && a.lead.length > 40 && !/^#|фото|shutterstock|скриншот|^б&р/i.test(a.lead) ? a.lead : '');

// ——— Карточки ———
function factCard(f) {
  const [title, text] = splitFact(f.text);
  const path = '/fakt/' + f.id;
  return {
    kind: 'fact', key: 'fact:' + f.id, label: 'Нет, это нормально', title, text, source: f.nen, path,
    actions: [{ label: 'Читать', onClick: () => { track('сегодня:карточка-дня:fact'); go(path); } }],
    save: { kind: 'fact', id: f.id, title, sub: 'Нет, это нормально', route: path },
    dismissKey: 'fact:' + f.id,
  };
}
function articleCard(a, label = '', text) {
  const path = ROUTES.article(a.id);
  return {
    kind: 'article', key: 'article:' + a.id, label, title: a.title, text: text ?? leadOf(a), path, onOpen: () => markOpened(a.id),
    actions: [{ label: 'Читать', onClick: () => { track('сегодня:карточка-дня:article'); markOpened(a.id); go(path); } }],
    save: { kind: 'article', id: a.id, title: a.title, sub: '', route: path },
    dismissKey: 'article:' + a.id,
  };
}
function activityCard(a) {
  const day = dayKey(now());
  return {
    kind: 'activity', key: 'activity:' + a.id, label: 'Занятие на сегодня', title: activityTitle(a), text: activityText(a),
    source: a.url, path: ROUTES.activity(a.id), done: a.doneToday,
    actions: a.doneToday
      ? [{ label: '✓ Сделали — завтра будет новое', onClick: () => go(ROUTES.activity(a.id)) }]
      : [
        { label: 'Сделали', onClick: () => { update((d) => { d.done = { ...(d.done || {}), ['activity:' + a.id]: now() }; }); track('сегодня:занятие-сделали'); toast({ text: 'Отметили — завтра здесь будет новое занятие', ms: 3000 }); } },
        { label: 'Другое занятие', onClick: () => { setSeg((g) => { g.actShift = { [day]: ((g.actShift || {})[day] || 0) + 1 }; }); track('сегодня:занятие-другое'); } },
      ],
    dismissKey: 'activity:' + a.id,
  };
}
function ageCard(n) {
  const act = n.kind === 'solids'
    ? { label: n.action, onClick: () => { track('сегодня:новое-прикорм'); openSheet(OtherSheet, {}); } }
    : n.action ? { label: n.action + ' ›', onClick: () => { track('сегодня:новое-в-возрасте'); go(n.path); } } : null;
  return { kind: 'age', key: n.key, label: n.label, title: n.title, text: n.text, path: n.path, actions: act ? [act] : [], dismissKey: n.key };
}
function urgentCard(u, ids, t) {
  const isVac = u.kind === 'vaccine';
  const past = u.time !== false && u.when <= t;
  const doneVac = () => { update((d) => { d.vaccineMarks = d.vaccineMarks || {}; for (const id of u.ids) d.vaccineMarks[id] ={ status: 'done', at: now(), when: now(), childIds: ids }; }); track('сегодня:прививка-сделали'); toast({ text: 'Отметили: прививку сделали', ms: 2500 }); };
  const doneTask = () => { update((d) => { const k = d.tasks.find((x) => x.id === u.task.id); if (k) k.done = now(); }); track('сегодня:визит-был'); toast({ text: 'Отметили', ms: 2000 }); };
  return {
    kind: 'urgent', key: u.key, ill: false,
    label: past ? 'Получилось?' : isVac ? 'Скоро · прививка' : 'Скоро · визит',
    title: u.title, text: whenLine(u.when, u.time !== false, t),
    actions: [
      { label: past ? 'Да' : 'Сделали', onClick: isVac ? doneVac : doneTask },
      { label: 'Перенести', onClick: () => (isVac ? openSheet(VaccineSheet, { group: u, childIds: ids, planned: true }) : openSheet(TaskSheet, { id: u.task.id })) },
    ],
    dismissKey: 'urgent:' + u.key + ':' + dayKey(t),
  };
}

// Одна большая карточка по порядку: срочное → (с года — занятие) → новое в возрасте → ответ на записи → факт → статья
function dayCard(s, child, ids, t) {
  const u = urgentItem(s, ids, t);
  if (u) return urgentCard(u, ids, t);
  const m = ageMonths(child, t);
  if (m >= 12) { const a = activityPick(s, child, t); if (a) return activityCard(a); }
  if (m < 12) { const n = newInAge(s, child, t)[0]; if (n) return ageCard(n); }
  if (hardSleepWeek(child, t)) { const a = articlePool(s, child, t, { topic: 'sleep' })[0]; if (a) return { ...articleCard(a, 'Про сон', 'Когда со сном непросто — материал НЭН.'), kind: 'answer' }; }
  if (m < 12) { const f = factsOfDay(s, child, t)[0]; if (f) return factCard(f); }
  const a = articlePool(s, child, t)[0];
  return a ? articleCard(a) : null;
}

// Лента «Для вас»: не больше шести, ничего не повторяет большую карточку
function feedCards(s, child, t, big, evening, limit = 6) {
  const cards = [];
  const used = new Set(big ? [big.key] : []);
  const push = (c) => { if (c && !used.has(c.key) && cards.length < limit) { used.add(c.key); cards.push(c); } };
  const art = (a, label = '', kind = 'article') => a && ({ key: 'article:' + a.id, kind, label, title: a.title, path: ROUTES.article(a.id), onOpen: () => markOpened(a.id) });
  const m = ageMonths(child, t);
  if (hardSleepWeek(child, t)) push(art(articlePool(s, child, t, { topic: 'sleep' })[0], 'Про сон', 'answer'));
  for (const n of newInAge(s, child, t)) {
    const sheet = n.kind === 'solids' || n.kind === 'potty';
    push({ key: n.key, kind: 'age', label: n.kind === 'cdc' ? 'На этой неделе' : n.label, title: n.short, path: n.path || null, onOpen: sheet ? () => openSheet(OtherSheet, {}) : null });
  }
  const facts = factsOfDay(s, child, t);
  const f = facts.find((x) => !used.has('fact:' + x.id));
  if (f) push({ key: 'fact:' + f.id, kind: 'fact', label: 'Нет, это нормально', title: splitFact(f.text)[0], source: f.nen, path: '/fakt/' + f.id });
  const pool = articlePool(s, child, t).filter((a) => !used.has('article:' + a.id));
  push(art(pool[0]));
  const self = articlePool(s, child, t, { self: true }).filter((a) => !used.has('article:' + a.id))[0];
  push(art(self, 'Для себя', 'self'));
  if (!evening) push({ key: 'evening', kind: 'evening', label: 'Вечером', title: m < 24 ? 'Колыбельная на ночь — из «Сказок»' : 'Сказка на ночь — из «Сказок»', path: ROUTES.tales });
  if (s.demo && s.demo.club) { const live = nextClubLive(t); push({ key: 'club', kind: 'club', label: 'Эфир Клуба', title: `${dateWithWeekday(live)}, 19:00`, path: ROUTES.club }); }
  if (s.demo && s.demo.course) push({ key: 'course', kind: 'course', label: 'Курс', title: 'Урок этой недели уже открыт', path: ROUTES.course });
  push(art(pool[1]));
  if (m >= 12) push({ key: 'idea', kind: 'idea', label: 'Идея на сегодня', title: 'Что приготовить — рецепт «Семейной кухни»', path: ROUTES.idea });
  if (limit > 6) { for (const a of pool.slice(2)) push(art(a)); for (const x of facts.slice(1)) push({ key: 'fact:' + x.id, kind: 'fact', label: 'Нет, это нормально', title: splitFact(x.text)[0], source: x.nen, path: '/fakt/' + x.id }); }
  return cards;
}

// «На этой неделе»: прививки и осмотры по календарю, записанные визиты, свои дела, план дня
function thisWeek(s, child, ids, t, urgentKey) {
  const sod = startOfDay(t);
  const items = [];
  const kids = ids.map((id) => s.children.find((c) => c.id === id)).filter(Boolean);
  const both = kids.length > 1 ? (kids.every((c) => c.sex === 'girl') ? ' — обеим' : ' — обоим') : '';
  if (child && !child.expecting) {
    const cv = calendarVaccine(s, child, t);
    if (cv) items.push({ key: cv.key, at: cv.due, title: cv.title + both, sub: cv.sub, onClick: () => { track('сегодня:прививка'); openSheet(VaccineSheet, { group: cv, childIds: ids }); } });
    const ck = calendarCheckup(s, child, t);
    if (ck) items.push({ key: ck.key, at: ck.due, title: ck.title + both, sub: ck.sub, onClick: () => { track('сегодня:осмотр'); openSheet(CheckupSheet, { item: ck, childId: child.id }); } });
    for (const v of plannedVaccines(s, ids)) {
      if (v.when < sod || v.when >= sod + 7 * DAY || v.key === urgentKey) continue;
      items.push({ key: v.key, at: v.when, title: v.title + both, sub: `${whenLine(v.when, true, t)} · записались${v.when - DAY > t ? ' · напомним накануне' : ''}`, onClick: () => openSheet(VaccineSheet, { group: v, childIds: ids, planned: true }) });
    }
  }
  for (const x of tasksOf(s, ids)) {
    if (x.done || x.skipped || x.when < sod || x.when >= sod + 7 * DAY || 'task:' + x.id === urgentKey) continue;
    const past = x.time && x.when <= t;
    const tail = past ? ' · Получилось?' : isVisit(x) && x.when - DAY > t ? ' · напомним накануне' : '';
    items.push({ key: 'task:' + x.id, at: x.when, title: x.title, sub: whenLine(x.when, x.time, t) + tail, onClick: () => { track('сегодня:дело'); openSheet(TaskSheet, { id: x.id }); } });
  }
  if (child && !child.expecting) for (const p of dayPlan(s, child, t)) items.push({ key: p.key, at: p.when, title: p.title, sub: `${whenLine(p.when, true, t)} · из плана дня`, onClick: () => { track('сегодня:план-дня'); go(ROUTES.day(t)); } });
  return items.sort((a, b) => a.at - b.at);
}

// ——— Вечером: карточка на ночь ———
function EveningCard({ child }) {
  const s = useStore();
  const p = usePlayer();
  const m = ageMonths(child, now());
  const small = m < 24;
  const tale = s.saved.find((x) => x.kind === 'tale');
  const noiseOn = p && /white|pink/.test(p.id || '');
  const range = m < 36 ? 'по возрасту' : m < 60 ? 'для 3–5 лет' : 'для 5–7 лет';
  return html`
    <div class="card sg-day">
      <button class="sg-day-main" onClick=${() => { track('сегодня:на-ночь'); go(ROUTES.tales); }}>
        <${Ill} keep seed=${small ? 'колыбельная' : 'сказка'} />
        <div class="tiny">${small ? 'Вечером · перед сном' : 'Вечером · сказка на ночь'}</div>
        <div class="h2">${small ? 'Колыбельная на ночь' : 'Сказка на ночь'}</div>
        <p class="p sg-text">${small ? 'Или шум — одним касанием.' : `Из вашего избранного — или новая ${range}.`}</p>
      </button>
      <div class="actions sg-actions">
        <button onClick=${() => { track('сегодня:на-ночь-слушать'); go(!small && tale ? tale.route : ROUTES.tales); }}>▶ Слушать</button>
        ${small
          ? html`<button onClick=${() => { track('сегодня:на-ночь-шум'); noiseOn ? stopPlayer() : playNoise('white'); }}>${noiseOn ? 'Выключить шум' : 'Шум'}</button>`
          : html`<button onClick=${() => { track('сегодня:на-ночь-другая'); go(ROUTES.tales); }}>Другая сказка</button>`}
      </div>
    </div>`;
}

// Близнецам — «Оба» в переключателе: одно касание — запись каждому
function TwinSwitch({ child, twin, both }) {
  const s = useStore();
  const pair = s.children.filter((c) => c.id === child.id || c.id === twin.id);
  const all = pair.every((c) => c.sex === 'girl') ? 'Обе' : 'Оба';
  const pick = (id) => { track('сегодня:близнецы'); update((d) => { d.activeChildId = id; d.bothTwins = false; }); };
  return html`
    <div class="pills sg-twins">
      ${pair.map((c) => html`<button class=${'pill' + (!both && c.id === child.id ? ' on' : '')} onClick=${() => pick(c.id)}>${c.name}</button>`)}
      <button class=${'pill' + (both ? ' on' : '')} onClick=${() => { track('сегодня:близнецы-оба'); update((d) => { d.bothTwins = true; }); }}>${all}</button>
    </div>`;
}

// У близнецов в режиме «Оба» — короткие плашки: у каждого своя «Закончить» (экран 12)
function TwinPlaques() {
  const s = useStore();
  useTick(15000);
  const t = now();
  const list = s.records.filter((r) => r.end == null && (r.type === 'sleep' || r.type === 'feed' || r.type === 'walk'));
  if (!list.length) return null;
  return html`<div class="sg-mini-plaques">${list.map((r) => {
    const c = s.children.find((x) => x.id === r.childId);
    const name = c ? c.name : '';
    const what = r.type === 'sleep' ? 'спит' : r.type === 'feed' ? `ест · ${SIDE[r.data.side] || 'бутылочка'}` : 'гуляет';
    const fin = () => (r.type === 'sleep' ? finishSleep(r.id) : r.type === 'feed' ? finishFeed(r.id) : finishRecord(r.id));
    return html`
      <div class="plaque sg-mini" key=${r.id}>
        <span class="plaque-title">${name} ${what} · ${durShort(t - r.start)}</span>
        <button class="btn btn-primary btn-small" onClick=${fin}>Закончить</button>
      </div>`;
  })}</div>`;
}

// ——— Экраны «Сегодня» по этапам ———
function DayScreen({ s, child, t }) {
  const part = partOfDay(t);
  const twin = child.twinOf ? s.children.find((c) => c.id === child.twinOf && !c.expecting) : null;
  const both = !!(twin && s.bothTwins);
  const ids = both ? [child.id, twin.id] : [child.id];
  const kids = both ? s.children.filter((c) => ids.includes(c.id)) : [child];
  const sod = startOfDay(t);

  // Ночью — только идущая запись, кнопки и итог ночи
  if (part === 'night') {
    const from = (new Date(t).getHours() >= 22 ? sod : sod - DAY) + 21 * 3600e3;
    const lines = kids.map((c) => summaryLine(c.id, c, from, t, both ? `${c.name} за ночь` : 'За ночь')).filter(Boolean);
    return html`
      ${twin && html`<${TwinSwitch} child=${child} twin=${twin} both=${both} />`}
      ${both ? html`<${TwinPlaques} />` : html`<${Plaques} />`}
      ${lines.length ? html`<${Total} lines=${lines} t=${t} />` : html`<p class="small sg-night">Ночью здесь только запись и итог ночи. Остальное — утром.</p>`}`;
  }

  const evening = part === 'evening';
  const lines = kids.map((c) => summaryLine(c.id, c, sod, t, both ? c.name : 'Сегодня')).filter(Boolean);
  const notes = [];
  if (!lines.length && !kids.some((c) => anyRecords(c.id, s)) && ageMonths(child, t) < 36) notes.push({ hint: true, text: firstHint(child, t) });
  if (!both && anyRecords(child.id, s) && !everNightSleep(child.id, s)) { const p = promiseLine(child, t); if (p) notes.push({ text: p }); }
  if (stageOf(child, t) === 'newborn') notes.push({ text: FIRST_WEEKS });
  const norm = !both ? sleepNormLine(child, t) : null;
  if (norm) notes.push({ text: norm, onClick: () => { track('сегодня:ориентир'); go(ROUTES.sleepWeek); } });
  const summary = html`
    ${lines.length ? html`<${Total} lines=${lines} t=${t} />` : ''}
    ${notes.map((n) => n.hint ? html`<p class="lead sg-hint">${n.text}</p>` : html`<${Note} onClick=${n.onClick}>${n.text}<//>`)}`;

  const urgent = evening ? null : urgentItem(s, ids, t);
  const big = evening ? null : dayCard(s, child, ids, t);
  const feed = feedCards(s, child, t, big, evening);
  const week = thisWeek(s, child, ids, t, urgent ? urgent.key : null);

  return html`
    ${twin && html`<${TwinSwitch} child=${child} twin=${twin} both=${both} />`}
    <${WeekStrip} days=${weekDays(s, ids, t)} />
    ${both ? html`<${TwinPlaques} />` : html`<${Plaques} />`}
    ${evening ? html`<${EveningCard} child=${child} />` : summary}
    ${!evening && html`<${DayCard} card=${big} />`}
    <${Feed} cards=${feed} />
    ${evening && summary}
    <${ThisWeek} items=${week} onAdd=${() => { track('сегодня:добавить-дело'); openSheet(NewTaskSheet, { childId: child.id }); }} />
    <${WeatherCard} child=${child} />`;
}

// Экран 8 страницы 32 — черновик до брифа «Беременность и ребёнок»
function ExpectingScreen({ s, child, t }) {
  const w = expectingWeek(child, t);
  const a = weekArticle(s, child, t);
  const prep = seg(s).prep || {};
  const done = PREP.items.filter((x) => prep[x.id]).length;
  const next = PREP.items.find((x) => !prep[x.id]);
  const names = seg(s).names || [];
  const week = thisWeek(s, child, [child.id], t, null);
  return html`
    <div class="small sg-date">${dateWithWeekday(t)}</div>
    <div class="card sg-day">
      <button class="sg-day-main" onClick=${() => { if (!a) return; track('сегодня:ваша-неделя'); markOpened(a.id); go(ROUTES.article(a.id)); }}>
        <${Ill} id=${a && a.id} />
        <div class="tiny">Ваша неделя</div>
        <div class="h2">${w}-я неделя</div>
        ${a && html`<p class="p sg-text">Материал недели от редакции НЭН: «${a.title}»</p>`}
      </button>
      ${a && html`<div class="actions sg-actions">
        <button onClick=${() => { track('сегодня:ваша-неделя'); markOpened(a.id); go(ROUTES.article(a.id)); }}>Читать</button>
        <${SaveButton} item=${{ kind: 'article', id: a.id, title: a.title, sub: '', route: ROUTES.article(a.id) }} />
      </div>`}
    </div>
    <div class="rows">
      <${Row} title="Подготовка к роддому" sub=${next ? `Готово ${done} из ${PREP.items.length} · дальше: ${lowerFirst(next.title)}` : 'Всё готово — можно перепроверить'} onClick=${() => { track('сегодня:подготовка'); go('/segodnya/podgotovka'); }} />
      <${Row} title="Имена" sub=${names.length ? `В вашем списке ${pl(names.length, 'имя', 'имени', 'имён')}` : 'Список имён, которые нравятся'} onClick=${() => { track('сегодня:имена'); go('/segodnya/imena'); }} />
    </div>
    <${ThisWeek} items=${week} onAdd=${() => { track('сегодня:добавить-дело'); openSheet(NewTaskSheet, { childId: child.id }); }} />
    <${WeatherCard} wear=${false} />`;
}

// Страница 36, экран 8: «Сегодня» без ребёнка — для «Планируем» и «Заполню позже»
function NoChildScreen({ s, t }) {
  const arts = nenToday(s, t, 3);
  const top = arts[0];
  const open = (a) => () => { track('сегодня:сегодня-в-нэн'); markOpened(a.id); go(ROUTES.article(a.id)); };
  const lastNote = (s.notes || [])[0];
  return html`
    <div class="small sg-date">${dateWithWeekday(t)}</div>
    ${top && html`
      <div class="card sg-day">
        <button class="sg-day-main" onClick=${open(top)}>
          <${Ill} id=${top.id} />
          <div class="tiny">Сегодня в НЭН</div>
          <div class="h2">${top.title}</div>
          ${leadOf(top) && html`<p class="p sg-text">${leadOf(top)}</p>`}
        </button>
        <div class="actions sg-actions">
          <button onClick=${open(top)}>Читать</button>
          <${SaveButton} item=${{ kind: 'article', id: top.id, title: top.title, sub: '', route: ROUTES.article(top.id) }} />
        </div>
      </div>`}
    ${arts.length > 1 && html`
      <${SecTitle}>Сегодня в НЭН<//>
      <div class="rows">${arts.slice(1).map((a) => html`<${Row} title=${a.title} onClick=${open(a)} />`)}</div>`}
    <${SecTitle}>Для себя<//>
    <div class="rows">
      <${Row} title="Мои заметки" sub=${lastNote ? `Последняя — ${dateWithWeekday(lastNote.at).toLowerCase()} · ＋ Заметка` : '＋ Заметка — мысли и вопросы своими словами'} onClick=${() => { track('сегодня:заметки'); go(ROUTES.notes); }} />
      <${Row} title="Минутка для себя" sub="Практики редакции на 3–12 минут" onClick=${() => { track('сегодня:минутка'); go(ROUTES.self); }} />
      ${s.stage === 'born'
        ? html`<${Row} title="Добавить ребёнка" sub="Имя и дата рождения — появятся записи, прививки и ориентиры" onClick=${() => { track('сегодня:добавить-ребёнка'); go('/profil/rebyonok/novyy'); }} />`
        : html`<${Row} title="Ждёте малыша?" sub="Добавьте дату родов — появится срок" onClick=${() => { track('сегодня:ждёте-малыша'); go('/start/zhdyom'); }} />`}
    </div>
    <${WeatherCard} wear=${false} />`;
}

function Home() {
  const s = useStore();
  useTick(30000);
  useOnline();
  useEffect(() => { refreshWeather(); }, [s.settings.city]);
  const t = now();
  const child = activeChild(s);
  const stage = stageOf(child, t);
  let body;
  if (stage === 'none') body = html`<${NoChildScreen} s=${s} t=${t} />`;
  else if (stage === 'expecting') body = html`<${ExpectingScreen} s=${s} child=${child} t=${t} />`;
  else body = html`<${DayScreen} s=${s} child=${child} t=${t} />`;
  return html`<div class="screen sg"><${Header} newsDot=${hasNews(s, t)} />${body}</div>`;
}

// ——— Факт «Нет, это нормально» ———
function FactScreen({ params }) {
  const s = useStore();
  const f = factById(params.id);
  if (!f) return html`
    <div class="screen"><${Back} />
      <p class="empty">Этого факта уже нет в приложении.</p>
      <button class="btn btn-primary" onClick=${() => go('/segodnya', { replace: true })}>На «Сегодня»</button>
    </div>`;
  const [title, text] = splitFact(f.text);
  const art = articleByUrl(f.nen);
  const child = activeChild(s);
  const m = child && !child.expecting ? Math.max(1, ageMonths(child, now())) : f.fromM;
  const others = factsFor(m).filter((x) => x.id !== f.id);
  const start = others.length ? hash('o' + f.id + dayKey(now())) % others.length : 0;
  const more = others.slice(start).concat(others.slice(0, start)).slice(0, 3);
  return html`
    <div class="screen sg">
      <${Back} />
      <${Ill} big from=${f.nen} />
      <div class="tiny">Нет, это нормально</div>
      <h1 class=${'h1 sg-fact-title' + (title.length > 80 ? ' sg-long' : '')}>${title}</h1>
      ${text && html`<p class="lead">${text}</p>`}
      <div class="actions"><${SaveButton} item=${{ kind: 'fact', id: f.id, title, sub: 'Нет, это нормально', route: '/fakt/' + f.id }} /></div>
      ${art ? html`
        <${SecTitle}>Подробнее в НЭН<//>
        <div class="rows"><${Row} title=${art.title} onClick=${() => { track('факт:статья'); markOpened(art.id); go(ROUTES.article(art.id)); }} /></div>`
        : f.nen ? html`
        <${SecTitle}>Подробнее в НЭН<//>
        <div class="rows"><a class="row" href=${f.nen} target="_blank" rel="noopener" onClick=${() => track('факт:статья-на-сайте')}>
          <span class="row-text"><span class="row-title">Об этом на сайте НЭН</span><span class="row-sub">${shortUrl(f.nen)}${navigator.onLine === false ? ' · нужна сеть' : ''}</span></span><span class="chev">›</span></a></div>` : ''}
      ${more.length > 0 && html`
        <${SecTitle}>Ещё «Нет, это нормально»<//>
        <div class="rows">${more.map((x) => html`<${Row} title=${splitFact(x.text)[0]} onClick=${() => { track('факт:ещё'); go('/fakt/' + x.id, { replace: true }); }} />`)}</div>`}
      <p class="small">Завтра на «Сегодня» — новый факт.</p>
    </div>`;
}

// ——— Колокольчик «Что нового» (экран 9) ———
function News() {
  const s = useStore();
  const t = now();
  const items = newsItems(s, t);
  const [fresh] = useState(() => { const seen = new Set((s.seen && s.seen.news) || []); return new Set(items.filter((i) => !seen.has(i.key)).map((i) => i.key)); });
  useEffect(() => {
    update((d) => { d.seen = d.seen || {}; d.seen.news = [...new Set([...(d.seen.news || []), ...items.map((i) => i.key)])].slice(-400); });
  }, []);
  const group = (g) => items.filter((i) => i.group === g);
  const List = ({ list }) => html`<div class="rows">${list.map((i) => html`
    <${Row} key=${i.key} title=${i.title} sub=${i.sub} left=${fresh.has(i.key) ? html`<span class="sg-new-dot" aria-label="новое"></span>` : html`<span class="sg-new-dot off"></span>`}
      onClick=${() => { track('колокольчик:строка'); go(i.path); }} />`)}</div>`;
  return html`
    <div class="screen sg">
      <${Back} title="Что нового" />
      ${!items.length && html`<p class="lead">Пока ничего нового. Завтра здесь будет новый факт и материалы по возрасту.</p>`}
      ${group('today').length > 0 && html`<${SecTitle}>Сегодня<//><${List} list=${group('today')} />`}
      ${group('week').length > 0 && html`<${SecTitle}>На этой неделе<//><${List} list=${group('week')} />`}
    </div>`;
}

// ——— «Для вас» целиком ———
function AllForYou() {
  const s = useStore();
  const t = now();
  const child = activeChild(s);
  if (!child || child.expecting) {
    const list = nenToday(s, t, 8);
    return html`<div class="screen sg"><${Back} title="Для вас" />
      <div class="rows">${list.map((a) => html`<${Row} title=${a.title} onClick=${() => { markOpened(a.id); go(ROUTES.article(a.id)); }} />`)}</div></div>`;
  }
  const evening = partOfDay(t) === 'evening';
  const cards = feedCards(s, child, t, null, evening, 20);
  return html`
    <div class="screen sg">
      <${Back} title="Для вас" />
      <p class="small">Подобрано по возрасту и темам, которые вы отметили. Прочитанное уходит, на его место встаёт следующее.</p>
      <div class="rows">${cards.map((c) => html`<${Row} key=${c.key} title=${c.title} sub=${c.label} onClick=${() => { track('сегодня:для-вас:' + c.kind); if (c.onOpen) c.onOpen(); if (c.path) go(c.path); }} />`)}</div>
    </div>`;
}

// ——— Ждём малыша: подготовка и имена ———
function Prep() {
  const s = useStore();
  const prep = seg(s).prep || {};
  const toggle = (id) => { setSeg((g) => { g.prep = { ...(g.prep || {}) }; if (g.prep[id]) delete g.prep[id]; else g.prep[id] = now(); }); track('ждём:подготовка-пункт'); };
  const done = PREP.items.filter((x) => prep[x.id]).length;
  return html`
    <div class="screen sg">
      <${Back} title=${PREP.title} />
      <p class="lead">${PREP.note}</p>
      <div class="small">Готово ${done} из ${PREP.items.length}</div>
      <div class="rows">
        ${PREP.items.map((x) => html`
          <button class="row" onClick=${() => toggle(x.id)}>
            <span class=${'sg-check' + (prep[x.id] ? ' on' : '')}>${prep[x.id] ? '✓' : ''}</span>
            <span class="row-text"><span class="row-title">${x.title}</span></span>
          </button>`)}
      </div>
      <a class="row" href=${PREP.source.url} target="_blank" rel="noopener">
        <span class="row-text"><span class="row-title">${PREP.source.title}</span><span class="row-sub">По материалу НЭН · n-e-n.ru</span></span><span class="chev">›</span>
      </a>
    </div>`;
}

function Names() {
  const s = useStore();
  const names = seg(s).names || [];
  const [v, setV] = useState('');
  const add = () => {
    const n = v.trim();
    if (!n) return;
    if (names.some((x) => x.toLowerCase() === n.toLowerCase())) { toast({ text: 'Это имя уже в списке', ms: 2000 }); return; }
    setSeg((g) => { g.names = [...(g.names || []), n]; });
    track('ждём:имя-добавить');
    setV('');
  };
  return html`
    <div class="screen sg">
      <${Back} title="Имена" />
      <p class="lead">Имена, которые нравятся. Список хранится на этом телефоне.</p>
      <${Field} label="Имя" value=${v} onInput=${setV} placeholder="Например, Варвара" />
      <button class="btn btn-primary" disabled=${!v.trim()} onClick=${add}>Добавить в список</button>
      ${names.length > 0 && html`
        <${SecTitle}>В вашем списке<//>
        <div class="rows">${names.map((n) => html`
          <div class="row"><span class="row-text"><span class="row-title">${n}</span></span>
            <button class="row-end" onClick=${() => { setSeg((g) => { g.names = (g.names || []).filter((x) => x !== n); }); toast({ text: 'Убрали из списка', ms: 2000, actions: [{ label: 'Вернуть', onClick: () => setSeg((g) => { g.names = [...(g.names || []), n]; }) }] }); }}>Убрать</button></div>`)}</div>`}
    </div>`;
}

export const routes = [
  { path: '/segodnya', view: Home, tab: '/segodnya', strip: true, night: true },
  { path: '/novoe', view: News, tab: '/segodnya', strip: true },
  { path: '/fakt/:id', view: FactScreen, tab: '/segodnya', strip: true },
  { path: '/segodnya/dlya-vas', view: AllForYou, tab: '/segodnya', strip: true },
  { path: '/segodnya/podgotovka', view: Prep, tab: '/segodnya' },
  { path: '/segodnya/imena', view: Names, tab: '/segodnya' },
];

// Поиск: факты «Нет, это нормально» и занятия по возрасту ребёнка
export function searchItems(s) {
  const child = activeChild(s);
  const t = now();
  const born = child && !child.expecting;
  const m = born ? ageMonths(child, t) : null;
  const facts = born ? factsFor(Math.max(1, m)) : FACTS.filter((f) => f.fromM <= 1);
  const acts = born ? activitiesFor(m) : [];
  return [
    ...facts.map((f) => ({ title: splitFact(f.text)[0], sub: 'Нет, это нормально', path: '/fakt/' + f.id, text: f.text })),
    ...acts.map((a) => ({ title: activityTitle(a), sub: 'Занятие на сегодня', path: ROUTES.activity(a.id), text: a.text })),
  ];
}
