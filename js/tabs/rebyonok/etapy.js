// «Ребёнок»: разделы, которые появляются с возрастом — детский сад, кружки и секции, школа,
// документы ребёнка в одном месте (журнал, 5 ноября). Правила возраста — stages.js, тексты — content/etapy.js.
// В веб-версии всё хранится на телефоне, в state.etapy[childId]. В приложении таких разделов пока нет:
// это новые данные — решать Марии (сейчас там есть «К школе» с пяти лет и дела дня).
import { html, useState, useEffect } from '../../lib.js?v=20';
import { useStore, update, uid, now, activeChild } from '../../store.js?v=20';
import { Header, Row, SecTitle, Pill, Field, openSheet, closeSheet, toast } from '../../ui.js?v=20';
import { dateLong, ageMonths, startOfDay, DAY } from '../../age.js?v=20';
import { go } from '../../router.js?v=20';
import { track } from '../../stats.js?v=20';
import { SAD, SHKOLA, DOCS, CHECKUPS_BY_AGE } from '../../content/etapy.js?v=20';
import { bornChild, nameOf, NotBorn } from './util.js?v=20';
import { findItems } from '../../common.js?v=20';

const E = (s, child) => ((s.etapy || {})[child.id]) || {};
const setE = (child, fn) => update((d) => { d.etapy = d.etapy || {}; d.etapy[child.id] = d.etapy[child.id] || {}; fn(d.etapy[child.id]); });
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const wdOf = (t) => (new Date(t).getDay() + 6) % 7;

// ——— Общее: шаг чек-листа листом — когда, где, что взять, отметка и своя заметка ———
function StepSheet({ childId, list, id }) {
  const s = useStore();
  const child = s.children.find((c) => c.id === childId);
  const x = list.find((y) => y.id === id);
  const e = E(s, child);
  const done = (e.done || {})[id];
  const [note, setNote] = useState(((e.notes || {})[id]) || '');
  const save = (mark) => { setE(child, (o) => { o.done = o.done || {}; o.notes = o.notes || {}; if (mark === true) o.done[id] = now(); if (mark === false) delete o.done[id]; o.notes[id] = note.trim(); }); };
  return html`
    <div class="h2">${x.title}</div>
    ${x.when && html`<div class="label">Когда</div><p class="p">${x.when}</p>`}
    ${x.where && html`<div class="label">Где</div><p class="p">${x.where}</p>`}
    ${(x.what || x.note) && html`<div class="label">${x.what ? 'Что взять и знать' : 'Важно'}</div><p class="p">${x.what || x.note}</p>`}
    ${(x.links || []).map((l) => html`<a class="link" href=${l.url} target="_blank" rel="noopener" onClick=${() => track('этапы:ссылка')}>${l.title} ›</a>`)}
    <label class="field"><span class="label">Заметка — по желанию</span><textarea value=${note} placeholder="Номер заявления, где лежит, до какого числа" onInput=${(ev) => setNote(ev.target.value)}></textarea></label>
    <div class="pills"><${Pill} on=${!!done} onClick=${() => save(true)}>${list === DOCS ? 'Есть' : 'Сделали'}<//><${Pill} on=${!done} onClick=${() => save(false)}>${list === DOCS ? 'Пока нет' : 'Ещё нет'}<//></div>
    <button class="btn btn-primary" onClick=${() => { save(); closeSheet(); track('этапы:шаг'); }}>Готово</button>`;
}
const openStep = (child, list, id) => openSheet(StepSheet, { childId: child.id, list, id });

