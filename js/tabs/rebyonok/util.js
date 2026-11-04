// «Ребёнок»: общие детали раздела — своё хранилище, неделя, строки с точкой и кружком,
// переключатель, «График», прививки, болезнь, воспоминания.
import { html, useState } from '../../lib.js';
import { getState, update, activeChild, now, uid } from '../../store.js';
import { DAY, startOfDay, dayKey, weekdayShort, weekdayLong, dateLong, hhmm, ageMonths, isPreterm, diffYMD, pl } from '../../age.js';
import { recordsOf, hasRecords, daySummary, describe, SIDE, DIAPER, POTTY } from '../../records.js';
import { VACCINES, vaccineDate } from '../../content/reference.js';
import { go } from '../../router.js';
import { track } from '../../stats.js';
import { openSheet, closeSheet, toast, Pill, Header } from '../../ui.js';

// ——— Своё пространство в хранилище: s.rebyonok ———
// ms: { childId: { cdcId: { st: 'no', at } } } — «Ещё нет» (а «Видели» — в s.done['cdc:<child>:<id>'])
// docs: { childId: { docId: at } }, checkups: { childId: { age: at } }, ill: { childId: [{ id, from, to }] }
// questions, obs, med: { childId: {...} }, contacts: { childId: {...} }, voice: [{ id, title, at }]
export const R = (s = getState()) => s.rebyonok || {};
export function rUpdate(fn) { update((d) => { d.rebyonok = d.rebyonok || {}; fn(d.rebyonok, d); }); }
export const forChild = (obj, id) => (obj && obj[id]) || {};

export const isOffline = (s = getState()) => !!(s.demo && s.demo.offline) || (typeof navigator !== 'undefined' && navigator.onLine === false);
export const bornChild = (s = getState()) => { const c = activeChild(s); return c && !c.expecting ? c : null; };
export const nameOf = (c) => (c && c.name) || 'Ребёнок';
export const cap = (x) => (x ? x[0].toUpperCase() + x.slice(1) : x);
export const inFirstYear = (c, t = now()) => c && diffYMD(c.dob, t).months < 12;
// Возраст «в 2 месяца» — для ориентира сна и подписей
export function monthsWord(m) {
  if (m < 12) return pl(m, 'месяц', 'месяца', 'месяцев');
  const y = Math.floor(m / 12), r = m % 12;
  if (y < 3 && r) return `${pl(y, 'год', 'года', 'лет')} ${pl(r, 'месяц', 'месяца', 'месяцев')}`;
  return pl(y, 'год', 'года', 'лет');
}
export const dayTitle = (t, today = now()) => {
  const d = Math.round((startOfDay(t) - startOfDay(today)) / DAY);
  const tail = d === 0 ? ' · сегодня' : d === -1 ? ' · вчера' : d === 1 ? ' · завтра' : '';
  return `${weekdayLong(t)}, ${dateLong(t)}${tail}`;
};
export const fmtNum = (v, digits = 1) => (v == null || v === '' || isNaN(+v) ? '' : String(parseFloat((+v).toFixed(digits))).replace('.', ','));

// ——— Переключатель «День · Неделя · Месяц» ———
export function Seg({ items, value, onChange }) {
  return html`
    <div class="rb-seg" role="tablist">
      ${items.map(([k, label]) => html`<button role="tab" class=${value === k ? 'on' : ''} onClick=${() => onChange(k)}>${label}</button>`)}
    </div>`;
}

