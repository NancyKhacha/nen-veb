// «Мой НЭН»: общее для экранов вкладки — состояние, возраст, имена, эфир, курс, подборки статей.
import { html, useState, useEffect } from '../../lib.js';
import { getState, update, activeChild, bornChildren, now } from '../../store.js';
import { diffYMD, ageMonths, isPreterm, correctedDob, dayKey, dateLong, pl, weekdayLong, startOfDay, DAY } from '../../age.js';
import { ARTICLES, articlesFor, freshFor } from '../../content/articles.js';
import { ideaOfDay } from '../../content/moy-nen-kuhnya.js';
import { Header, Row } from '../../ui.js';
import { go, back } from '../../router.js';
import { track } from '../../stats.js';

// ——— Своё состояние: s.moyNen ———
export const mn = (s = getState()) => s.moyNen || {};
export function setMN(fn) { update((d) => { d.moyNen = d.moyNen || {}; fn(d.moyNen, d); }); }

// ——— Сеть: настоящая или «Без сети» из «Для исследования» ———
export function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const f = () => setOn(navigator.onLine);
    window.addEventListener('online', f); window.addEventListener('offline', f);
    return () => { window.removeEventListener('online', f); window.removeEventListener('offline', f); };
  }, []);
  return on;
}
export function useOffline(s, query = {}) {
  const on = useOnline();
  return !on || !!(s.demo && s.demo.offline) || query.sostoyanie === 'bez-seti' || query.sostoyanie === 'pervyy-zapusk';
}

// ——— Аккаунт, курс, Клуб: в веб-версии вход выключен, всё это — для примера ———
// Флаги s.demo.course / s.demo.club включаются в «Профиль → Для исследования».
export function access(s, query = {}) {
  const guest = query.sostoyanie === 'bez-akkaunta';
  const course = !guest && !!(s.demo && s.demo.course);
  const paid = !guest && !!(s.demo && s.demo.club);
  const free = !guest && !paid && !!mn(s).freeClub;
  return { course, club: paid ? 'paid' : free ? 'free' : null, loggedIn: course || paid || free };
}

// ——— Имена: «Мише сейчас», «по возрасту Миши» ———
const IRR_GEN = { 'Лев': 'Льва', 'Павел': 'Павла', 'Пётр': 'Петра', 'Петр': 'Петра' };
const IRR_DAT = { 'Лев': 'Льву', 'Павел': 'Павлу', 'Пётр': 'Петру', 'Петр': 'Петру' };
const ok = (n) => n && /^[А-ЯЁ][а-яё]+$/.test(n);
export function gen(n) {
  if (!ok(n)) return null;
  if (IRR_GEN[n]) return IRR_GEN[n];
  if (/ия$/.test(n)) return n.slice(0, -1) + 'и';
  if (/[гкхжшчщ]а$/.test(n)) return n.slice(0, -1) + 'и';
  if (/а$/.test(n)) return n.slice(0, -1) + 'ы';
  if (/я$/.test(n)) return n.slice(0, -1) + 'и';
  if (/[йь]$/.test(n)) return n.slice(0, -1) + 'я';
  if (/[бвгджзклмнпрстфхцчшщ]$/.test(n)) return n + 'а';
  return null;
}
export function dat(n) {
  if (!ok(n)) return null;
  if (IRR_DAT[n]) return IRR_DAT[n];
  if (/ия$/.test(n)) return n.slice(0, -1) + 'и';
  if (/[ая]$/.test(n)) return n.slice(0, -1) + 'е';
  if (/[йь]$/.test(n)) return n.slice(0, -1) + 'ю';
  if (/[бвгджзклмнпрстфхцчшщ]$/.test(n)) return n + 'у';
  return null;
}
export const childName = (c) => (c && c.name) || 'Малыш';

// ——— Возраст ———
// Статьи — по фактическому возрасту, как в приложении; курс — по исправленному до двух лет.
export const realMonths = (c, t = now()) => (c && !c.expecting ? Math.max(0, diffYMD(c.dob, t).months) : -1);
export function ageShort(c, t = now()) {
  const { months: m, totalDays } = diffYMD(c.dob, t);
  if (m < 1) return totalDays < 14 ? pl(Math.max(totalDays, 0), 'день', 'дня', 'дней') : pl(Math.floor(totalDays / 7), 'неделя', 'недели', 'недель');
  if (m < 12) return pl(m, 'месяц', 'месяца', 'месяцев');
  const y = Math.floor(m / 12), r = m % 12;
  if (y < 3 && r) return `${pl(y, 'год', 'года', 'лет')} ${pl(r, 'месяц', 'месяца', 'месяцев')}`;
  return pl(y, 'год', 'года', 'лет');
}
// Подпись подборки: «0–6 месяцев», «1–2 лет»
export function ageBand(m) {
  if (m < 7) return '0–6 месяцев';
  if (m < 12) return '7–12 месяцев';
  if (m < 24) return '1–2 лет';
  if (m < 36) return '2–3 лет';
  if (m < 84) return '3–6 лет';
  return '7–10 лет';
}

