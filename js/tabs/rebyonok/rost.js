// «Ребёнок → Рост» (экраны 9, 10, 15): «График» замеров, замеры строками, лист «Новый замер» без клавиатуры.
// Полос ВОЗ нет — так принято 2 ноября, пока нет разрешённых данных.
import { html, useState } from '../../lib.js?v=17';
import { useStore, getState, now } from '../../store.js?v=17';
import { Header, Row, SecTitle, Pill, openSheet, closeSheet, toast } from '../../ui.js?v=17';
import { DAY, startOfDay, dayKey, dateLong } from '../../age.js?v=17';
import { addRecord, editRecord, removeRecord } from '../../records.js?v=17';
import { track } from '../../stats.js?v=17';
import { bornChild, nameOf, measures, measureLine, fmtNum, Seg , NotBorn } from './util.js?v=17';

const KINDS = { weight: { label: 'Вес', unit: 'кг', step: 0.1, digits: 2, base: [3, 6] }, height: { label: 'Рост', unit: 'см', step: 0.5, digits: 1, base: [48, 62] }, head: { label: 'Голова', unit: 'см', step: 0.5, digits: 1, base: [33, 41] } };
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const short = (t) => { const d = new Date(t); return `${d.getDate()} ${MON[d.getMonth()]}`; };

