// Записи дневника: сон и кормление грудью идут таймером, остальное — одним касанием.
import { getState, update, uid, now } from './store.js?v=23';
import { DAY, startOfDay, dur, durShort, ageMonths, hhmm, relDay, pl } from './age.js?v=23';

export const TYPES = {
  sleep: { label: 'Сон', timer: true },
  feed: { label: 'Кормление' },
  diaper: { label: 'Подгузник' },
  food: { label: 'Еда' },
  potty: { label: 'Горшок' },
  pump: { label: 'Сцеживание' },
  solids: { label: 'Прикорм' },
  measure: { label: 'Замер' },
  med: { label: 'Лекарство' },
  temp: { label: 'Температура' },
  walk: { label: 'Прогулка', timer: true },
  bath: { label: 'Купание' },
};

export const SIDE = { left: 'левая', right: 'правая' };
export const DIAPER = { wet: 'мокрый', dirty: 'грязный', both: 'мокрый и грязный' };
export const POTTY = { ok: 'получилось', miss: 'мимо', sat: 'посидели' };

export const recordsOf = (childId, s = getState()) => s.records.filter((r) => r.childId === childId);
export const ongoing = (childId, s = getState()) => recordsOf(childId, s).filter((r) => r.end == null);
export const ongoingAll = (s = getState()) => s.records.filter((r) => r.end == null);

export function lastOf(childId, type, s = getState()) {
  let best = null;
  for (const r of s.records) if (r.childId === childId && r.type === type && (!best || r.start > best.start)) best = r;
  return best;
}

// Добавить запись; вернёт её id
export function addRecord(childIds, type, data = {}, { start, end, timer } = {}) {
  const t = now();
  const ids = [];
  update((s) => {
    for (const childId of [].concat(childIds)) {
      // У ребёнка не может идти два сна сразу
      if (timer) s.records.filter((r) => r.childId === childId && r.type === type && r.end == null).forEach((r) => { r.end = t; });
      const id = uid();
      ids.push(id);
      s.records.push({ id, childId, type, start: start ?? t, end: timer ? null : (end ?? start ?? t), data, at: Date.now() });
    }
    if (type === 'feed' && data.method) s.settings.lastFeed = { ...(s.settings.lastFeed || {}), method: data.method, side: data.side, ...(data.ml ? { ml: data.ml } : {}), ...(data.milk ? { milk: data.milk } : {}) };
  });
  return ids;
}

export function finishRecord(id) {
  update((s) => { const r = s.records.find((x) => x.id === id); if (r && r.end == null) r.end = Math.max(now(), r.start + 60000); });
}
export function removeRecord(id) { update((s) => { s.records = s.records.filter((r) => r.id !== id); }); }
export function editRecord(id, fn) { update((s) => { const r = s.records.find((x) => x.id === id); if (r) fn(r); }); }

// Сменить грудь посреди кормления
export function switchSide(id) {
  editRecord(id, (r) => {
    const t = now();
    r.data.log = (r.data.log || [{ side: r.data.side, start: r.start }]);
    r.data.side = r.data.side === 'left' ? 'right' : 'left';
    r.data.log.push({ side: r.data.side, start: t });
  });
}

// Сколько у каждой груди: по отрезкам кормления (как segments в приложении)
export function sideTimes(r, t = now()) {
  const d = r.data || {};
  const log = d.log && d.log.length ? d.log : [{ side: d.side, start: r.start }];
  const out = { left: 0, right: 0 };
  log.forEach((x, i) => { const end = i + 1 < log.length ? log[i + 1].start : (r.end ?? t); if (x.side in out) out[x.side] += Math.max(0, end - x.start); });
  return out;
}
const MILK = { formula: 'смесь', expressed: 'сцеженное молоко' };
// «левая 8 мин, правая 5 мин» или «левая, 8 мин»
export function breastLine(r, t = now(), fmt = dur) {
  const st = sideTimes(r, t);
  const both = st.left >= 60000 && st.right >= 60000;
  if (both) return `левая ${fmt(st.left)}, правая ${fmt(st.right)}`;
  const side = st.right > st.left ? 'right' : st.left > 0 ? 'left' : (r.data || {}).side;
  const len = r.end != null && r.end > r.start ? fmt(r.end - r.start) : '';
  return `${SIDE[side] || ''}${len ? ', ' + len : ''}`;
}

// Подпись записи: «Бутылочка · 120 мл», «Грудь · левая · 14 мин»
export function describe(r, t = now()) {
  const d = r.data || {};
  const len = r.end != null && r.end > r.start ? dur(r.end - r.start) : '';
  switch (r.type) {
    case 'sleep': return r.end == null ? 'Сон · идёт' : `Сон · ${len}`;
    case 'feed': return d.method === 'bottle' ? `Бутылочка · ${d.ml || '—'} мл${d.milk ? ' · ' + MILK[d.milk] : d.what ? ' · ' + d.what : ''}` : `Грудь · ${breastLine(r, t)}`;
    case 'diaper': return `Подгузник · ${DIAPER[d.kind] || 'мокрый'}`;
    case 'potty': return `Горшок · ${POTTY[d.result] || 'получилось'}`;
    case 'food': return d.what ? `Еда · ${d.what}` : 'Еда';
    case 'pump': return `Сцеживание · ${d.ml || '—'} мл${d.side === 'both' ? ' · обе' : d.side ? ' · ' + SIDE[d.side] : ''}`;
    case 'solids': return `Прикорм · ${d.what || ''}${d.amount ? ', ' + d.amount : ''}`;
    case 'measure': return `Замер · ${[d.weight && d.weight + ' кг', d.height && d.height + ' см'].filter(Boolean).join(', ')}`;
    case 'med': return `Лекарство · ${d.name || ''}`;
    case 'temp': return `Температура · ${d.t || ''}°`;
    case 'walk': return r.end == null ? 'Прогулка · идёт' : `Прогулка · ${len}`;
    case 'bath': return 'Купание';
    default: return TYPES[r.type] ? TYPES[r.type].label : r.type;
  }
}
export const whenText = (r, t = now()) => `${relDay(r.start, t)} в ${hhmm(r.start)}`;