// ——— Статьи ———
const dayNo = (t) => Math.round(startOfDay(t) / DAY);
const byDate = (a, b) => (a.date < b.date ? 1 : -1);
// Для кого подборка: выбранный в шапке ребёнок или этап семьи
export function readingFor(s, t = now()) {
  const c = activeChild(s);
  if (c && !c.expecting) {
    const m = realMonths(c, t);
    const list = ARTICLES.filter((a) => a.fromM >= 0 && m >= a.fromM && m <= a.toM).sort(byDate);
    const name = childName(c);
    return { list, band: ageBand(m), forWhom: `Для ${gen(name) || name}, ${ageShort(c, t)}`, more: `Ещё для ${ageBand(m)}` };
  }
  const stage = c && c.expecting ? 'expecting' : s.stage === 'planning' ? 'planning' : 'expecting';
  // сначала — для этого этапа, потом — для всех родителей
  const all = articlesFor({ stage });
  const list = [...all.filter((a) => a.fromM !== -3).sort(byDate), ...all.filter((a) => a.fromM === -3).sort(byDate)];
  const who = stage === 'planning' ? 'тех, кто планирует малыша' : 'тех, кто ждёт малыша';
  return { list, band: null, forWhom: `Для ${who}`, more: `Ещё для ${who}` };
}
// Сверху каждый день — другая статья подборки, по кругу
export function todays(list, t = now(), n = 3) {
  if (!list.length) return [];
  const k = dayNo(t) % list.length;
  return Array.from({ length: Math.min(n, list.length) }, (_, i) => list[(k + i) % list.length]);
}
export const freshToday = (t = now()) => freshFor(dayKey(t), 2);
export const ideaToday = (t = now()) => ideaOfDay(dayKey(t));

// Строка статьи, как в Фигме: заголовок и подзаголовок из второй половины названия
const cap1 = (x) => x.charAt(0).toUpperCase() + x.slice(1);
export function splitTitle(title) {
  const balanced = (x) => (x.match(/«/g) || []).length === (x.match(/»/g) || []).length && (x.match(/\(/g) || []).length === (x.match(/\)/g) || []).length;
  const pats = [/^(.{12,}?[?!.…]») (.{8,})$/, /^(.{12,}?)\s+(\([^)]+\))$/, /^(.{12,}?): (.{8,})$/, /^(.{12,}?[^.]{3})\. (.{8,})$/, /^(.{12,}?[?!]+) (.{8,})$/, /^(.{12,}?) — ([^—]{6,})$/];
  for (const re of pats) {
    const m = re.exec(title);
    if (m && balanced(m[1])) return [m[1], m[2].startsWith('(') ? m[2] : cap1(m[2])];
  }
  return [title, ''];
}
export function openArticle(a, from) { track('мой-нэн:' + from); go('/statya/' + a.id); }
export function ArticleRow({ a, from = 'статья', sub, full }) {
  const [t, st] = full ? [a.title, ''] : splitTitle(a.title);
  return html`<${Row} title=${t} sub=${sub || st} onClick=${() => openArticle(a, from)} />`;
}
export const savedItem = (a) => ({ kind: 'article', id: a.id, title: a.title, sub: '', route: '/statya/' + a.id, url: a.url, lead: a.lead });

