// «Сегодня»: что показать человеку прямо сейчас — по этапу, возрасту, времени суток и записям.
// Здесь только расчёты по состоянию на телефоне; экраны — в segodnya.js и parts.js.
import { getState, now, activeChild } from '../../store.js';
import {
  DAY, startOfDay, dayKey, ageMonths, ageDays, diffYMD, isPreterm, correctedDob, partOfDay, pl,
  ageAt, dateWithWeekday, dateLong, weekdayLong, hhmm, pregnancyWeek, dur,
} from '../../age.js';
import { yesterdaySleep, sleepNorm, hasRecords, recordsOf } from '../../records.js';
import { factsFor } from '../../content/facts.js';
import { activitiesFor } from '../../content/activities.js';
import { ARTICLES, articlesFor } from '../../content/articles.js';
import { weekLines } from '../../content/weekly.js';
import { VACCINES, CDC } from '../../content/reference.js';
import { genitive } from '../../onboarding.js';

const H = 3600e3;
export const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
export const seg = (s = getState()) => s.segodnya || {};
export const lowerFirst = (x) => (x ? x[0].toLowerCase() + x.slice(1) : x);
export const upperFirst = (x) => (x ? x[0].toUpperCase() + x.slice(1) : x);
const isDismissed = (s, key) => (s.dismissed || []).includes(key);

// Адреса других вкладок — в одном месте, чтобы поменять одной строкой
export const ROUTES = {
  day: (t) => '/rebyonok/dnevnik?den=' + dayKey(t),
  week: '/rebyonok/dnevnik?vid=nedelya',
  sleepWeek: '/rebyonok/dnevnik?vid=son',
  development: '/rebyonok/razvitie',
  health: '/rebyonok/zdorovye',
  tales: '/rebyonok/skazki',
  activity: (id) => '/rebyonok/zanyatie/' + id,
  article: (id) => '/statya/' + id,
  self: '/dlya-sebya',
  notes: '/dlya-sebya/zametki',
  club: '/moy-nen/klub',
  course: '/moy-nen/kurs',
  idea: '/moy-nen/ideya',
};

// ——— Этап и возраст ———
// 'none' — без ребёнка; 'expecting'; 'newborn' — 0–4 недели; 'baby' — до года; 'toddler' — 1–3; 'kid' — 3–7
export function stageOf(child, t = now()) {
  if (!child) return 'none';
  if (child.expecting) return 'expecting';
  if (ageDays(child, t) < 28) return 'newborn';
  const m = ageMonths(child, t);
  if (m < 12) return 'baby';
  if (m < 36) return 'toddler';
  return 'kid';
}
// Дата, от которой считаются этапы: у рождённых раньше 37 недель до двух лет — исправленная
export function stageDob(child, t = now()) {
  return isPreterm(child) && diffYMD(child.dob, t).months < 24 ? correctedDob(child) : child.dob;
}
export const addMonths = (base, m) => { const d = new Date(base); d.setMonth(d.getMonth() + m); return d.getTime(); };

// Слова о ребёнке по полу: без пола — нейтральная форма, а не мужской род
export const bySex = (child, boy, girl, neutral) => (child && child.sex === 'girl' ? girl : child && child.sex === 'boy' ? boy : neutral);

// Первое предложение факта — заголовок карточки, остальное — текст
export function splitFact(text = '') {
  const m = /^(.+?[.?!…])\s+([А-ЯЁA-Z«].*)$/s.exec(text);
  return m ? [m[1], m[2]] : [text, ''];
}