// Сколько прошло и подробность — подпись на кнопке записи
export function sinceLine(childId, type, t = now()) {
  const r = lastOf(childId, type);
  if (!r) return null;
  if (r.end == null) return { a: 'идёт', b: dur(t - r.start).replace(' мин', ' мин') };
  const ref = type === 'sleep' ? r.end : r.start;
  const ago = t - ref;
  const a = ago < 60000 ? 'только что' : (ago < DAY ? durShort(ago) : relDay(ref, t));
  const d = r.data || {};
  let b = '';
  if (type === 'sleep') b = 'не спит';
  else if (type === 'feed') b = d.method === 'bottle' ? `${d.ml || ''} мл` : (SIDE[d.side] || '');
  else if (type === 'diaper') b = DIAPER[d.kind] || 'мокрый';
  else if (type === 'potty') b = POTTY[d.result] || '';
  else if (type === 'food') b = d.what || '';
  return { a, b };
}

// Пересечение записи с отрезком времени
const overlap = (r, a, b, t) => Math.max(0, Math.min(r.end ?? t, b) - Math.max(r.start, a));

export function daySummary(childId, dayStart, t = now()) {
  const a = dayStart, b = dayStart + DAY;
  let sleep = 0, feeds = 0, diapers = 0, food = 0, potty = 0, any = 0;
  for (const r of getState().records) {
    if (r.childId !== childId) continue;
    if (r.type === 'sleep') { const o = overlap(r, a, b, t); if (o) { sleep += o; any++; } continue; }
    if (r.start < a || r.start >= b) continue;
    any++;
    if (r.type === 'feed') feeds++;
    else if (r.type === 'diaper') diapers++;
    else if (r.type === 'food' || r.type === 'solids') food++;
    else if (r.type === 'potty') potty++;
  }
  return { sleep, feeds, diapers, food, potty, any };
}

// «Сегодня: сон 6 ч 10 мин · 5 кормлений · 4 подгузника»
export function summaryLine(childId, child, dayStart, t = now(), prefix = 'Сегодня') {
  const s = daySummary(childId, dayStart, t);
  if (!s.any) return null;
  const m = ageMonths(child, t);
  const parts = [];
  if (s.sleep) parts.push(`сон ${dur(s.sleep)}`);
  if (m < 12) {
    if (s.feeds) parts.push(pl(s.feeds, 'кормление', 'кормления', 'кормлений'));
    if (s.diapers) parts.push(pl(s.diapers, 'подгузник', 'подгузника', 'подгузников'));
  } else {
    if (s.food) parts.push(`еда ${pl(s.food, 'раз', 'раза', 'раз')}`);
    if (s.feeds) parts.push(pl(s.feeds, 'кормление', 'кормления', 'кормлений'));
    if (s.potty) parts.push(`горшок ${pl(s.potty, 'раз', 'раза', 'раз')}`);
    if (s.diapers) parts.push(pl(s.diapers, 'подгузник', 'подгузника', 'подгузников'));
  }
  return parts.length ? `${prefix}: ${parts.join(' · ')}` : null;
}

// Ориентир сна по возрасту — ВОЗ и Американская академия медицины сна
export function sleepNorm(months) {
  if (months < 0) return null;
  if (months < 4) return [14, 17];
  if (months < 12) return [12, 16];
  if (months < 36) return [11, 14];
  if (months < 84) return [10, 13];
  return null;
}

// Сон за вчера — только если записан ночной сон, иначе сумма неполная
export function yesterdaySleep(childId, t = now()) {
  const y = startOfDay(t) - DAY;
  const nightA = y - 3 * 60 * 60 * 1000, nightB = y + 7 * 60 * 60 * 1000; // с 21:00 позавчера до 7:00 вчера
  const nightA2 = y + 21 * 60 * 60 * 1000, nightB2 = y + DAY + 7 * 60 * 60 * 1000;
  const recs = recordsOf(childId).filter((r) => r.type === 'sleep');
  const hasNight = recs.some((r) => overlap(r, nightA, nightB, t) > 60 * 60 * 1000 || overlap(r, nightA2, nightB2, t) > 60 * 60 * 1000);
  if (!hasNight) return null;
  const total = recs.reduce((acc, r) => acc + overlap(r, y, y + DAY, t), 0);
  return total || null;
}

// Есть ли записи в этот день — точка в неделе
export function hasRecords(childId, dayStart) {
  const b = dayStart + DAY;
  return getState().records.some((r) => r.childId === childId && r.start < b && (r.end ?? r.start) >= dayStart);
}

// Какие виды записи человек вёл последние 7 дней — для детей с трёх лет
export function recentTypes(childId, t = now()) {
  const from = t - 7 * DAY;
  return [...new Set(recordsOf(childId).filter((r) => r.start >= from).map((r) => r.type))];
}