// «График», вид «Замеры»: точка — замер, линия между ними
export function Chart({ points, kind, from, to }) {
  const k = KINDS[kind];
  const W = 340, H = 150, L = 46, Rr = 12, T = 14, B = 26;
  let lo = k.base[0], hi = k.base[1];
  if (points.length) {
    const vs = points.map((p) => p.v);
    lo = Math.min(...vs); hi = Math.max(...vs);
    const pad = Math.max((hi - lo) * 0.2, kind === 'weight' ? 0.5 : 2);
    lo = Math.floor(lo - pad); hi = Math.ceil(hi + pad);
  }
  const span = Math.max(1, hi - lo);
  const step = span <= 4 ? 1 : span <= 10 ? 2 : span <= 25 ? 5 : 10;
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const x = (t) => L + ((t - from) / Math.max(DAY, to - from)) * (W - L - Rr);
  const y = (v) => T + (1 - (v - lo) / span) * (H - T - B);
  const xt = [from, from + (to - from) / 2, to];
  const pts = [...points].sort((a, b) => a.t - b.t);
  return html`
    <div class="rb-chart">
      <svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${`${k.label}: график замеров`}>
        ${ticks.map((v) => html`<g><line x1=${L} x2=${W - Rr} y1=${y(v)} y2=${y(v)} class="grid" /><text x="6" y=${y(v) + 4} class="lbl">${v} ${k.unit}</text></g>`)}
        ${xt.map((t, i) => html`<text x=${x(t)} y=${H - 6} class="lbl" text-anchor=${i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>${short(t)}</text>`)}
        ${pts.length > 1 && html`<polyline points=${pts.map((p) => `${x(p.t)},${y(p.v)}`).join(' ')} class="line" />`}
        ${pts.map((p) => html`<circle cx=${x(p.t)} cy=${y(p.v)} r="5" class="dot" />`)}
      </svg>
    </div>`;
}

export function Stepper({ value, step, unit, digits, onChange }) {
  const [typing, setTyping] = useState(value == null);
  if (typing || value == null) {
    return html`<input class="field rb-num" inputmode="decimal" placeholder=${`Сколько, ${unit}`} value=${value == null ? '' : fmtNum(value, digits)}
      onInput=${(e) => { const v = parseFloat(e.target.value.replace(',', '.')); onChange(isNaN(v) ? null : v); }} onBlur=${() => value != null && setTyping(false)} />`;
  }
  const f = (n) => String(n).replace('.', ',');
  return html`
    <div class="rb-stepper">
      <button class="pill" onClick=${() => onChange(Math.max(0, +(value - step).toFixed(2)))}>−${f(step)}</button>
      <button class="big-num" onClick=${() => setTyping(true)}>${unit === '°' ? value.toFixed(1).replace('.', ',') : fmtNum(value, digits)} ${unit}</button>
      <button class="pill" onClick=${() => onChange(+(value + step).toFixed(2))}>+${f(step)}</button>
    </div>`;
}

// Лист «Новый замер» (и «Поправить» для замера): прошлый подставлен, шаг ±0,1 кг и ±0,5 см
export function MeasureSheet({ childId, id }) {
  const s = getState();
  const child = s.children.find((c) => c.id === childId);
  const all = measures(child, s);
  const rec = id ? all.find((r) => r.id === id) : null;
  const last = rec || all[0];
  const num = (v) => (v == null || v === '' ? null : +v);
  const lastOf = (k) => { const r = rec ? rec : all.find((x) => x.data && x.data[k]); return r ? num(r.data[k]) : null; };
  const [w, setW] = useState(lastOf('weight'));
  const [h, setH] = useState(lastOf('height'));
  const [hd, setHd] = useState(lastOf('head'));
  const t = now();
  const [day, setDay] = useState(rec ? startOfDay(rec.start) : startOfDay(t));
  const [other, setOther] = useState(false);
  const save = () => {
    const data = { weight: w != null ? String(w) : '', height: h != null ? String(h) : '', head: hd != null ? String(hd) : '' };
    const when = day === startOfDay(t) ? t : day + 12 * 3600e3;
    if (rec) {
      editRecord(rec.id, (r) => { r.data = { ...r.data, ...data }; r.start = when; r.end = when; });
      closeSheet(); track('рост:поправить'); toast({ text: 'Замер поправили', ms: 2500 });
    } else {
      const made = addRecord(child.id, 'measure', data, { start: when, end: when });
      closeSheet(); track('рост:замер');
      toast({ text: 'Замер записан', actions: [{ label: 'Отменить', onClick: () => made.forEach(removeRecord) }] });
    }
  };
  return html`
    <div class="h2">${rec ? 'Поправить замер' : 'Новый замер'}</div>
    <div class="small">${nameOf(child)}${last && !rec ? ` · прошлый ${dateLong(last.start)}: ${measureLine(last, ' и ')}` : rec ? ` · ${dateLong(rec.start)}` : ' · первый замер'}</div>
    <div class="label">Когда</div>
    <div class="pills">
      ${[[startOfDay(t), 'Сегодня'], [startOfDay(t) - DAY, 'Вчера']].map(([d, l]) => html`<${Pill} on=${!other && day === d} onClick=${() => { setOther(false); setDay(d); }}>${l}<//>`)}
      ${other || (day < startOfDay(t) - DAY) ? html`<input class="pill" type="date" max=${dayKey(t)} value=${dayKey(day)} onChange=${(e) => { const [y, m, dd] = e.target.value.split('-').map(Number); if (y) setDay(new Date(y, m - 1, dd).getTime()); }} />`
        : html`<button class="pill" onClick=${() => setOther(true)}>Другой день</button>`}
    </div>
    <div class="label">Вес</div><${Stepper} value=${w} step=${0.1} unit="кг" digits=${2} onChange=${setW} />
    <div class="label">Рост</div><${Stepper} value=${h} step=${0.5} unit="см" digits=${1} onChange=${setH} />
    <div class="label">Голова</div><${Stepper} value=${hd} step=${0.5} unit="см" digits=${1} onChange=${setHd} />
    <button class="btn btn-primary" disabled=${w == null && h == null && hd == null} onClick=${save}>Готово</button>
    ${rec && html`<button class="btn-quiet" onClick=${() => { const copy = rec.id; removeRecord(copy); closeSheet(); toast({ text: 'Замер убрали', ms: 2000 }); }}>Удалить замер</button>`}`;
}
export const openMeasure = (child, id) => { track(id ? 'рост:замер-открыть' : 'рост:новый-замер'); openSheet(MeasureSheet, { childId: child.id, id }); };

function Growth() {
  const s = useStore();
  const child = bornChild(s);
  const [kind, setKind] = useState('weight');
  if (!child) return html`<${NotBorn} title="Рост" text="Замеры начнутся, когда малыш родится." />`;
  const all = measures(child, s);
  const t = now();
  const points = all.filter((r) => r.data && r.data[kind]).map((r) => ({ t: r.start, v: +r.data[kind] }));
  const from = points.length ? Math.min(child.dob, ...points.map((p) => p.t)) : child.dob;
  const to = Math.max(t, from + 40 * DAY);
  const first = all[all.length - 1];
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Рост</h1>
      <${Seg} items=${[['weight', 'Вес'], ['height', 'Рост'], ['head', 'Голова']]} value=${kind} onChange=${(k) => { track('рост:' + k); setKind(k); }} />
      <${Chart} points=${points} kind=${kind} from=${from} to=${to} />
      ${!all.length ? html`
        <p class="lead">Запишите вес, рост или окружность головы. Здесь появятся ваши точки и история.</p>`
      : html`
        <${SecTitle}>Замеры<//>
        <div class="rows">
          ${all.map((r) => html`<${Row} key=${r.id} title=${measureLine(r)} sub=${dateLong(r.start) + (r === first && r.start - child.dob < 8 * DAY ? ' · выписка из роддома' : '')} onClick=${() => openMeasure(child, r.id)} />`)}
        </div>`}
      <div class="rows"><${Row} title="＋ Замер" sub="Вес, рост, голова" onClick=${() => openMeasure(child)} /></div>
      ${points.length === 1 && html`<p class="tiny">Линия появится со вторым замером.</p>`}
    </div>`;
}

export const rostRoutes = [{ path: '/rebyonok/rost', view: Growth, tab: '/rebyonok', strip: true }];