const urlKey = (u) => (u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
export const articleByUrl = (u) => (u ? ARTICLES.find((a) => urlKey(a.url) === urlKey(u)) : null);
export const shortUrl = (u) => urlKey(u).replace(/^n-e-n\.ru/, 'n-e-n.ru');

// ——— Итог дня и ориентир ———
// Ночной сон хоть раз записан? Иначе ориентир за вчера не появится — показываем обещание
function nightSleep(r) {
  if (r.type !== 'sleep' || r.end == null) return false;
  for (let d = startOfDay(r.start) - DAY; d <= startOfDay(r.end); d += DAY) {
    if (Math.min(r.end, d + DAY + 7 * H) - Math.max(r.start, d + 21 * H) > H) return true;
  }
  return false;
}
export const everNightSleep = (childId, s = getState()) => s.records.some((r) => r.childId === childId && nightSleep(r));
export const anyRecords = (childId, s = getState()) => s.records.some((r) => r.childId === childId);

// Ориентир сна — по фактическому возрасту, как сейчас в приложении (вопрос Марии); с 6 лет не показываем:
// в приложении полоса 10–13 ч дана на 3–6 лет
function normAge(child, t) {
  const m = diffYMD(child.dob, t).months;
  if (m >= 72) return null;
  const n = sleepNorm(m);
  if (!n) return null;
  return { m, n };
}
export function sleepNormLine(child, t = now()) {
  const total = yesterdaySleep(child.id, t);
  const a = normAge(child, t);
  if (!total || !a) return null;
  const at = a.m < 12 ? ageAt(child.dob, t) : a.m < 36 ? '1–3 года' : '3–6 лет';
  const name = child.name || 'Ребёнок';
  const head = bySex(child, `Вчера ${name} спал ${dur(total)}.`, `Вчера ${name} спала ${dur(total)}.`, `Вчера сон ${genitive(child.name)} — ${dur(total)}.`);
  return `${head} Ориентир в ${at} — ${a.n[0]}–${a.n[1]} ч в сутки, бывает и больше, и меньше.`;
}
// Строка о завтра после первой записи (страница 36, экран 6)
export function promiseLine(child, t = now()) {
  const a = normAge(child, t);
  if (!a) return null;
  const { months, totalDays } = diffYMD(child.dob, t);
  let forAge;
  if (months < 1) { const w = Math.max(1, Math.floor(totalDays / 7)); forAge = pl(w, 'недели', 'недель', 'недель'); }
  else if (months < 12) forAge = pl(months, 'месяца', 'месяцев', 'месяцев');
  else forAge = months < 36 ? '1–3 лет' : '3–6 лет';
  const name = child.name || 'ребёнок';
  const who = bySex(child, `сколько ${name} спал за сутки`, `сколько ${name} спала за сутки`, `сколько длился сон ${genitive(child.name)} за сутки`);
  return `Запишите сон, в том числе ночной, — завтра утром покажем, ${who}, рядом с ориентиром для ${forAge}.`;
}
export const FIRST_WEEKS = 'В первые недели обычно 8–12 кормлений в сутки, а с пятого дня — не меньше 6 мокрых подгузников.';
export function firstHint(child, t = now()) {
  return ageMonths(child, t) < 12
    ? 'Запишите первое кормление или сон — здесь появится итог дня.'
    : 'Запишите первый сон, еду или горшок — здесь появится итог дня.';
}

// Неделя тяжело со сном: три дня из семи с записанной ночью и сном ниже ориентира
export function hardSleepWeek(child, t = now()) {
  const a = normAge(child, t);
  if (!a) return false;
  let known = 0, low = 0;
  for (let i = 1; i <= 7; i++) {
    const d = startOfDay(t) - i * DAY;
    const tot = yesterdaySleep(child.id, d + DAY + 1000);
    if (tot) { known++; if (tot < a.n[0] * H) low++; }
  }
  return known >= 3 && low >= 3;
}

// ——— Материалы дня ———
// «Нет, это нормально»: один в день, подряд не повторяется, «Не показывать» убирает
export function factsOfDay(s, child, t = now()) {
  if (!child || child.expecting) return [];
  const m = Math.max(1, ageMonths(child, t));
  const list = factsFor(m).filter((f) => !isDismissed(s, 'fact:' + f.id));
  const n = list.length;
  if (!n) return [];
  const iy = hash('f' + dayKey(t - DAY)) % n;
  let i = hash('f' + dayKey(t)) % n;
  if (n > 1 && i === iy) i = (i + 1) % n;
  const out = [list[i]];
  if (n > 1) { let j = (i + 1) % n; if (j === iy && n > 2) j = (j + 1) % n; out.push(list[j]); }
  return out;
}

// Занятие на сегодня: одно в день; сделанное — не раньше чем через 14 дней; «Другое занятие» — следующее
export function activityPick(s, child, t = now()) {
  if (!child || child.expecting) return null;
  const m = ageMonths(child, t);
  const sod = startOfDay(t);
  const done = s.done || {};
  const list = activitiesFor(m).filter((a) => !isDismissed(s, 'activity:' + a.id));
  if (!list.length) return null;
  const fresh = list.filter((a) => { const d = done['activity:' + a.id]; return !d || d >= sod || t - d > 14 * DAY; });
  const pool = fresh.length ? fresh : list;
  const n = pool.length;
  const day = dayKey(t);
  const shift = ((seg(s).actShift || {})[day]) || 0;
  let i = hash('a' + day) % n;
  if (n > 1 && i === hash('a' + dayKey(t - DAY)) % n) i = (i + 1) % n;
  const a = pool[(i + shift) % n];
  return { ...a, doneToday: (done['activity:' + a.id] || 0) >= sod };
}
export const activityTitle = (a) => (a.title.endsWith('…') ? splitFact(a.text)[0] : a.title);
export const activityText = (a) => (a.title.endsWith('…') ? splitFact(a.text)[1] : a.text);

// Статьи: сначала по темам, которые человек отметил; внутри — каждый день другая сверху
export function articlePool(s, child, t = now(), { topic, self } = {}) {
  const opened = seg(s).opened || {};
  let list;
  if (self) list = ARTICLES.filter((a) => a.bucket === 'self');
  else {
    const months = child && !child.expecting ? ageMonths(child, t) : -3;
    const stage = !child ? (s.stage === 'planning' ? 'planning' : 'born') : child.expecting ? 'expecting' : 'born';
    // Статьи «для себя» — своей карточкой «Для себя», здесь — про ребёнка и этап
    list = articlesFor({ months, stage, topics: s.topics || [] }).filter((a) => a.bucket !== 'self');
  }
  if (topic) list = list.filter((a) => a.topics.includes(topic));
  list = list.filter((a) => !opened[a.id] && !isDismissed(s, 'article:' + a.id));
  const score = (a) => a.topics.filter((x) => (s.topics || []).includes(x)).length;
  const groups = [];
  for (const a of list) { const g = groups.find((x) => x.k === score(a)); if (g) g.items.push(a); else groups.push({ k: score(a), items: [a] }); }
  groups.sort((x, y) => y.k - x.k);
  const r = hash('s' + dayKey(t));
  return groups.flatMap((g) => { const k = r % g.items.length; return [...g.items.slice(k), ...g.items.slice(0, k)]; });
}
// «Сегодня в НЭН» — свежие материалы для всех родителей: три в день по кругу
export function nenToday(s, t = now(), count = 3) {
  const opened = seg(s).opened || {};
  const list = ARTICLES.filter((a) => (a.fromM === -3 || (s.stage === 'planning' && a.fromM === -2)) && !opened[a.id]);
  if (!list.length) return [];
  const start = (hash('n' + dayKey(t)) % list.length);
  return Array.from({ length: Math.min(count, list.length) }, (_, i) => list[(start + i) % list.length]);
}

// ——— Новое в возрасте: неделю после перехода на новый лист ———
const SHEET_WORD = { 2: 'двух месяцев', 4: 'четырёх месяцев', 6: 'шести месяцев', 9: 'девяти месяцев', 12: 'года', 15: 'пятнадцати месяцев', 18: 'полутора лет', 24: 'двух лет', 30: 'двух с половиной лет', 36: 'трёх лет', 48: 'четырёх лет', 60: 'пяти лет' };
export function newInAge(s, child, t = now()) {
  if (!child || child.expecting) return [];
  const base = stageDob(child, t);
  const fresh = (m) => { const at = addMonths(base, m); return t >= at && t - at < 7 * DAY; };
  const out = [];
  for (const [key, sheet] of Object.entries(CDC)) {
    if (!fresh(sheet.m)) continue;
    const dom = sheet.domains.find((d) => d.key === 'language') || sheet.domains[0];
    const item = dom && dom.items[0];
    out.push({
      key: 'age:' + key, kind: 'cdc', label: 'Новое в возрасте',
      title: `Ориентиры ${SHEET_WORD[sheet.m] || ''}`.trim(),
      short: item ? `Ориентир ${SHEET_WORD[sheet.m]}: ${lowerFirst(item.ru.split(':')[0])}` : `Ориентиры ${SHEET_WORD[sheet.m]}`,
      text: item ? `Например: «${item.ru}». В «Развитии» можно отметить, что уже видели.` : 'В «Развитии» можно отметить, что уже видели.',
      action: 'Все ориентиры', path: ROUTES.development,
    });
  }
  if (fresh(4)) out.push({ key: 'age:solids', kind: 'solids', label: 'Новое в возрасте', title: 'В «Другой записи» появился прикорм', short: 'В «Другой записи» появился прикорм', text: 'Когда начнёте, первые продукты можно записывать там же — они попадут в дневник.', action: 'Записать прикорм' });
  if (fresh(12)) out.push({ key: 'age:potty', kind: 'potty', label: 'Новое в возрасте', title: 'С года — кнопка «Горшок»', short: 'С года — кнопка «Горшок»', text: 'Кнопки записи теперь — сон, еда и горшок. Подгузник — в «Другой записи».' });
  if (fresh(60)) out.push({ key: 'age:school', kind: 'school', label: 'Новое в возрасте', title: 'К школе', short: 'К школе: что важно знать заранее', text: 'В «Развитии» появилась страница «К школе».', action: 'К школе', path: ROUTES.development });
  return out.filter((x) => !isDismissed(s, x.key));
}

// ——— Прививки и осмотры ———
const SHORT = { hepb: 'гепатита B', tb: 'туберкулёза', pcv: 'пневмококка', dtp: 'дифтерии, коклюша и столбняка', polio: 'полиомиелита', hib: 'гемофильной инфекции', mmr: 'кори, краснухи и паротита', dt: 'дифтерии и столбняка', flu: 'гриппа' };
const DOSE = { 'первая вакцинация': 'Прививка', 'вакцинация': 'Прививка', 'вторая вакцинация': 'Вторая прививка', 'третья вакцинация': 'Третья прививка', 'ревакцинация': 'Ревакцинация', 'первая ревакцинация': 'Ревакцинация', 'вторая ревакцинация': 'Вторая ревакцинация', 'третья ревакцинация': 'Третья ревакцинация', 'вакцинация, каждый сезон': 'Прививка' };
export const vaccineName = (it) => `${DOSE[it.dose] || 'Прививка'} от ${SHORT[it.disease] || VACCINES.diseases[it.disease] || ''}`;
const inAge = (txt) => (/^(в|на|с)\s/.test(txt) ? txt : 'в ' + txt);
export function diseasesOf(items) {
  const list = [...new Set(items.map((it) => SHORT[it.disease] || VACCINES.diseases[it.disease]))];
  return list.length > 1 ? list.slice(0, -1).join(', ') + ' и ' + list[list.length - 1] : list[0];
}

// Отметка прививки: { status: 'planned'|'done', at, when, childIds } — childIds, чтобы не путать детей
export function markFor(s, id, childId) {
  const m = (s.vaccineMarks || {})[id];
  if (!m) return null;
  if (m.childIds && childId && !m.childIds.includes(childId)) return null;
  return m;
}
function groupTitle(items) {
  if (items.length === 1) return vaccineName(items[0]);
  return `Прививки ${inAge(items[0].ageText)}`;
}
// Срок прививки от даты рождения. Свой расчёт вместо vaccineDate: там «4,5 месяца» округляются до 4
export function vaccineDue(it, dob) {
  if (it.ageDays) return startOfDay(dob + it.ageDays[0] * DAY);
  const whole = Math.floor(it.age);
  return startOfDay(addMonths(dob, whole) + Math.round((it.age - whole) * 30.44) * DAY);
}
// Ближайшая прививка по календарю без отметки: от 45 дней назад до 14 вперёд. Грипп — только если записались.
export function calendarVaccine(s, child, t = now()) {
  if (!child || child.expecting) return null;
  const sod = startOfDay(t);
  const list = VACCINES.items
    .filter((it) => !it.riskGroup && it.disease !== 'flu' && !it.ageDays) // первые — в роддоме
    .map((it) => ({ ...it, due: vaccineDue(it, child.dob) }))
    .filter((it) => !markFor(s, it.id, child.id) && it.due >= sod - 45 * DAY && it.due <= sod + 14 * DAY)
    .sort((a, b) => a.due - b.due);
  if (!list.length) return null;
  const items = list.filter((it) => it.due === list[0].due);
  const due = list[0].due;
  // Прошёл срок или он дальше недели — словами возраста; на этой неделе — днём
  const when = due <= sod || due >= sod + 7 * DAY ? inAge(items[0].ageText) : `${lowerFirst(weekdayLong(due))}, ${dateLong(due)}`;
  return {
    key: 'vac:' + items.map((x) => x.id).join('+'), ids: items.map((x) => x.id), items, due,
    title: groupTitle(items),
    sub: `По календарю${isPreterm(child) ? ' от даты рождения' : ''} — ${when}. Записаться и отметить`,
    ageText: inAge(items[0].ageText),
  };
}
// Прививки, на которые записались
export function plannedVaccines(s, childIds) {
  const groups = {};
  for (const [id, m] of Object.entries(s.vaccineMarks || {})) {
    if (!m || m.status !== 'planned' || !m.when) continue;
    if (m.childIds && !m.childIds.some((c) => childIds.includes(c))) continue;
    const it = VACCINES.items.find((x) => x.id === id);
    if (!it) continue;
    (groups[m.when] = groups[m.when] || []).push(it);
  }
  return Object.entries(groups).map(([when, items]) => ({
    key: 'vplan:' + items.map((x) => x.id).join('+'), ids: items.map((x) => x.id), items, when: +when,
    title: groupTitle(items), kind: 'vaccine', time: true,
  }));
}

// Осмотры по графику: педиатр каждый месяц первого года, невролог в 3, 6 и 7 лет
export function calendarCheckup(s, child, t = now()) {
  if (!child || child.expecting) return null;
  const sod = startOfDay(t);
  // Отметки осмотров — общие с «Ребёнок → Здоровье»: s.rebyonok.checkups[id ребёнка][возраст в месяцах]
  const marks = { ...(seg(s).checkups || {}) };
  for (const [age, at] of Object.entries((((s.rebyonok || {}).checkups || {})[child.id]) || {})) if (at) marks['m' + age] = at;
  const ages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 36, 72, 84];
  for (const m of ages) {
    const d = startOfDay(addMonths(child.dob, m));
    if (d < sod - 3 * DAY || d > sod + 7 * DAY) continue;
    const key = 'm' + m;
    if (marks[key]) continue;
    if ((s.tasks || []).some((x) => x.checkup === key && x.childId === child.id)) continue;
    const first = m <= 12;
    const ageW = m < 12 ? pl(m, 'месяц', 'месяца', 'месяцев') : m === 12 ? '12 месяцев' : pl(m / 12, 'год', 'года', 'лет');
    return {
      key: 'chk:' + key, checkup: key, due: d,
      title: first ? 'Осмотр у педиатра' : 'Осмотр у невролога',
      sub: `По графику — в ${ageW}${m === 3 || m === 12 ? ', вместе с неврологом' : ''}. Записаться и отметить`,
    };
  }
  return null;
}