// ——— Неделя: вчера, сегодня и пять дней вперёд (или вокруг выбранного дня) ———
export function weekDays(selected, t = now()) {
  const today = startOfDay(t);
  let from = today - DAY;
  if (selected != null && (selected < from || selected > from + 6 * DAY)) from = startOfDay(selected) - 3 * DAY;
  return Array.from({ length: 7 }, (_, i) => startOfDay(from + i * DAY + 3 * 3600e3));
}
export function WeekStrip({ child, selected, onPick }) {
  const t = now();
  const today = startOfDay(t);
  const days = weekDays(selected, t);
  return html`
    <div class="days">
      ${days.map((d) => {
        const had = child && (hasRecords(child.id, d) || doneTasksOn(child, d).length);
        const plan = child && plansOn(child, d).length;
        const on = selected != null ? d === startOfDay(selected) : d === today;
        return html`
          <button class=${'day' + (on ? ' today' : '')} aria-label=${dateLong(d)} onClick=${() => onPick(d)}>
            <span class="dn">${weekdayShort(d)}</span><span class="dd">${new Date(d).getDate()}</span>
            <span class="marks">${had ? html`<i class="mark"></i>` : ''}${plan ? html`<i class="mark plan"></i>` : ''}</span>
          </button>`;
      })}
    </div>`;
}

// Строка с точкой (было) или кружком (в планах)
export function DotRow({ plan, title, sub, onClick, end }) {
  return html`
    <button class="row rb-dotrow" onClick=${onClick}>
      <i class=${'rb-dot' + (plan ? ' plan' : '')}></i>
      <span class="row-text"><span class="row-title">${title}</span>${sub && html`<span class="row-sub">${sub}</span>`}</span>
      ${end ? html`<span class="row-end">${end}</span>` : ''}
    </button>`;
}

// Карточка ленты, как «Для вас»
export function FeedCard({ ill = '', label, title, onClick, dim, photo }) {
  return html`
    <button class=${'feed-card rb-card' + (dim ? ' dim' : '')} onClick=${onClick}>
      ${photo ? html`<span class="rb-photo"><img src=${photo} alt="" /></span>` : html`<span class="ill">${ill}</span>`}
      ${label && html`<span class="tiny">${label}</span>`}
      <span class="t">${title}</span>
    </button>`;
}

// Заголовок блока капсом с входом справа
export function BlockTitle({ children, more, to, ev }) {
  return html`
    <div class="sec-title rb-btitle">
      <button class="rb-btn-title" onClick=${() => { track('ребёнок:блок:' + ev); go(to); }}>${children}</button>
      ${more && html`<button onClick=${() => { track('ребёнок:блок-вход:' + ev); go(to); }}>${more} ›</button>`}
    </div>`;
}

// Текст из справочника: абзацы через пустую строку, строки «• …» — списком
export function Prose({ text }) {
  const paras = String(text || '').split(/\n\s*\n/);
  return html`<div class="rb-prose">${paras.map((p) => {
    const lines = p.split('\n').map((x) => x.trim()).filter(Boolean);
    if (lines.length && lines.every((l) => l.startsWith('•'))) return html`<ul>${lines.map((l) => html`<li>${l.replace(/^•\s*/, '')}</li>`)}</ul>`;
    return lines.map((l) => (l.startsWith('•') ? html`<ul><li>${l.replace(/^•\s*/, '')}</li></ul>` : html`<p>${l}</p>`));
  })}</div>`;
}
// Блоки аптечки и зубов: { h }, { h3 }, { p }, { ul }, { q }
export function Blocks({ list }) {
  return html`<div class="rb-prose">${list.map((b) => (b.h ? html`<h3>${b.h}</h3>` : b.h3 ? html`<h4>${b.h3}</h4>` : b.ul ? html`<ul>${b.ul.map((x) => html`<li>${x}</li>`)}</ul>` : b.q ? html`<p class="quote">${b.q}</p>` : html`<p>${b.p}</p>`))}</div>`;
}