function Steps({ child, list, s }) {
  const e = E(s, child);
  const done = e.done || {};
  const next = list.filter((x) => !done[x.id]);
  const ready = list.filter((x) => done[x.id]);
  return html`
    ${next.length > 0 && html`<${SecTitle}>${ready.length ? 'Дальше' : 'По шагам'}<//>
      <div class="rows">${next.map((x, i) => html`<${Row} key=${x.id} title=${x.title} sub=${i === 0 ? (x.when || '').split('. ')[0] : (e.notes || {})[x.id] || ''} onClick=${() => openStep(child, list, x.id)} />`)}</div>`}
    ${ready.length > 0 && html`<${SecTitle}>Готово · ${ready.length} из ${list.length}<//>
      <div class="rows">${ready.map((x) => html`<${Row} key=${x.id} title=${'✓ ' + x.title} sub=${(e.notes || {})[x.id] || `Отметили ${dateLong(done[x.id])}`} onClick=${() => openStep(child, list, x.id)} />`)}</div>`}`;
}

// Контакты места: сад или школа — название, воспитатель или учитель, телефон, чат
function Contacts({ child, s, kind }) {
  const e = E(s, child);
  const c0 = e[kind] || {};
  const [v, setV] = useState({ place: c0.place || '', person: c0.person || '', phone: c0.phone || '', extra: c0.extra || '' });
  const L = kind === 'sad'
    ? { place: ['Детский сад', 'Детский сад № 12, группа «Солнышко»'], person: ['Воспитатель', 'Имя и отчество'], extra: ['Что важно помнить', 'Утренник 25 декабря, оплата до 10-го'] }
    : { place: ['Школа и класс', 'Школа № 5, 1 «Б»'], person: ['Учитель', 'Имя и отчество'], extra: ['Что важно помнить', 'Собрание, продлёнка, родительский чат'] };
  const changed = ['place', 'person', 'phone', 'extra'].some((k) => (v[k] || '') !== (c0[k] || ''));
  return html`
    <${SecTitle}>Контакты<//>
    <${Field} label=${L.place[0]} value=${v.place} placeholder=${L.place[1]} onInput=${(x) => setV({ ...v, place: x })} />
    <${Field} label=${L.person[0]} value=${v.person} placeholder=${L.person[1]} onInput=${(x) => setV({ ...v, person: x })} />
    <${Field} label="Телефон" type="tel" value=${v.phone} placeholder="+7…" onInput=${(x) => setV({ ...v, phone: x })} />
    <${Field} label=${L.extra[0]} value=${v.extra} placeholder=${L.extra[1]} onInput=${(x) => setV({ ...v, extra: x })} />
    ${changed && html`<button class="btn btn-gray" onClick=${() => { setE(child, (o) => { o[kind] = { ...v }; }); track('этапы:контакты-' + kind); toast({ text: 'Сохранили', ms: 1500 }); }}>Сохранить контакты</button>`}
    ${c0.phone && html`<a class="btn btn-gray" href=${'tel:' + c0.phone.replace(/[^\d+]/g, '')}>Позвонить</a>`}`;
}