// ——— Дела ———
export function whenLine(when, time, t = now()) {
  const sod = startOfDay(t), d = startOfDay(when);
  const rel = d === sod ? 'Сегодня' : d === sod + DAY ? 'Завтра' : d === sod - DAY ? 'Вчера' : null;
  if (!time) return rel || dateWithWeekday(when);
  return rel ? `${rel} в ${hhmm(when)}` : `${dateWithWeekday(when)}, ${hhmm(when)}`;
}
export const isVisit = (x) => x.kind === 'doctor' || x.kind === 'vaccine' || x.kind === 'tests';
export const tasksOf = (s, childIds) => (s.tasks || []).filter((x) => childIds.includes(x.childId));

// План дня из записей семи прошлых дней: прогулка и дневной сон с года
export function dayPlan(s, child, t = now()) {
  if (!child || child.expecting || ageMonths(child, t) < 12) return [];
  const sod = startOfDay(t);
  const recs = recordsOf(child.id, s);
  const out = [];
  const typical = (pick) => {
    const byDay = {};
    for (const r of recs) if (r.start >= sod - 7 * DAY && r.start < sod && pick(r)) { const k = dayKey(r.start); if (!(k in byDay)) byDay[k] = (r.start - startOfDay(r.start)) / 60000; }
    const mins = Object.values(byDay).sort((a, b) => a - b);
    if (mins.length < 3) return null;
    return Math.round(mins[Math.floor(mins.length / 2)] / 30) * 30;
  };
  const doneToday = (pick) => recs.some((r) => r.start >= sod && pick(r));
  const walk = (r) => r.type === 'walk';
  const nap = (r) => { const h = new Date(r.start).getHours(); return r.type === 'sleep' && h >= 10 && h < 17 && (r.end == null || r.end - r.start >= 20 * 60000); };
  for (const [title, pick] of [['Прогулка', walk], ['Дневной сон', nap]]) {
    const m = typical(pick);
    if (m == null || doneToday(pick)) continue;
    const when = sod + m * 60000;
    if (when < t - H) continue;
    out.push({ key: 'plan:' + title, title, when, time: true, kind: 'plan' });
  }
  return out;
}