// ——— Дела и планы (s.tasks: { id, childId, title, when, kind, done }) ———
export const tasksOf = (child, s = getState()) => (s.tasks || []).filter((x) => x.childId === child.id);
export const doneTasksOn = (child, d, s = getState()) => tasksOf(child, s).filter((x) => x.done && startOfDay(x.when) === startOfDay(d));
// Что в планах в этот день: свои дела и визиты, прививки по календарю
export function plansOn(child, d, s = getState()) {
  const day = startOfDay(d), today = startOfDay(now());
  const list = tasksOf(child, s).filter((x) => !x.done && startOfDay(x.when) === day).map((x) => ({ kind: 'task', task: x, when: x.when }));
  for (const g of vaccineGroups(child, s)) {
    if (g.planned && startOfDay(g.planned.when) === day) list.push({ kind: 'vaccine', group: g, when: g.planned.when });
  }
  if (day >= today) {
    for (const g of dueVaccineGroups(child, s)) {
      const due = Math.max(startOfDay(g.due), today);
      if (due === day && !g.planned) list.push({ kind: 'vaccine', group: g, when: due });
    }
  }
  return list.sort((a, b) => a.when - b.when);
}
export function addTask(child, title, when, kind = 'own', extra = {}) {
  const id = uid();
  const time = !!(new Date(when).getHours() || new Date(when).getMinutes());
  update((s) => { s.tasks = s.tasks || []; s.tasks.push({ id, childId: child.id, title, when, kind, time, done: null, ...extra }); });
  return id;
}
export function setTask(id, fn) { update((s) => { const x = (s.tasks || []).find((t) => t.id === id); if (x) fn(x); }); }
export function removeTask(id) { update((s) => { s.tasks = (s.tasks || []).filter((t) => t.id !== id); }); }
// Время дела — если его указали (x.time, как на «Сегодня»), иначе по часам
export const timeOf = (t, task) => { if (task && task.time === false) return ''; const d = new Date(t); return d.getHours() || d.getMinutes() ? hhmm(t) : ''; };

// ——— Прививки ———
const NAMES = {
  'hepb-1': 'Гепатит B, первая прививка', bcg: 'БЦЖ — прививка от туберкулёза', 'hepb-2': 'Гепатит B, вторая прививка',
  'hepb-3-risk': 'Гепатит B, третья прививка для групп риска', 'pcv-1': 'Прививка от пневмококка', 'dtp-1': 'АКДС, первая прививка',
  'polio-1': 'Полиомиелит, первая прививка', 'hib-1': 'Гемофильная инфекция, первая прививка', 'dtp-2': 'АКДС, вторая прививка',
  'hib-2': 'Гемофильная инфекция, вторая прививка', 'polio-2': 'Полиомиелит, вторая прививка', 'pcv-2': 'Пневмококк, вторая прививка',
  'dtp-3': 'АКДС, третья прививка', 'hepb-3': 'Гепатит B, третья прививка', 'polio-3': 'Полиомиелит, третья прививка',
  'hib-3': 'Гемофильная инфекция, третья прививка', flu: 'Прививка от гриппа — каждый сезон', 'mmr-1': 'Корь, краснуха, паротит',
  'hepb-4-risk': 'Гепатит B, четвёртая прививка для групп риска', 'pcv-r': 'Ревакцинация от пневмококка', 'dtp-r1': 'Ревакцинация АКДС',
  'polio-r1': 'Полиомиелит, первая ревакцинация', 'hib-r': 'Гемофильная инфекция, ревакцинация', 'polio-r2': 'Полиомиелит, вторая ревакцинация',
  'mmr-r': 'Корь, краснуха, паротит — ревакцинация', 'polio-r3': 'Полиомиелит, третья ревакцинация', 'dt-r2': 'АДС, вторая ревакцинация', 'bcg-r': 'БЦЖ, ревакцинация',
};
const SHORT = { hepb: 'гепатит B', tb: 'БЦЖ', pcv: 'пневмококк', dtp: 'АКДС', polio: 'полиомиелит', hib: 'гемофильная инфекция', mmr: 'корь, краснуха, паротит', dt: 'АДС', flu: 'грипп' };
const ORD = { 'первая': 'первые', 'вторая': 'вторые', 'третья': 'третьи' };
export const vaccineName = (it) => NAMES[it.id] || cap(SHORT[it.disease] || it.disease);
const join = (xs) => (xs.length < 2 ? xs[0] : xs.slice(0, -1).join(', ') + ' и ' + xs[xs.length - 1]);

