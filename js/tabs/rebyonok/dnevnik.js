// «Ребёнок → Дневник» (экран 4, вид «Неделя» — экран 18 «Сегодня», «Сон за неделю» — экран 12):
// что было — строками с точкой, что в планах — с кружком; «Получилось?», «Новое дело».
import { html, useState } from '../../lib.js';
import { useStore, getState, now } from '../../store.js';
import { Header, SecTitle, Row, Pill, Field, openSheet, closeSheet, toast } from '../../ui.js';
import { DAY, startOfDay, dayKey, fromKey, dateLong, weekdayShort, weekdayLong, hhmm, ageMonths } from '../../age.js';
import { recordsOf, daySummary, sleepNorm, yesterdaySleep } from '../../records.js';
import { EditSheet } from '../../strip.js';
import { go } from '../../router.js';
import { track } from '../../stats.js';
import { bornChild, nameOf, Seg, WeekStrip, DotRow, dayTitle, plansOn, doneTasksOn, tasksOf, addTask, setTask, removeTask, timeOf,
  recTitle, recTime, dayTotal, durNoPad, openVaccine, vaccineSub, monthsWord, cap , NotBorn } from './util.js';

const to = (d, extra = '') => go(`/rebyonok/dnevnik?den=${dayKey(d)}${extra}`);