// Срочное: прививка или визит, на которые записаны, — сегодня и в ближайшие два дня
export function urgentItem(s, childIds, t = now()) {
  const sod = startOfDay(t);
  const inWindow = (w) => w >= sod && w < sod + 3 * DAY;
  const list = [
    ...plannedVaccines(s, childIds).filter((v) => inWindow(v.when)),
    ...tasksOf(s, childIds).filter((x) => isVisit(x) && !x.done && inWindow(x.when)).map((x) => ({ ...x, key: 'task:' + x.id, task: x })),
  ].filter((x) => !isDismissed(s, 'urgent:' + x.key + ':' + dayKey(t)));
  list.sort((a, b) => a.when - b.when);
  return list[0] || null;
}

// ——— Неделя: вчера, сегодня и пять дней вперёд ———
export function weekDays(s, childIds, t = now()) {
  const sod = startOfDay(t);
  const child = s.children.find((c) => c.id === childIds[0]);
  const plans = [
    ...tasksOf(s, childIds).map((x) => x.when),
    ...plannedVaccines(s, childIds).map((v) => v.when),
  ];
  const cv = child ? calendarVaccine(s, child, t) : null;
  if (cv && cv.due >= sod) plans.push(cv.due);
  const ck = child ? calendarCheckup(s, child, t) : null;
  if (ck && ck.due >= sod) plans.push(ck.due);
  if (child && dayPlan(s, child, t).length) plans.push(sod);
  return Array.from({ length: 7 }, (_, i) => {
    const d = sod + (i - 1) * DAY;
    return { t: d, today: i === 1, rec: childIds.some((id) => hasRecords(id, d)), plan: plans.some((w) => w >= d && w < d + DAY) };
  });
}

