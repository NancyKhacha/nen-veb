// Даты, возраст и склонения — как пишет приложение: «2 месяца 7 дней», «Сейчас 21 день».

export const DAY = 24 * 60 * 60 * 1000;

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
export const pl = (n, one, few, many) => `${n} ${plural(n, one, few, many)}`;

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const WD_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
export const weekdayLong = (t) => WEEKDAYS[new Date(t).getDay()];
export const weekdayShort = (t) => WD_SHORT[new Date(t).getDay()];
export const dateLong = (t) => { const d = new Date(t); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`; };
export const dateWithWeekday = (t) => `${weekdayLong(t)}, ${dateLong(t)}`;
export const hhmm = (t) => { const d = new Date(t); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
export const ddmmyyyy = (t) => { const d = new Date(t); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`; };

export function parseDate(s) {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec((s || '').trim());
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  if (d.getMonth() !== +m[2] - 1) return null;
  return d.getTime();
}

// Маска ввода даты цифрами: 12102026 → 12.10.2026
export function maskDate(s) {
  const digits = s.replace(/\D/g, '').slice(0, 8);
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += '.' + digits.slice(2, 4);
  if (digits.length > 4) out += '.' + digits.slice(4);
  return out;
}

export function relDay(t, now = Date.now()) {
  const diff = Math.round((startOfDay(t) - startOfDay(now)) / DAY);
  if (diff === 0) return 'сегодня';
  if (diff === -1) return 'вчера';
  if (diff === 1) return 'завтра';
  return dateLong(t);
}

// Полные месяцы и дни между датами
export function diffYMD(from, to) {
  const a = new Date(from), b = new Date(to);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  let anchor = new Date(a); anchor.setMonth(a.getMonth() + months);
  if (anchor > b) { months -= 1; anchor = new Date(a); anchor.setMonth(a.getMonth() + months); }
  const days = Math.floor((startOfDay(b) - startOfDay(anchor)) / DAY);
  return { months, days, totalDays: Math.floor((startOfDay(b) - startOfDay(a)) / DAY) };
}

export function ageText(dob, now = Date.now()) {
  const { months, days, totalDays } = diffYMD(dob, now);
  if (totalDays < 0) return '';
  if (months < 1) return pl(totalDays, 'день', 'дня', 'дней');
  if (months < 12) return days ? `${pl(months, 'месяц', 'месяца', 'месяцев')} ${pl(days, 'день', 'дня', 'дней')}` : pl(months, 'месяц', 'месяца', 'месяцев');
  const y = Math.floor(months / 12), m = months % 12;
  if (y < 3) return m ? `${pl(y, 'год', 'года', 'лет')} ${pl(m, 'месяц', 'месяца', 'месяцев')}` : pl(y, 'год', 'года', 'лет');
  return pl(y, 'год', 'года', 'лет');
}

// Возраст для ориентиров — словами «в 2 месяца», «в 3 недели»
export function ageAt(dob, now = Date.now()) {
  const { months, totalDays } = diffYMD(dob, now);
  if (months < 1) { const w = Math.max(1, Math.floor(totalDays / 7)); return `${pl(w, 'неделю', 'недели', 'недель')}`; }
  if (months < 12) return pl(months, 'месяц', 'месяца', 'месяцев');
  const y = Math.floor(months / 12);
  if (y < 2) return months % 12 ? `${pl(months, 'месяц', 'месяца', 'месяцев')}` : 'год';
  return pl(y, 'год', 'года', 'лет');
}

// Исправленный возраст — у рождённых раньше 37 недель до двух лет
export function correctedDob(child) {
  const w = child && child.gestWeeks;
  if (!w || w >= 37) return child.dob;
  const shifted = child.dob + (40 - w) * 7 * DAY;
  return shifted;
}
export function isPreterm(child) { return !!(child && child.gestWeeks && child.gestWeeks < 37); }

// Возраст в месяцах для этапов и материалов
export function ageMonths(child, now = Date.now()) {
  if (!child || child.expecting) return -1;
  const useCorrected = isPreterm(child) && diffYMD(child.dob, now).months < 24;
  const base = useCorrected ? correctedDob(child) : child.dob;
  const { months, totalDays } = diffYMD(base, now);
  if (totalDays < 0) return 0;
  return months;
}
export function ageDays(child, now = Date.now()) {
  const useCorrected = isPreterm(child) && diffYMD(child.dob, now).months < 24;
  const base = useCorrected ? correctedDob(child) : child.dob;
  return Math.max(0, Math.floor((startOfDay(now) - startOfDay(base)) / DAY));
}

export function childAgeLine(child, now = Date.now()) {
  if (!child) return '';
  if (child.expecting) return expectingLine(child.due, now);
  const real = ageText(child.dob, now);
  if (isPreterm(child) && diffYMD(child.dob, now).months < 24) {
    const corr = correctedDob(child);
    const c = corr > now ? 'ещё до срока' : ageText(corr, now);
    return `${real} · исправленный ${c}`;
  }
  return real;
}

export function expectingLine(due, now = Date.now()) {
  const left = Math.round((startOfDay(due) - startOfDay(now)) / DAY);
  if (left < 0) return `Ждём с ${dateLong(due)}`;
  if (left === 0) return 'Ждём сегодня';
  return `Ждём к ${dateLong(due)} — примерно через ${pl(left, 'день', 'дня', 'дней')}`;
}
export function pregnancyWeek(due, now = Date.now()) {
  const left = (startOfDay(due) - startOfDay(now)) / DAY;
  return Math.max(1, Math.min(42, Math.floor(40 - left / 7)));
}

// Длительность: «1 ч 20 мин», «40 мин», «0:42» для таймера
export function dur(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60), mm = m % 60;
  if (!h) return `${mm} мин`;
  return mm ? `${h} ч ${String(mm).padStart(2, '0')} мин` : `${h} ч`;
}
export function durShort(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60), mm = m % 60;
  if (!h) return `${mm} мин`;
  return mm ? `${h} ч ${mm} мин` : `${h} ч`;
}
export function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
}

export function partOfDay(now = Date.now()) {
  const h = new Date(now).getHours();
  if (h >= 22 || h < 7) return 'night';
  if (h >= 19) return 'evening';
  return 'day';
}