// ——— Эфир Клуба (показательный): ближайший четверг, 19:00 ———
export const EFIR = { title: 'Сон в первые месяцы: вопросы сомнологу', hour: 19 };
export const RECORDS = [
  { title: 'Прикорм без паники: вопросы педиатру', sub: 'Запись · 0–1 год' },
  { title: 'Когда малыш не спит днём', sub: 'Запись · 0–1 год' },
];
export function nextEfir(t = now()) {
  const d = new Date(t);
  d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7));
  d.setHours(EFIR.hour, 0, 0, 0);
  if (d.getTime() + 60 * 60000 < t) d.setDate(d.getDate() + 7);
  return d.getTime();
}
const isToday = (x, t) => startOfDay(x) === startOfDay(t);
export const efirWhen = (at, t = now()) => (isToday(at, t) ? `сегодня, ${EFIR.hour}:00` : `${weekdayLong(at).toLowerCase()}, ${dateLong(at)}, ${EFIR.hour}:00`);
const ACC = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу'];
export const efirDayAcc = (at, t = now()) => (isToday(at, t) ? 'сегодня' : ACC[new Date(at).getDay()]);
// Подходит по возрасту: кто-то из детей до года — сверка на телефоне, по фактическому возрасту
export function efirFits(s, t = now()) {
  const c = bornChildren(s).find((x) => realMonths(x, t) < 12);
  if (!c) return null;
  const n = gen(childName(c));
  return n ? `Подходит по возрасту ${n}.` : 'Подходит по возрасту ребёнка.';
}

// ——— Курсы Школы ———
export const FIRSTYEAR = Array.from({ length: 12 }, (_, i) => ({
  n: i + 1,
  title: i === 0 ? 'Ребёнок от рождения до 2 месяцев, часть 1' : i === 1 ? 'Ребёнок от рождения до 2 месяцев, часть 2' : `${i}–${i + 1} месяц ребёнка`,
}));
export const PERESTAN = {
  title: 'Вместо «Перестань немедленно»',
  sub: 'Десять разборов: от истерик до «нет» на всё',
  known: ['Кричит, плачет, падает на пол', 'Не может остановиться и переключиться', 'На всё отвечает «нет»'],
  url: 'https://n-e-n.ru/perestan/',
};
export const FIRSTYEAR_URL = 'https://n-e-n.ru/firstyear/';
// Урок этого месяца — по исправленному возрасту до двух лет, как «Развитие»
export const lessonFor = (m) => (m < 1 ? 1 : m === 1 ? 2 : Math.min(12, m + 1));
// Ребёнок первого года: выбранный в шапке, если подходит, иначе любой до года
export function firstYearChild(s, t = now()) {
  const kids = bornChildren(s);
  const a = activeChild(s);
  const fits = (c) => c && !c.expecting && ageMonths(c, t) < 12;
  return fits(a) ? a : kids.find(fits) || null;
}
export function courseFor(s, t = now()) {
  const c = firstYearChild(s, t);
  if (c) {
    const m = ageMonths(c, t);
    const n = lessonFor(m);
    const base = isPreterm(c) && diffYMD(c.dob, t).months < 24 ? correctedDob(c) : c.dob;
    // следующий урок встаёт первым, когда ребёнку исполнится следующий месяц
    const nextAt = n < 12 ? (() => { const d = new Date(base); d.setMonth(d.getMonth() + m + 1); return d.getTime(); })() : null;
    return { code: 'firstyear', child: c, lesson: n, nextAt, nextAge: m + 1 };
  }
  const a = activeChild(s);
  const older = [a, ...bornChildren(s)].find((x) => x && !x.expecting && realMonths(x, t) >= 12 && realMonths(x, t) < 84);
  return older ? { code: 'perestan', child: older } : null;
}
// Пройденные уроки: для примера пройдены все до урока этого месяца, как на экране 5
export function passedLessons(s, course) {
  const st = mn(s).lessons;
  if (st) return st;
  const out = {};
  for (let i = 1; i < (course ? course.lesson : 1); i++) out[i] = 1;
  return out;
}
export const passedCount = (p) => Object.keys(p).length;

// ——— Детали экрана ———
// Внутренний экран: шапка, «Назад» и название раздела крупно
export function Inner({ title, eyebrow }) {
  return html`
    <${Header} />
    <div class="mn-back"><button onClick=${() => back('/moy-nen')}>‹ Назад</button></div>
    ${eyebrow && html`<div class="sec-title mn-kicker">${eyebrow}</div>`}
    ${title && html`<h1 class="h1">${title}</h1>`}`;
}
// Ссылка на сайт: открывается в браузере; без сети — бледная
export function openSite(url, what) {
  track('мой-нэн:сайт-' + what);
  window.open(url, '_blank', 'noopener');
}
// Полоса записи — как на «Сегодня»: с трёх лет на этой вкладке её нет
export function stripHere() {
  const c = activeChild(getState());
  return !c || c.expecting || realMonths(c) < 36;
}