// ——— Ждём малыша ———
export function expectingWeek(child, t = now()) { return pregnancyWeek(child.due, t); }
export function weekArticle(s, child, t = now()) {
  const list = ARTICLES.filter((a) => a.fromM === -1);
  if (!list.length) return null;
  return list[expectingWeek(child, t) % list.length];
}

// ——— Эфир Клуба: показательный, только с флагом «В Клубе» ———
export function nextClubLive(t = now()) {
  const d = new Date(t);
  const add = (4 - d.getDay() + 7) % 7;
  const at = new Date(startOfDay(t) + add * DAY); at.setHours(19, 0, 0, 0);
  if (at.getTime() < t) at.setTime(at.getTime() + 7 * DAY);
  return at.getTime();
}

// ——— Колокольчик «Что нового» ———
export function newsItems(s = getState(), t = now()) {
  const child = activeChild(s);
  const sod = startOfDay(t);
  const day = dayKey(t);
  const items = [];
  const add = (group, key, title, sub, path) => items.push({ group, key, title, sub, path });
  const ids = child ? (s.bothTwins && child.twinOf ? [child.id, child.twinOf] : [child.id]) : [];
  // Сработавшие напоминания: визиты и прививки — накануне, свои дела — когда пришло время
  for (const v of plannedVaccines(s, ids)) if (startOfDay(v.when) === sod + DAY) add('today', 'rem:' + v.key + ':' + day, `Завтра — ${lowerFirst(v.title)}`, whenLine(v.when, true, t), ROUTES.health);
  for (const x of tasksOf(s, ids)) {
    if (x.done) continue;
    if (isVisit(x) && startOfDay(x.when) === sod + DAY) add('today', 'rem:' + x.id + ':' + day, `Завтра — ${lowerFirst(x.title)}`, whenLine(x.when, x.time, t), ROUTES.day(x.when));
    if (x.time && startOfDay(x.when) === sod && x.when <= t) add('today', 'due:' + x.id, x.title, `Сегодня в ${hhmm(x.when)}`, ROUTES.day(x.when));
  }
  if (child && !child.expecting) {
    const cv = calendarVaccine(s, child, t);
    if (cv && cv.due <= sod + 7 * DAY) add('today', 'vac:' + cv.ids.join('+'), 'Пора записаться на прививку', `От ${diseasesOf(cv.items)} — по календарю ${cv.ageText}`, ROUTES.health);
    const f = factsOfDay(s, child, t)[0];
    if (f) add('today', 'fact:' + day, 'Нет, это нормально', splitFact(f.text)[0], '/fakt/' + f.id);
    const a = activityPick(s, child, t);
    if (a && ageMonths(child, t) >= 12) add('today', 'act:' + day, 'Занятие на сегодня', activityTitle(a), ROUTES.activity(a.id));
    const wl = weekLines(ageDays(child, t));
    if (wl.length) {
      const d = ageDays(child, t);
      const wk = Math.floor(d / 7) + 1;
      const title = wk <= 52 ? `Что нового на ${wk}-й неделе` : `Что нового в ${ageAt(stageDob(child, t), t)}`;
      add('week', 'wk:' + (wk <= 52 ? wk : 'm' + Math.floor(d / 30.44)), title, wl[0], ROUTES.development);
    }
    for (const n of newInAge(s, child, t)) if (n.kind === 'cdc') add('week', n.key, n.title, 'Что обычно появляется к этому возрасту', ROUTES.development);
  }
  if (child && child.expecting) {
    const w = expectingWeek(child, t);
    const a = weekArticle(s, child, t);
    if (a) add('week', 'preg:' + w, `Ваша неделя — ${w}-я`, a.title, ROUTES.article(a.id));
  }
  const nen = nenToday(s, t, 1)[0];
  if (nen) add('today', 'nen:' + day, 'Сегодня в НЭН', nen.title, ROUTES.article(nen.id));
  if (s.demo && s.demo.club) { const live = nextClubLive(t); add('week', 'club:' + dayKey(live), 'Эфир Клуба', `${dateWithWeekday(live)}, 19:00 · для участников Клуба НЭН`, ROUTES.club); }
  if (s.demo && s.demo.course) add('week', 'course:' + dayKey(sod - ((new Date(t).getDay() + 6) % 7) * DAY), 'Новый урок курса', 'Урок этой недели уже открыт', ROUTES.course);
  return items;
}
export function hasNews(s = getState(), t = now()) {
  const seen = new Set((s.seen && s.seen.news) || []);
  return newsItems(s, t).some((i) => !seen.has(i.key));
}

export const partNow = (t = now()) => partOfDay(t);