// ——— Детский сад ———
function Sad() {
  const s = useStore();
  const child = bornChild(s);
  if (!child) return html`<${NotBorn} title="Детский сад" text="Очередь в сад можно занять, когда у малыша будут свидетельство о рождении и прописка." />`;
  const e = E(s, child);
  const goes = !!e.sadGoes;
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Детский сад</h1>
      <p class="lead">${goes ? `${nameOf(child)} ходит в сад${e.sad && e.sad.place ? ' — ' + e.sad.place : ''}. Здесь — контакты, справки и что важно помнить.` : 'От очереди до первого дня — по шагам. Отмечайте сделанное и записывайте номера, чтобы не искать их по чатам.'}</p>
      <div class="pills"><${Pill} on=${!goes} onClick=${() => setE(child, (o) => { o.sadGoes = false; })}>Пока не ходит<//><${Pill} on=${goes} onClick=${() => { setE(child, (o) => { o.sadGoes = true; }); track('сад:ходит'); }}>Уже ходит в сад<//></div>
      ${!goes && html`<${Steps} child=${child} list=${SAD} s=${s} />`}
      <${Contacts} child=${child} s=${s} kind="sad" />
      ${goes && html`<${SecTitle}>Если понадобится<//><div class="rows">${SAD.slice(3).map((x) => html`<${Row} key=${x.id} title=${x.title} onClick=${() => openStep(child, SAD, x.id)} />`)}</div>`}
      <div class="rows"><${Row} title="Справки и документы" sub="Медкарта, прививочный сертификат, справки — в одном месте" onClick=${() => go('/rebyonok/vse-dokumenty')} /></div>
    </div>`;
}

// ——— Школа ———
function Shkola() {
  const s = useStore();
  const child = bornChild(s);
  if (!child) return html`<${NotBorn} title="Школа" text="Раздел появится, когда ребёнок подрастёт." />`;
  const m = ageMonths(child, now());
  const pupil = m >= 84 || E(s, child).schoolGoes;
  const reads = findItems('школ', { limit: 6 }).filter((it) => /^\/(statya|dlya-sebya\/statya)\//.test(it.path)).slice(0, 4);
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Школа</h1>
      <p class="lead">${pupil ? 'Контакты учителя, расписание кружков и справки — здесь, а не в десяти чатах.' : 'Запись в 1 класс — по шагам: когда подавать, куда и что взять.'}</p>
      <div class="pills"><${Pill} on=${!pupil} onClick=${() => setE(child, (o) => { o.schoolGoes = false; })}>Готовимся<//><${Pill} on=${pupil} onClick=${() => { setE(child, (o) => { o.schoolGoes = true; }); track('школа:учится'); }}>Уже учится<//></div>
      ${!pupil && html`<${Steps} child=${child} list=${SHKOLA} s=${s} />`}
      <${Contacts} child=${child} s=${s} kind="school" />
      <div class="rows">
        <${Row} title="Кружки и секции" sub="Дни, время и что взять — на «Сегодня»" onClick=${() => go('/rebyonok/kruzhki')} />
        <${Row} title="Справки и документы" sub="Медкарта, прививки, справки для секций" onClick=${() => go('/rebyonok/vse-dokumenty')} />
      </div>
      ${reads.length > 0 && html`<${SecTitle}>Почитать<//><div class="rows">${reads.map((it) => html`<${Row} key=${it.path} title=${it.title} onClick=${() => { track('школа:статья'); go(it.path); }} />`)}</div>`}
    </div>`;
}

// ——— Кружки и секции ———
export function clubsOf(child, s) { return (E(s, child).clubs || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || '')); }
export function clubsOn(child, s, t) { const wd = wdOf(t); return clubsOf(child, s).filter((c) => (c.days || []).includes(wd)); }

function ClubSheet({ childId, id }) {
  const s = useStore();
  const child = s.children.find((c) => c.id === childId);
  const old = id ? clubsOf(child, s).find((c) => c.id === id) : null;
  const [v, setV] = useState(old ? { ...old } : { name: '', days: [], time: '17:00', place: '', bring: '', pay: '' });
  const ok = v.name.trim() && v.days.length;
  const toggle = (d) => setV({ ...v, days: v.days.includes(d) ? v.days.filter((x) => x !== d) : [...v.days, d].sort() });
  const save = () => {
    setE(child, (o) => { o.clubs = o.clubs || []; const item = { ...v, name: v.name.trim(), id: old ? old.id : uid() }; const i = o.clubs.findIndex((c) => c.id === item.id); if (i >= 0) o.clubs[i] = item; else o.clubs.push(item); });
    track(old ? 'кружки:поправить' : 'кружки:добавить'); closeSheet(); toast({ text: old ? 'Поправили' : `Добавили: ${v.name.trim()} — будет на «Сегодня» в свои дни`, ms: 3000 });
  };
  return html`
    <div class="h2">${old ? old.name : 'Кружок или секция'}</div>
    <${Field} label="Название" value=${v.name} placeholder="Бассейн, рисование, английский" onInput=${(x) => setV({ ...v, name: x })} />
    <div class="label">Дни</div>
    <div class="pills">${WD.map((w, i) => html`<${Pill} on=${v.days.includes(i)} onClick=${() => toggle(i)}>${w}<//>`)}</div>
    <label class="field"><span class="label">Во сколько</span><input type="time" value=${v.time} onChange=${(e) => setV({ ...v, time: e.target.value })} /></label>
    <${Field} label="Где — по желанию" value=${v.place} placeholder="Адрес или название" onInput=${(x) => setV({ ...v, place: x })} />
    <${Field} label="Что взять — по желанию" value=${v.bring} placeholder="Шапочка, очки, справка" onInput=${(x) => setV({ ...v, bring: x })} />
    <${Field} label="Оплата — по желанию" value=${v.pay} placeholder="До 5-го числа, абонемент" onInput=${(x) => setV({ ...v, pay: x })} />
    <button class="btn btn-primary" disabled=${!ok} onClick=${save}>${old ? 'Сохранить' : 'Добавить'}</button>
    ${old && html`<button class="btn-quiet" onClick=${() => { setE(child, (o) => { o.clubs = (o.clubs || []).filter((c) => c.id !== old.id); }); closeSheet(); toast({ text: 'Убрали', ms: 1500 }); }}>Убрать</button>`}`;
}
export const openClub = (child, id) => openSheet(ClubSheet, { childId: child.id, id });

function Kruzhki({ query }) {
  const s = useStore();
  const child = bornChild(s);
  useEffect(() => { if (query && query.novyy && child) { openClub(child); history.replaceState(null, '', '#/rebyonok/kruzhki'); } }, []);
  if (!child) return html`<${NotBorn} title="Кружки и секции" text="Раздел появится, когда ребёнок подрастёт." />`;
  const list = clubsOf(child, s);
  const t = now();
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Кружки и секции</h1>
      <p class="lead">Дни, время, что взять и когда платить. В свой день кружок будет на «Сегодня».</p>
      ${list.length ? html`<div class="rows">${list.map((c) => html`<${Row} key=${c.id} title=${c.name} sub=${[(c.days || []).map((d) => WD[d]).join(', ') + (c.time ? ' · ' + c.time : ''), c.bring && 'взять: ' + c.bring].filter(Boolean).join(' · ')} end=${(c.days || []).includes(wdOf(t)) ? 'сегодня' : ''} onClick=${() => openClub(child, c.id)} />`)}</div>`
        : html`<p class="small">Пока ни одного. Бассейн, танцы, музыкалка — добавьте, и в нужный день приложение напомнит, что взять.</p>`}
      <button class="btn btn-primary" onClick=${() => openClub(child)}>＋ Добавить кружок</button>
      <div class="rows"><${Row} title="Справки для бассейна и секций" sub="Сроки справок — в «Документах ребёнка»" onClick=${() => go('/rebyonok/vse-dokumenty')} /></div>
    </div>`;
}