// Отметка прививки — как читает «Сегодня»: vaccineMarks[id] = { status, at, when, childIds }
export function markOf(child, id, s = getState()) {
  const m = (s.vaccineMarks || {})[id];
  if (!m) return null;
  if (m.childIds && !m.childIds.includes(child.id)) return null;
  return m;
}
export function setMarks(child, ids, mark) {
  update((s) => {
    s.vaccineMarks = s.vaccineMarks || {};
    ids.forEach((id) => {
      const old = s.vaccineMarks[id];
      const others = old && old.childIds ? old.childIds.filter((c) => c !== child.id) : [];
      if (mark) s.vaccineMarks[id] = { ...mark, childIds: old && old.status === mark.status && old.when === mark.when ? [...others, child.id] : [child.id] };
      else if (others.length) s.vaccineMarks[id] = { ...old, childIds: others };
      else delete s.vaccineMarks[id];
    });
  });
}

// Прививки группами по сроку календаря: «АКДС, полиомиелит и гемофильная инфекция, первые»
export function vaccineGroups(child, s = getState()) {
  const by = new Map();
  for (const it of VACCINES.items) {
    if (it.riskGroup) continue;
    const k = it.disease === 'flu' ? 'flu' : String(it.age);
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(it);
  }
  return [...by.values()].map((items) => {
    const due = Math.min(...items.map((it) => vaccineDate(it, child.dob)));
    const marks = items.map((it) => markOf(child, it.id, s));
    const done = marks.every((m) => m && m.status === 'done');
    const planned = !done && marks.find((m) => m && m.status === 'planned');
    const doneAt = done ? Math.max(...marks.map((m) => m.when || m.at)) : null;
    let title;
    if (items[0].age === 0) title = 'Гепатит B и БЦЖ — в роддоме';
    else if (items.length === 1) title = vaccineName(items[0]);
    else {
      const ords = [...new Set(items.map((it) => it.dose.split(' ')[0]))];
      const tail = ords.length === 1 && ORD[ords[0]] ? ', ' + ORD[ords[0]] : items.every((it) => it.dose.includes('ревакцинация')) ? ', ревакцинация' : '';
      title = cap(join(items.map((it) => SHORT[it.disease]))) + tail;
    }
    return { key: items.map((x) => x.id).join('+'), items, ids: items.map((x) => x.id), due, ageText: items[0].ageText, title, done, doneAt, planned: planned || null, age: items[0].age };
  }).sort((a, b) => a.due - b.due);
}
// Ближайшие по календарю: срок прошёл недавно или наступит в неделю, ещё не сделаны
export function dueVaccineGroups(child, s = getState(), t = now()) {
  return vaccineGroups(child, s).filter((g) => !g.done && g.due < startOfDay(t) + 7 * DAY && g.due > t - 75 * DAY && !g.ids.includes('flu'));
}
export function lastDoneVaccine(child, s = getState()) {
  return vaccineGroups(child, s).filter((g) => g.done).sort((a, b) => b.doneAt - a.doneAt)[0] || null;
}
export const inAge = (txt) => (/^(в|на|с)\s/.test(txt) ? txt : 'в ' + txt);
export const doneWord = (g) => (g.items.length > 1 ? 'Сделаны' : 'Сделана');
export function vaccineSub(child, g, t = now()) {
  if (g.done) {
    const inHospital = g.age === 0 && g.doneAt - child.dob < 8 * DAY;
    return inHospital ? 'Сделаны в роддоме' : `${doneWord(g)} ${dateLong(g.doneAt)}`;
  }
  if (g.planned) return `Записались на ${dateLong(g.planned.when)}${timeOf(g.planned.when) ? ', ' + timeOf(g.planned.when) : ''} · напомним накануне`;
  if (g.age === 0) return 'Отметьте, если сделали';
  return `По календарю — ${inAge(g.ageText)}. Записаться и отметить`;
}

