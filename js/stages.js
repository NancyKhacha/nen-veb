// Этапы: что меняется в приложении с каждым годом ребёнка (журнал, 5 ноября).
// Одно место для правил — запись, плитки «Ребёнка», «Сегодня», вкладки кормления берут их отсюда.
// Возраст — полные месяцы по дате рождения; развитие по исправленному возрасту считает свой раздел.
// Подробно — до 7 лет (как в приложении: «для родителей детей 0–7 лет»); старше — школьный этап,
// без младенческих записей.
import { ageMonths } from './age.js?v=17';
import { now } from './store.js?v=17';

export const STAGES = [
  { key: 'newborn', from: 0, to: 3, title: 'Первые недели' },
  { key: 'infant', from: 3, to: 12, title: 'Первый год' },
  { key: 'year1', from: 12, to: 24, title: 'Второй год' },
  { key: 'year2', from: 24, to: 36, title: 'Третий год' },
  { key: 'age3', from: 36, to: 48, title: 'Три года' },
  { key: 'age4', from: 48, to: 60, title: 'Четыре года' },
  { key: 'age5', from: 60, to: 72, title: 'Пять лет' },
  { key: 'age6', from: 72, to: 84, title: 'Шесть лет' },
  { key: 'school', from: 84, to: 1e9, title: 'Школьник' },
];

export const monthsOf = (child, t = now()) => (child && !child.expecting && child.dob ? Math.max(0, ageMonths(child, t)) : null);
export function stageFor(child, t = now()) {
  const m = monthsOf(child, t);
  if (m == null) return null;
  return STAGES.find((x) => m >= x.from && m < x.to) || STAGES[STAGES.length - 1];
}

// Виды записи: с какого и до какого месяца они есть в «Записать» (to — не включая).
// Кормление грудью и из бутылочки — до трёх лет; подгузник — до четырёх (ночью бывает дольше двух);
// горшок — с года до четырёх; прикорм — с 4 месяцев до двух лет; еда — с года до трёх.
export const RECORD_AGES = {
  feed: [0, 36], pump: [0, 36], solids: [4, 24], food: [12, 36],
  diaper: [0, 48], potty: [12, 48], sleep: [0, 84], walk: [0, 48], bath: [0, 48],
  visit: [0, 1e9], measure: [0, 1e9], moment: [0, 1e9], temp: [0, 1e9], med: [0, 1e9],
  task: [0, 1e9], club: [24, 1e9],
};
export const recordAllowed = (type, m) => { const r = RECORD_AGES[type]; return !r || m == null || (m >= r[0] && m < r[1]); };

// Быстрые записи — «Записать» сверху и плитки «Сегодня» на «Ребёнке». С трёх лет их нет:
// сон, еду и горшок дошкольника почти никто не записывает — главное уже другое.
export function quickTypes(m) {
  if (m == null) return [];
  if (m < 12) return ['sleep', 'feed', 'diaper'];
  if (m < 24) return ['sleep', 'food', 'diaper'];
  if (m < 36) return ['sleep', 'food', 'potty'];
  return [];
}

// Разделы, которые появляются с возрастом: сад, кружки, школа, профосмотры, развитие, сказки
export const SECTION_AGES = {
  development: [0, 60],   // ориентиры CDC — до пяти лет
  toSchool: [60, 84],     // «К школе» — с пяти лет, как в приложении
  sad: [12, 72],          // детский сад: заботы — с года; к шести годам — уже про школу
  clubs: [24, 1e9],       // кружки и секции
  school: [66, 1e9],      // запись в школу — с 5,5 лет, потом — школа
  tales: [0, 96],         // сказки и колыбельные — до восьми лет
  firstYearDocs: [0, 12], // документы после рождения
};
export const sectionOn = (key, m) => { const r = SECTION_AGES[key]; return !!r && m != null && m >= r[0] && m < r[1]; };

// Первый класс: сколько месяцев будет ребёнку к ближайшему 1 сентября и что сейчас с записью
export function schoolSeason(child, t = now()) {
  const d = new Date(t);
  const sept = new Date(d.getMonth() >= 8 ? d.getFullYear() + 1 : d.getFullYear(), 8, 1).getTime();
  const atSept = monthsOf(child, sept);
  if (atSept == null || atSept < 78 || atSept >= 96) return null; // в 1 класс — с 6,5 до 8 лет
  const mo = d.getMonth();
  if (mo >= 3 && mo <= 5) return { title: 'Идёт запись в 1 класс', sub: 'До 30 июня — по прописке и для льготников' };
  if (mo >= 6 && mo <= 7) return { title: 'С 6 июля — запись на свободные места', sub: 'Для тех, кто не подал весной' };
  return { title: 'С 1 апреля — заявление в 1 класс', sub: 'Выбрать школу, собрать документы' };
}