// ——— Лист «Новое дело» ———
function NewTaskSheet({ childId, day: preset, id }) {
  const s = getState();
  const child = s.children.find((c) => c.id === childId);
  const task = id ? (s.tasks || []).find((x) => x.id === id) : null;
  const t = now();
  const [title, setTitle] = useState(task ? task.title : '');
  const [day, setDay] = useState(task ? startOfDay(task.when) : startOfDay(preset || t));
  const [time, setTime] = useState(task && timeOf(task.when, task) ? hhmm(task.when).padStart(5, '0') : '');
  const days = Array.from({ length: 7 }, (_, i) => startOfDay(t) + i * DAY);
  if (!days.includes(day)) days.unshift(day);
  const save = () => {
    let when = day;
    if (time) { const [h, m] = time.split(':').map(Number); when = day + (h * 60 + m) * 60000; }
    if (task) { setTask(task.id, (x) => { x.title = title.trim(); x.when = when; x.time = !!time; }); closeSheet(); toast({ text: `Перенесли на ${dateLong(when)}`, ms: 2500 }); return; }
    const nid = addTask(child, title.trim(), when, 'own');
    track('дневник:новое-дело');
    closeSheet();
    toast({ text: `Дело на ${dateLong(when)} — в «На этой неделе»`, actions: [{ label: 'Отменить', onClick: () => removeTask(nid) }] });
  };
  return html`
    <div class="h2">${task ? 'Перенести дело' : 'Новое дело'}</div>
    <${Field} label="Что сделать" value=${title} onInput=${setTitle} placeholder="Позвонить в поликлинику" autofocus=${!task} />
    <div class="label">Когда</div>
    <div class="pills">${days.map((d, i) => html`<${Pill} on=${day === d} onClick=${() => setDay(d)}>${d === startOfDay(t) ? 'Сегодня' : d === startOfDay(t) + DAY ? 'Завтра' : `${weekdayShort(d)} ${new Date(d).getDate()}`}<//>`)}</div>
    <div class="label">Во сколько — если важно</div>
    <input class="pill rb-time" type="time" value=${time} onChange=${(e) => setTime(e.target.value)} />
    <button class="btn btn-primary" disabled=${!title.trim()} onClick=${save}>Готово</button>`;
}
export const openNewTask = (child, day) => { track('дневник:добавить-дело'); openSheet(NewTaskSheet, { childId: child.id, day }); };

// ——— Лист дела: прошедшее — «Получилось?», будущее — «Сделано / Перенести» ———
function TaskSheet({ id }) {
  const s = useStore();
  const task = (s.tasks || []).find((x) => x.id === id);
  if (!task) return html`<div class="h2">Дела больше нет</div><button class="btn btn-gray" onClick=${closeSheet}>Закрыть</button>`;
  const past = startOfDay(task.when) < startOfDay(now());
  const done = () => {
    setTask(id, (x) => { x.done = now(); });
    track('дневник:получилось');
    closeSheet();
    toast({ text: past ? 'Отметили — теперь это запись дня' : 'Сделано', actions: [{ label: 'Отменить', onClick: () => setTask(id, (x) => { x.done = null; }) }] });
  };
  return html`
    <div class="h2">${task.title}</div>
    <div class="small">${task.done ? `Сделано ${dateLong(task.done)}` : `${past ? 'Было в планах' : 'В планах'} · ${dateLong(task.when)}${timeOf(task.when, task) ? ', ' + timeOf(task.when, task) : ''}`}</div>
    ${!task.done && html`
      ${past && html`<div class="label">Получилось?</div>`}
      <div class="pills">
        <button class="pill" onClick=${done}>${past ? 'Да' : 'Сделано'}</button>
        <button class="pill" onClick=${() => openSheet(NewTaskSheet, { childId: task.childId, id })}>Перенести</button>
      </div>`}
    ${task.done && html`<button class="btn btn-gray" onClick=${() => { setTask(id, (x) => { x.done = null; }); closeSheet(); }}>Ещё не сделано</button>`}
    <button class="btn btn-primary" onClick=${closeSheet}>Готово</button>
    <button class="btn-quiet" onClick=${() => { const copy = { ...task }; removeTask(id); closeSheet(); toast({ text: 'Дело убрали', actions: [{ label: 'Вернуть', onClick: () => addTask({ id: copy.childId }, copy.title, copy.when, copy.kind) }] }); }}>Удалить дело</button>`;
}
const openTask = (task) => { track('дневник:дело'); openSheet(TaskSheet, { id: task.id }); };

// Строки «в планах» для дня
function PlanRows({ child, d }) {
  const s = getState();
  const today = startOfDay(now());
  const items = plansOn(child, d, s);
  return items.map((p) => {
    if (p.kind === 'vaccine') return html`<${DotRow} plan title=${p.group.title} sub=${vaccineSub(child, p.group)} onClick=${() => openVaccine(child, p.group)} />`;
    const x = p.task;
    const past = startOfDay(x.when) < today;
    const tm = timeOf(x.when, x);
    const sub = past ? 'Было в планах — получилось?' : x.kind === 'doctor' || x.kind === 'tests' || x.kind === 'vaccine' ? `${tm ? tm + ' · ' : ''}напомним накануне` : x.kind === 'own' ? (tm ? `${tm} · своё дело` : 'Своё дело') : tm;
    return html`<${DotRow} plan title=${x.title + (past && tm ? ` в ${tm}` : '')} sub=${sub} onClick=${() => openTask(x)} />`;
  });
}
function DoneRows({ child, d }) {
  return doneTasksOn(child, d).map((x) => html`<${DotRow} title=${x.title} sub=${`Сделано${timeOf(x.when, x) ? ' · было в планах на ' + timeOf(x.when, x) : ''}`} onClick=${() => openTask(x)} />`);
}

// ——— День ———
function DayView({ child, d }) {
  const [all, setAll] = useState(false);
  const t = now();
  const today = startOfDay(t);
  const recs = recordsOf(child.id).filter((r) => r.start >= d && r.start < d + DAY || (r.type === 'sleep' && r.start < d && (r.end ?? t) > d)).sort((a, b) => b.start - a.start);
  const total = dayTotal(child, d, t);
  const shown = all ? recs : recs.slice(0, 4);
  const future = d > today;
  return html`
    <div class="between rb-dayline">
      <button aria-label="Предыдущий день" onClick=${() => to(d - DAY)}>‹</button>
      <span class="small">${dayTitle(d, t)}</span>
      <button aria-label="Следующий день" onClick=${() => to(d + DAY)}>›</button>
    </div>
    <${WeekStrip} child=${child} selected=${d} onPick=${(x) => { track('дневник:день'); to(x); }} />
    ${!future && html`
      <${SecTitle}>Что было<//>
      <div class="rows">
        ${total && html`<${DotRow} title=${total} sub=${d === today ? 'За сегодня' : 'За день'} onClick=${() => { track('дневник:итог'); go('/rebyonok/dnevnik/son?den=' + dayKey(d)); }} />`}
        ${shown.map((r) => html`<${DotRow} key=${r.id} title=${recTitle(r)} sub=${recTime(r)} onClick=${() => { track('дневник:запись'); openSheet(EditSheet, { id: r.id }); }} />`)}
        <${DoneRows} child=${child} d=${d} />
      </div>
      ${!recs.length && !doneTasksOn(child, d).length && html`<p class="small">${d === today ? 'Сегодня пока ничего не записано. Запись — кнопками внизу, одним касанием.' : 'В этот день записей нет.'}</p>`}
      ${recs.length > 4 && !all && html`<button class="rb-more" onClick=${() => { track('дневник:все-записи'); setAll(true); }}>Все записи дня — ещё ${recs.length - 4} ›</button>`}`}
    <${SecTitle}>В планах<//>
    <div class="rows"><${PlanRows} child=${child} d=${d} /></div>
    ${!plansOn(child, d).length && html`<p class="small">${d < today ? 'Планов на этот день не было.' : 'Ничего не запланировано.'}</p>`}
    <button class="rb-add" onClick=${() => openNewTask(child, Math.max(d, today))}>＋ Добавить дело</button>`;
}

// ——— Неделя: вчера, сегодня и пять дней вперёд ———
function WeekView({ child }) {
  const t = now();
  const today = startOfDay(t);
  const days = Array.from({ length: 7 }, (_, i) => startOfDay(today - DAY + i * DAY + 3 * 3600e3));
  const blocks = [];
  let empty = [];
  const flush = () => { if (empty.length) { blocks.push({ empty: [...empty] }); empty = []; } };
  for (const d of days) {
    const total = d <= today ? dayTotal(child, d, t) : null;
    const has = total || plansOn(child, d).length || doneTasksOn(child, d).length;
    if (!has && d > today) { empty.push(d); continue; }
    flush();
    blocks.push({ d, total });
  }
  flush();
  const head = (d) => `${weekdayLong(d)}, ${dateLong(d)}${d === today ? ' · сегодня' : d === today - DAY ? ' · вчера' : ''}`;
  return html`
    <div class="rb-legend"><span><i class="rb-dot"></i>было — записи</span><span><i class="rb-dot plan"></i>в планах</span></div>
    ${blocks.map((b) => b.empty ? html`
      <div class="sec-title"><span>${b.empty.length > 1 ? `${weekdayLong(b.empty[0])}, ${new Date(b.empty[0]).getDate()} — ${weekdayLong(b.empty[b.empty.length - 1])}, ${dateLong(b.empty[b.empty.length - 1])}` : head(b.empty[0])}</span></div>
      <p class="small">Ничего не запланировано</p>` : html`
      <div class="sec-title"><button class="rb-btn-title" onClick=${() => { track('дневник:неделя-день'); to(b.d); }}>${head(b.d)}</button></div>
      <div class="rows">
        ${b.total && html`<${DotRow} title=${b.total} sub=${b.d === today ? 'Пока за сегодня' : 'За день'} onClick=${() => to(b.d)} />`}
        ${!b.total && b.d <= today && html`<${DotRow} title=${b.d === today ? 'Пока ничего не записано' : 'Записей нет'} sub="Открыть день" onClick=${() => to(b.d)} />`}
        <${DoneRows} child=${child} d=${b.d} />
        <${PlanRows} child=${child} d=${b.d} />
      </div>`)}
    <button class="rb-add" onClick=${() => openNewTask(child, today)}>＋ Добавить дело</button>`;
}

// ——— Месяц: сетка дней, точка и кружок ———
function MonthView({ child, query }) {
  const t = now();
  const base = query.mesyac ? fromKey(query.mesyac + '-01') : startOfDay(t);
  const first = new Date(base); first.setDate(1);
  const y = first.getFullYear(), m = first.getMonth();
  const daysIn = new Date(y, m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const today = startOfDay(t);
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => new Date(y, m, i + 1).getTime())];
  const name = first.toLocaleString('ru', { month: 'long' });
  const shift = (k) => { const d = new Date(y, m + k, 1); go(`/rebyonok/dnevnik?vid=mesyac&mesyac=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); };
  return html`
    <div class="between rb-dayline"><button aria-label="Предыдущий месяц" onClick=${() => shift(-1)}>‹</button><span class="h3">${cap(name)} ${y}</span><button aria-label="Следующий месяц" onClick=${() => shift(1)}>›</button></div>
    <div class="rb-month">
      ${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((w) => html`<span class="dn">${w}</span>`)}
      ${cells.map((d) => d == null ? html`<span></span>` : html`
        <button class=${'rb-mday' + (d === today ? ' today' : '')} onClick=${() => { track('дневник:месяц-день'); to(d); }}>
          <span>${new Date(d).getDate()}</span>
          <span class="marks">${daySummary(child.id, d, t).any || doneTasksOn(child, d).length ? html`<i class="mark"></i>` : ''}${d >= today && plansOn(child, d).length ? html`<i class="mark plan"></i>` : ''}</span>
        </button>`)}
    </div>
    <p class="tiny">Точка — были записи, кружок — что-то в планах. Касание — этот день.</p>`;
}