// Лист прививки: «Сделана» с днём или «Записались» с днём
export function VaccineSheet({ childId, gkey }) {
  const s = getState();
  const child = s.children.find((c) => c.id === childId);
  const g = vaccineGroups(child, s).find((x) => x.key === gkey);
  const [mode, setMode] = useState(g && g.planned ? 'planned' : 'done');
  const [day, setDay] = useState(startOfDay(now()));
  const [other, setOther] = useState(false);
  const [time, setTime] = useState(g && g.planned ? hhmm(g.planned.when).padStart(5, '0') : '10:00');
  if (!g) return html`<div class="h2">Прививка</div><button class="btn btn-gray" onClick=${closeSheet}>Закрыть</button>`;
  const t = now();
  const doneDays = [[startOfDay(t), 'Сегодня'], [startOfDay(t) - DAY, 'Вчера']];
  const planDays = Array.from({ length: 7 }, (_, i) => startOfDay(t) + i * DAY).map((d, i) => [d, i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : `${weekdayShort(d)} ${new Date(d).getDate()}`]);
  const commit = () => {
    if (mode === 'done') {
      const when = day + 12 * 3600e3;
      setMarks(child, g.ids, { status: 'done', at: now(), when });
      track('здоровье:прививка-сделана');
      closeSheet();
      toast({ text: `${g.items.length > 1 ? 'Прививки сделаны' : 'Прививка сделана'}, ${dateLong(when)}`, actions: [{ label: 'Отменить', onClick: () => setMarks(child, g.ids, null) }] });
    } else {
      let when = day;
      if (time) { const [h, m] = time.split(':').map(Number); when = day + (h * 60 + m) * 60000; } else when = day + 10 * 3600e3;
      setMarks(child, g.ids, { status: 'planned', at: now(), when });
      track('здоровье:прививка-записались');
      closeSheet();
      toast({ text: `Записали на ${dateLong(when)} — прививка в «На этой неделе»`, actions: [{ label: 'Отменить', onClick: () => setMarks(child, g.ids, null) }] });
    }
  };
  return html`
    <div class="h2">${g.title}</div>
    <div class="small">По календарю — ${inAge(g.ageText)}${isPreterm(child) ? ' · по дате рождения' : ''}</div>
    ${g.items.length > 1 && html`<div class="tiny">${g.items.map((it) => vaccineName(it)).join(' · ')}</div>`}
    <div class="pills">
      <${Pill} on=${mode === 'done'} onClick=${() => { setMode('done'); setDay(startOfDay(t)); }}>${doneWord(g)}<//>
      <${Pill} on=${mode === 'planned'} onClick=${() => { setMode('planned'); setDay(startOfDay(t) + DAY); }}>Записались<//>
    </div>
    <div class="label">${mode === 'done' ? 'Когда' : 'На какой день'}</div>
    <div class="pills">
      ${(mode === 'done' ? doneDays : planDays).map(([d, l]) => html`<${Pill} on=${!other && day === d} onClick=${() => { setOther(false); setDay(d); }}>${l}<//>`)}
      ${other ? html`<input class="pill" type="date" value=${dayKey(day)} onChange=${(e) => { const [y, m, dd] = e.target.value.split('-').map(Number); if (y) setDay(new Date(y, m - 1, dd).getTime()); }} />`
        : html`<button class="pill" onClick=${() => setOther(true)}>Другой день</button>`}
    </div>
    ${mode === 'planned' && html`<div class="label">Во сколько</div><input class="pill rb-time" type="time" value=${time} onChange=${(e) => setTime(e.target.value)} />`}
    <button class="btn btn-primary" onClick=${commit}>Готово</button>
    ${(g.done || g.planned) && html`<button class="btn-quiet" onClick=${() => { setMarks(child, g.ids, null); closeSheet(); toast({ text: 'Отметку сняли', ms: 2000 }); }}>Снять отметку</button>`}
  `;
}
export const openVaccine = (child, g) => { track('здоровье:прививка'); openSheet(VaccineSheet, { childId: child.id, gkey: g.key }); };

// ——— Записи дня — подписи, как в Фигме: «Кормление, правая грудь, 15 мин» ———
export function recTitle(r) {
  const d = r.data || {};
  const len = r.end != null && r.end > r.start ? durNoPad(r.end - r.start) : '';
  switch (r.type) {
    case 'sleep': return r.end == null ? 'Сон — идёт' : `Сон ${len}`;
    case 'feed': return d.method === 'bottle' ? `Бутылочка, ${d.ml || '—'} мл` : `Кормление, ${SIDE[d.side] || ''} грудь${len ? ', ' + len : ''}`;
    case 'diaper': return `Подгузник, ${DIAPER[d.kind] || 'мокрый'}`;
    case 'potty': return `Горшок, ${POTTY[d.result] || 'получилось'}`;
    case 'walk': return r.end == null ? 'Прогулка — идёт' : `Прогулка ${len}`;
    default: return describe(r).replace(/ · /g, ', ');
  }
}
export function durNoPad(ms) { const m = Math.max(1, Math.round(ms / 60000)); const h = Math.floor(m / 60), mm = m % 60; return h ? (mm ? `${h} ч ${mm} мин` : `${h} ч`) : `${mm} мин`; }
export const recTime = (r) => (r.end != null && r.end - r.start > 60000 ? `${hhmm(r.start)}–${hhmm(r.end)}` : r.end == null ? `с ${hhmm(r.start)}` : hhmm(r.start));
// Итог дня строкой без «Сегодня:»
export function dayTotal(child, d, t = now()) {
  const sm = daySummary(child.id, d, t);
  if (!sm.any) return null;
  const m = ageMonths(child, t);
  const parts = [];
  if (sm.sleep) parts.push(`Сон ${durNoPad(sm.sleep)}`);
  if (m < 12) {
    if (sm.feeds) parts.push(pl(sm.feeds, 'кормление', 'кормления', 'кормлений'));
    if (sm.diapers) parts.push(pl(sm.diapers, 'подгузник', 'подгузника', 'подгузников'));
  } else {
    if (sm.food) parts.push(`еда ${pl(sm.food, 'раз', 'раза', 'раз')}`);
    if (sm.potty) parts.push(`горшок ${pl(sm.potty, 'раз', 'раза', 'раз')}`);
    if (sm.feeds) parts.push(pl(sm.feeds, 'кормление', 'кормления', 'кормлений'));
  }
  if (!parts.length) return null;
  parts[0] = cap(parts[0]);
  return parts.join(' · ');
}

// ——— Замеры ———
export const measures = (child, s = getState()) => recordsOf(child.id, s).filter((r) => r.type === 'measure').sort((a, b) => b.start - a.start);
export function measureLine(r, sep = ' · ') {
  const d = r.data || {};
  const p = [];
  if (d.weight) p.push(`${fmtNum(d.weight, 2)} кг`);
  if (d.height) p.push(`${fmtNum(d.height, 1)} см`);
  // На дашборде — «5,6 кг и 58 см», голова — только в «Росте»
  if (sep === ' и ') return p.length ? p.join(' и ') : `голова ${fmtNum(d.head, 1)} см`;
  if (d.head) p.push(`голова ${fmtNum(d.head, 1)} см`);
  return p.join(sep);
}

// ——— Болезнь: эпизод в s.rebyonok.ill или записи температуры и лекарства за двое суток ———
export function illness(child, s = getState(), t = now()) {
  const eps = forChild(R(s).ill, child.id) || [];
  const list = Array.isArray(eps) ? eps : [];
  const open = list.find((e) => !e.to);
  const recs = recordsOf(child.id, s).filter((r) => r.type === 'temp' || r.type === 'med').sort((a, b) => b.start - a.start);
  const lastEnded = Math.max(0, ...list.filter((e) => e.to).map((e) => e.to));
  let from = null;
  if (open) from = open.from;
  else if (recs.length && t - recs[0].start < 2 * DAY && recs[0].start > lastEnded) {
    // начало цепочки: записи без перерыва больше двух суток
    from = recs[0].start;
    for (const r of recs) { if (r.start <= lastEnded) break; if (from - r.start < 2 * DAY) from = r.start; else break; }
  }
  if (from == null) return null;
  const inside = recs.filter((r) => r.start >= startOfDay(from));
  return { from, open, temp: inside.find((r) => r.type === 'temp') || null, med: inside.find((r) => r.type === 'med') || null, recs: inside };
}
export function endIllness(child, from) {
  rUpdate((r) => {
    r.ill = r.ill || {};
    const list = r.ill[child.id] = r.ill[child.id] || [];
    const open = list.find((e) => !e.to);
    if (open) open.to = now(); else list.push({ id: uid(), from, to: now() });
  });
}
export function startIllness(child) {
  rUpdate((r) => { r.ill = r.ill || {}; const list = r.ill[child.id] = r.ill[child.id] || []; if (!list.find((e) => !e.to)) list.push({ id: uid(), from: now(), to: null }); });
}

// ——— Моменты и воспоминания ———
export const momentsOf = (child, s = getState()) => (s.moments || []).filter((m) => m.childId === child.id).sort((a, b) => b.at - a.at);
export const momentTitle = (m) => ((m.text || '').split('\n')[0] || 'Момент').trim();
export const momentMore = (m) => (m.text || '').split('\n').slice(1).join('\n').trim();
// В первый год — «месяц назад», потом — «год назад»; ±3 дня от того же числа
export function memory(child, s = getState(), t = now()) {
  const firstYear = inFirstYear(child, t);
  const back = new Date(t);
  if (firstYear) back.setMonth(back.getMonth() - 1); else back.setFullYear(back.getFullYear() - 1);
  const target = back.getTime();
  const hidden = s.dismissed || [];
  const cands = momentsOf(child, s).filter((m) => Math.abs(startOfDay(m.at) - startOfDay(target)) <= 3 * DAY && !hidden.includes('memory:' + m.id));
  if (!cands.length) return null;
  cands.sort((a, b) => Math.abs(a.at - target) - Math.abs(b.at - target));
  return { moment: cands[0], label: firstYear ? 'Месяц назад' : 'Год назад' };
}
// Месячный день рождения: сегодня то же число, что в дату рождения
export function monthBirthday(child, t = now()) {
  const a = new Date(child.dob), b = new Date(t);
  const { months, totalDays } = diffYMD(child.dob, t);
  if (totalDays < 20 || months < 1 || months >= 36) return null;
  const last = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate();
  if (b.getDate() !== Math.min(a.getDate(), last)) return null;
  return months;
}
export function ageWords(months) {
  const W = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять', 'одиннадцать'];
  if (months < 12) return `${['', 'месяц', 'два месяца', 'три месяца', 'четыре месяца', 'пять месяцев', 'шесть месяцев', 'семь месяцев', 'восемь месяцев', 'девять месяцев', 'десять месяцев', 'одиннадцать месяцев'][months]}`;
  const y = Math.floor(months / 12), r = months % 12;
  const ys = y === 1 ? 'год' : y < 5 ? `${W[y]} года` : `${W[y]} лет`;
  return r ? `${ys} и ${W[r]}` : ys;
}

// Раздел, пока малыш не родился или ребёнка нет: не тупик — что сделать сейчас
export function NotBorn({ title, text }) {
  const s = getState();
  const c = activeChild(s);
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">${title}</h1>
      <p class="lead">${text}</p>
      ${c && c.expecting
        ? html`<button class="btn btn-primary" onClick=${() => go('/profil/rebyonok/' + c.id)}>Малыш родился</button>`
        : html`<button class="btn btn-primary" onClick=${() => go('/profil/rebyonok/novyy')}>Добавить ребёнка</button>`}
      <button class="btn btn-gray" onClick=${() => go('/rebyonok')}>К «Ребёнку»</button>
    </div>`;
}
