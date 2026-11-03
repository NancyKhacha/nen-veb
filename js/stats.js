// Замер для проверки: только обезличенный факт — в какой день открыли и что нажимали.
// Имена, даты, тексты записей и заметок сюда не попадают. Отчёт человек отправляет сам.

const KEY = 'nen-veb-stats';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; }
}
let st = load() || { code: makeCode(), first: Date.now(), days: {} };
function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* без замера тоже работаем */ } }
function makeCode() {
  const a = 'АБВГДЕЖКЛМНПРСТ';
  return Array.from({ length: 4 }, () => a[Math.floor(Math.random() * a.length)]).join('') + '-' + Math.floor(100 + Math.random() * 900);
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function day() {
  const k = today();
  if (!st.days[k]) st.days[k] = { opens: 0, ev: {}, hours: [] };
  return st.days[k];
}

// Открыли приложение (при запуске и при возвращении из фона)
export function trackOpen() {
  const d = day();
  d.opens += 1;
  const h = new Date().getHours();
  if (!d.hours.includes(h)) d.hours.push(h);
  save();
}

// Нажатие по функции: 'запись:сон', 'вкладка:ребёнок', 'статья:открыта'…
export function track(name) {
  const d = day();
  d.ev[name] = (d.ev[name] || 0) + 1;
  save();
}

export const statsCode = () => st.code;
export const statsData = () => st;
export function resetStats() { st = { code: makeCode(), first: Date.now(), days: {} }; save(); }

// Отчёт простым текстом — его копируют и присылают исследователю
export function statsReport() {
  const keys = Object.keys(st.days).sort();
  const lines = [`НЭН, веб-версия · участник ${st.code}`, `Дней с открытием: ${keys.length}`];
  for (const k of keys) {
    const d = st.days[k];
    const ev = Object.entries(d.ev).sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${c}`).join(', ');
    lines.push(`${k}: открыто ${d.opens} раз, часы ${d.hours.sort((a, b) => a - b).join(' ')}${ev ? ' · ' + ev : ''}`);
  }
  return lines.join('\n');
}