function Diary({ query }) {
  const s = useStore();
  const child = bornChild(s);
  if (!child) return html`<${NotBorn} title="Дневник" text="Дневник начнётся, когда малыш родится: сон, кормления, прогулки и планы — по дням." />`;
  if (query.vid === 'son') return html`<${SleepWeek} query=${{ den: query.den }} />`;
  const vid = query.vid === 'nedelya' ? 'week' : query.vid === 'mesyac' ? 'month' : 'day';
  const d = query.den ? fromKey(query.den) : startOfDay(now());
  const set = (k) => { track('дневник:вид-' + k); go(k === 'week' ? '/rebyonok/dnevnik?vid=nedelya' : k === 'month' ? '/rebyonok/dnevnik?vid=mesyac' : '/rebyonok/dnevnik', { replace: true }); };
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Дневник</h1>
      <${Seg} items=${[['day', 'День'], ['week', 'Неделя'], ['month', 'Месяц']]} value=${vid} onChange=${set} />
      ${vid === 'day' && html`<${DayView} child=${child} d=${d} />`}
      ${vid === 'week' && html`<${WeekView} child=${child} />`}
      ${vid === 'month' && html`<${MonthView} child=${child} query=${query} />`}
    </div>`;
}

// ——— «Сон за неделю» (экран 12): столбик — сон за сутки, полоса — ориентир возраста ———
function SleepChart({ bars, norm, max }) {
  const W = 340, H = 160, L = 34, T = 10, B = 24;
  const top = Math.max(max, norm ? norm[1] + 1 : 0, 8);
  const y = (h) => T + (1 - h / top) * (H - T - B);
  const bw = (W - L - 8) / bars.length;
  const ticks = norm ? [norm[1], norm[0], Math.round(norm[0] / 2)] : [Math.round(top), Math.round(top / 2)];
  return html`
    <svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label="Сон по дням">
      ${norm && html`<rect x=${L} y=${y(norm[1])} width=${W - L - 4} height=${y(norm[0]) - y(norm[1])} class="band" />`}
      ${ticks.map((v) => html`<text x="2" y=${y(v) + 4} class="lbl">${v} ч</text>`)}
      ${bars.map((b, i) => html`
        <g onClick=${b.onClick} style="cursor:pointer">
          <rect x=${L + i * bw + bw * 0.18} y=${y(b.h)} width=${bw * 0.64} height=${Math.max(0, y(0) - y(b.h))} rx="5" class=${'bar' + (b.light ? ' light' : '')} />
          <text x=${L + i * bw + bw / 2} y=${H - 6} class="lbl" text-anchor="middle">${b.label}</text>
        </g>`)}
    </svg>`;
}
function SleepWeek({ query }) {
  const s = useStore();
  const child = bornChild(s);
  if (!child) return html`<${NotBorn} title="Сон" text="Сон по дням появится, когда малыш родится." />`;
  const t = now();
  const today = startOfDay(t);
  const vid = query.vid === 'mesyac' ? 'month' : 'week';
  const m = ageMonths(child, t);
  const norm = sleepNorm(m);
  const H = (ms) => ms / 3600e3;
  let bars;
  if (vid === 'week') {
    bars = Array.from({ length: 7 }, (_, i) => today - (6 - i) * DAY).map((d) => {
      const day = startOfDay(d + 3 * 3600e3);
      return { d: day, h: H(daySummary(child.id, day, t).sleep), label: weekdayShort(day), light: day === today, onClick: () => to(day) };
    });
  } else {
    bars = Array.from({ length: 5 }, (_, i) => today - (4 - i) * 7 * DAY).map((end) => {
      let sum = 0, n = 0;
      for (let k = 0; k < 7; k++) { const day = startOfDay(end - k * DAY + 3 * 3600e3); if (day === today) continue; const v = daySummary(child.id, day, t).sleep; if (v) { sum += v; n++; } }
      return { h: n ? H(sum / n) : 0, label: `${new Date(end - 6 * DAY).getDate()}–${new Date(end).getDate()}`, onClick: () => to(end - DAY) };
    });
  }
  const max = Math.max(...bars.map((b) => b.h), 0);
  const ys = yesterdaySleep(child.id, t);
  const rows = Array.from({ length: 7 }, (_, i) => startOfDay(today - (i + 1) * DAY + 3 * 3600e3)).map((d) => ({ d, v: daySummary(child.id, d, t).sleep })).filter((x) => x.v);
  const ageIn = m >= 0 ? `в ${monthsWord(m)}` : '';
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Сон</h1>
      <${Seg} items=${[['day', 'День'], ['week', 'Неделя'], ['month', 'Месяц']]} value=${vid} onChange=${(k) => { track('сон:вид-' + k); k === 'day' ? to(query.den ? fromKey(query.den) : today) : go(k === 'month' ? '/rebyonok/dnevnik/son?vid=mesyac' : '/rebyonok/dnevnik/son', { replace: true }); }} />
      <div class="rb-chart">
        <${SleepChart} bars=${bars} norm=${norm} max=${max} />
        <p class="tiny">${norm ? `Полоса — ориентир ${ageIn}: ${norm[0]}–${norm[1]} ч в сутки. ` : ''}${vid === 'week' ? 'Сегодня — день ещё не кончился.' : 'Столбик — сколько в среднем спал в сутки за неделю.'}</p>
      </div>
      ${ys && norm && html`<p class="quote">Вчера ${nameOf(child)} спал${child.sex === 'girl' ? 'а' : ''} ${durNoPad(ys)}. Ориентир ${ageIn} — ${norm[0]}–${norm[1]} ч в сутки, бывает и больше, и меньше.</p>`}
      ${!max && html`<p class="small">Сна за эти дни пока не записано. «Сон» внизу — одним касанием: начать и закончить.</p>`}
      ${rows.length > 0 && html`
        <${SecTitle}>По дням<//>
        <div class="rows">${rows.map((x) => html`<${Row} title=${dayTitle(x.d, t).replace(' · вчера', '')} sub=${durNoPad(x.v)} onClick=${() => to(x.d)} />`)}</div>`}
    </div>`;
}

export const dnevnikRoutes = [
  { path: '/rebyonok/dnevnik', view: Diary, tab: '/rebyonok', strip: true },
  { path: '/rebyonok/dnevnik/son', view: SleepWeek, tab: '/rebyonok', strip: true },
];