// ——— Документы ребёнка — одно место ———
function VseDokumenty() {
  const s = useStore();
  const child = bornChild(s);
  if (!child) return html`<${NotBorn} title="Документы ребёнка" text="Список появится, когда малыш родится." />`;
  const e = E(s, child);
  const m = ageMonths(child, now());
  const list = DOCS.filter((d) => d.id !== 'doc-passport' || m >= 150).filter((d) => d.id !== 'doc-026' || m >= 12).filter((d) => d.id !== 'doc-cert' || m >= 24).filter((d) => d.id !== 'doc-sport' || m >= 24).filter((d) => d.id !== 'doc-mantu' || m >= 12).filter((d) => d.id !== 'doc-pmpk' || m >= 36);
  const have = list.filter((d) => (e.done || {})[d.id]).length;
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Документы ребёнка</h1>
      <p class="lead">Что есть, где лежит и когда обновлять — в одном месте. Номера и места пишите в заметке: они хранятся только на этом телефоне.</p>
      ${m < 12 && html`<div class="rows"><${Row} title="Документы после рождения" sub="Свидетельство, СНИЛС, ОМС, пособия — по шагам" onClick=${() => go('/rebyonok/dokumenty')} /></div>`}
      <${SecTitle}>Есть · ${have} из ${list.length}<//>
      <div class="rows">${list.map((d) => html`<${Row} key=${d.id} title=${((e.done || {})[d.id] ? '✓ ' : '') + d.title} sub=${(e.notes || {})[d.id] || d.note} onClick=${() => openStep(child, DOCS, d.id)} />`)}</div>
    </div>`;
}

// ——— Для плиток «Ребёнка» и «Сегодня» ———
export function sadLine(child, s) {
  const e = E(s, child);
  if (e.sadGoes) return { v: e.sad && e.sad.place ? e.sad.place : 'Ходит в сад', sub: e.sad && e.sad.person ? e.sad.person : 'контакты и справки' };
  const next = SAD.find((x) => !(e.done || {})[x.id]);
  const n = SAD.filter((x) => (e.done || {})[x.id]).length;
  return next ? { v: next.title, sub: n ? `шаг ${n + 1} из ${SAD.length}` : 'от очереди до первого дня' } : { v: 'Всё готово', sub: 'отметьте «Уже ходит»' };
}
export function schoolLine(child, s) {
  const e = E(s, child);
  const m = ageMonths(child, now());
  if (m >= 84 || e.schoolGoes) return { v: e.school && e.school.place ? e.school.place : 'Учится', sub: e.school && e.school.person ? e.school.person : 'учитель и контакты' };
  const next = SHKOLA.find((x) => !(e.done || {})[x.id]);
  return next ? { v: next.title, sub: 'запись в 1 класс' } : { v: 'Записались', sub: 'контакты учителя' };
}
export function clubsLine(child, s, t = now()) {
  const today = clubsOn(child, s, t);
  if (today.length) return { v: today.map((c) => c.name).join(', '), sub: 'сегодня' + (today[0].time ? ' в ' + today[0].time : '') };
  const all = clubsOf(child, s);
  if (!all.length) return { v: 'Добавить', sub: 'дни, время, что взять' };
  for (let k = 1; k <= 7; k++) { const wd = wdOf(t + k * DAY); const c = all.find((x) => (x.days || []).includes(wd)); if (c) return { v: c.name, sub: `${WD[wd].toLowerCase()}${c.time ? ' в ' + c.time : ''}` }; }
  return { v: all[0].name, sub: 'без дней' };
}
export const docsCount = (child, s) => { const e = E(s, child); return DOCS.filter((d) => (e.done || {})[d.id]).length; };
// Ближайший профосмотр: за два месяца до и полгода после нужного возраста
export function checkupNow(child, t = now()) {
  const m = ageMonths(child, t);
  const c = CHECKUPS_BY_AGE.find((x) => m >= x.m - 2 && m < x.m + 10);
  if (c) return c;
  // После 10 лет — раз в год; в 13 лет добавляется гинеколог или уролог-андролог (приказ № 211н)
  if (m >= 130 && m < 216 && m % 12 >= 10) { const y = Math.floor(m / 12) + 1; return { m: y * 12, title: `Осмотр в ${y} лет`, who: 'Педиатр и врачи по возрасту — список в поликлинике.', note: y === 13 ? 'В 13 лет добавляется гинеколог или уролог-андролог.' : '' }; }
  return null;
}

export const etapyRoutes = [
  { path: '/rebyonok/sad', view: Sad, tab: '/rebyonok' },
  { path: '/rebyonok/shkola', view: Shkola, tab: '/rebyonok' },
  { path: '/rebyonok/kruzhki', view: Kruzhki, tab: '/rebyonok' },
  { path: '/rebyonok/vse-dokumenty', view: VseDokumenty, tab: '/rebyonok' },
];
