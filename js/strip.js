// Полоса записи над меню, плашки идущей записи и листы «Кормление», «Поправить», «Другая запись».
import { html, useState, useRef } from './lib.js';
import { useStore, useTick, activeChild, update, now, getState, savePhoto, uid } from './store.js';
import { ageMonths, clock, hhmm, dur } from './age.js';
import { addRecord, finishRecord, removeRecord, editRecord, switchSide, lastOf, ongoing, sinceLine, describe, whenText, recentTypes, SIDE, DIAPER, POTTY } from './records.js';
import { openSheet, closeSheet, toast, Pill, Field } from './ui.js';
import { playNoise, usePlayer, playing, stop as stopPlayer } from './player.js';
import { track } from './stats.js';
import { go } from './router.js';

// Для кого запись: выбранный ребёнок, а у близнецов в режиме «Оба» — каждый
export function targets(s = getState()) {
  const c = activeChild(s);
  if (!c || c.expecting) return [];
  if (s.bothTwins && c.twinOf) return [c.id, c.twinOf];
  return [c.id];
}

function recorded(ids, text, { editable = true, extra = [] } = {}) {
  const id = ids[0];
  toast({
    text,
    actions: [
      ...extra,
      ...(editable ? [{ label: 'Поправить', onClick: () => openSheet(EditSheet, { id }) }] : []),
      { label: 'Отменить', onClick: () => { ids.forEach(removeRecord); track('запись:отменить'); toast({ text: 'Запись убрали', ms: 2000 }); } },
    ],
  });
}

// ——— Нажатия на кнопки записи ———
// Сон — с вопросом: случайное касание больше не начинает и не заканчивает сон (замечание Марии Даниной)
export function tapSleep() {
  const ids = targets(); if (!ids.length) return;
  const run = ongoing(ids[0]).find((r) => r.type === 'sleep');
  track(run ? 'запись:сон-лист-идёт' : 'запись:сон-лист');
  openSheet(SleepSheet, { runId: run ? run.id : null });
}
function startSleep(agoMin = 0) {
  const ids = targets(); if (!ids.length) return;
  track('запись:сон' + (agoMin ? '-раньше' : ''));
  const made = addRecord(ids, 'sleep', {}, { timer: true });
  if (agoMin) made.forEach((id) => editRecord(id, (x) => { x.start -= agoMin * 60000; }));
  closeSheet();
  recorded(made, agoMin ? `Сон идёт — уснули ${agoMin} мин назад` : 'Сон идёт', { editable: true });
}
function SleepSheet({ runId }) {
  const s = useStore();
  useTick(15000);
  const run = runId && s.records.find((x) => x.id === runId && x.end == null);
  if (run) return html`
    <div class="h2">Сон идёт · ${dur(now() - run.start)}</div>
    <p class="small">С ${hhmm(run.start)}.</p>
    <button class="btn btn-primary" onClick=${() => { closeSheet(); finishSleep(run.id); }}>Проснулись — закончить</button>
    <button class="btn btn-gray" onClick=${() => openSheet(EditSheet, { id: run.id })}>Поправить начало</button>
    <button class="btn-quiet" onClick=${closeSheet}>Не сейчас</button>`;
  return html`
    <div class="h2">Начинаем сон?</div>
    <p class="small">Время пойдёт с этой минуты. Уснули раньше — выберите, когда.</p>
    <button class="btn btn-primary" onClick=${() => startSleep(0)}>Да, сейчас</button>
    <div class="pills">${[10, 20, 30].map((m) => html`<button class="pill" onClick=${() => startSleep(m)}>${m} мин назад</button>`)}</div>
    <button class="btn-quiet" onClick=${() => openSheet(OtherForm, { kind: 'sleep' })}>Записать прошедший сон</button>
    <button class="btn-quiet" onClick=${closeSheet}>Не сейчас</button>`;
}
export function finishSleep(id) {
  finishRecord(id);
  const r = getState().records.find((x) => x.id === id);
  const p = playing();
  if (p && /white|pink/.test(p.id || '')) stopPlayer();
  track('запись:сон-закончить');
  recorded([id], `Записано: сон ${dur(r.end - r.start)}`);
}

export function tapFeed() {
  const ids = targets(); if (!ids.length) return;
  const run = ongoing(ids[0]).find((r) => r.type === 'feed');
  if (run) return openSheet(EditSheet, { id: run.id });
  const last = getState().settings.lastFeed;
  if (!last) { track('запись:кормление-первое'); return openSheet(FeedSheet, {}); }
  track('запись:кормление');
  if (last.method === 'bottle') {
    const made = addRecord(ids, 'feed', { method: 'bottle', ml: last.ml || 90 });
    recorded(made, `Записано: бутылочка ${last.ml || 90} мл`);
  } else {
    const side = last.side === 'left' ? 'right' : 'left';
    addRecord(ids, 'feed', { method: 'breast', side }, { timer: true });
    toast({ text: `Кормление идёт — ${SIDE[side]} грудь`, ms: 2500 });
  }
}
export function finishFeed(id) {
  finishRecord(id);
  const r = getState().records.find((x) => x.id === id);
  track('запись:кормление-закончить');
  recorded([id], `Записано: ${SIDE[r.data.side]} грудь, ${dur(r.end - r.start)}`);
}
export function tapDiaper() {
  const ids = targets(); if (!ids.length) return;
  track('запись:подгузник');
  const made = addRecord(ids, 'diaper', { kind: 'wet' });
  const set = (kind, label) => ({ label, onClick: () => { made.forEach((id) => editRecord(id, (r) => { r.data.kind = kind; })); toast({ text: `Записано: ${DIAPER[kind]}`, ms: 2500 }); } });
  recorded(made, 'Записано: мокрый', { editable: false, extra: [set('dirty', 'Грязный'), set('both', 'Оба')] });
}
export function tapPotty() {
  const ids = targets(); if (!ids.length) return;
  track('запись:горшок');
  const made = addRecord(ids, 'potty', { result: 'ok' });
  const set = (result, label) => ({ label, onClick: () => { made.forEach((id) => editRecord(id, (r) => { r.data.result = result; })); toast({ text: `Записано: ${POTTY[result]}`, ms: 2500 }); } });
  recorded(made, 'Записано: получилось', { editable: false, extra: [set('miss', 'Мимо'), set('sat', 'Посидели')] });
}
export function tapFood() {
  const ids = targets(); if (!ids.length) return;
  track('запись:еда');
  const made = addRecord(ids, 'food', {});
  recorded(made, 'Записано: еда');
}

const TAP = { sleep: tapSleep, feed: tapFeed, diaper: tapDiaper, potty: tapPotty, food: tapFood };
const LABEL = { sleep: 'Сон', feed: 'Кормление', diaper: 'Подгузник', potty: 'Горшок', food: 'Еда' };

// Какие кнопки у этого возраста
export function stripButtons(child, s = getState()) {
  if (!child || child.expecting) return { buttons: [], line: false };
  const m = ageMonths(child, now());
  const hidden = s.settings.hiddenButtons || [];
  let buttons;
  let line = false;
  if (m < 12) buttons = ['sleep', 'feed', 'diaper'];
  else if (m < 36) buttons = ['sleep', 'food', 'potty'];
  else { line = true; const r = recentTypes(child.id); buttons = ['potty', 'sleep', 'food'].filter((t) => r.includes(t)); }
  return { buttons: buttons.filter((b) => !hidden.includes(b)), line };
}

// Долгое нажатие — сразу «Поправить» последнюю запись
function useLongPress(onLong, onTap) {
  const t = useRef(null); const fired = useRef(false);
  return {
    onPointerDown: () => { fired.current = false; t.current = setTimeout(() => { fired.current = true; onLong(); }, 550); },
    onPointerUp: () => clearTimeout(t.current),
    onPointerLeave: () => clearTimeout(t.current),
    onClick: () => { if (!fired.current) onTap(); },
    onContextMenu: (e) => e.preventDefault(),
  };
}

function StripButton({ type, child }) {
  useTick(15000);
  const since = sinceLine(child.id, type, now());
  const run = ongoing(child.id).find((r) => r.type === type);
  const lp = useLongPress(() => { const r = lastOf(child.id, type); if (r) openSheet(EditSheet, { id: r.id }); }, TAP[type]);
  // Одна строка состояния под названием: полоса ниже, а последняя запись всё равно видна
  let a = '';
  if (run) a = 'идёт ' + clock(now() - run.start);
  else if (since) a = `${since.a} ${since.b}`.trim();
  else a = 'нет записей';
  return html`<button class=${'strip-btn' + (run ? ' on' : '')} ...${lp}><b>${LABEL[type]}</b><span>${a}</span></button>`;
}

export function RecordStrip() {
  const s = useStore();
  const child = activeChild(s);
  const { buttons, line } = stripButtons(child, s);
  if (!child || child.expecting) return null;
  if (line && !buttons.length) {
    return html`<button class="strip-line" onClick=${() => openSheet(OtherSheet, {})}><span>＋ Записать</span></button>`;
  }
  // «＋» — слева: справа над полосой капсула «✦ Спросить», рядом с ней «＋» не ставим
  return html`
    <div class="strip">
      <button class="strip-btn strip-plus" aria-label=${line ? 'Записать' : 'Другая запись'} onClick=${() => { track('запись:другая'); openSheet(OtherSheet, {}); }}><b>＋</b><span>${line ? 'Записать' : 'Другое'}</span></button>
      ${buttons.map((t) => html`<${StripButton} key=${t} type=${t} child=${child} />`)}
    </div>`;
}

// ——— Плашки идущей записи ———
export function Plaques() {
  const s = useStore();
  useTick(1000);
  const p = usePlayer();
  const list = s.records.filter((r) => r.end == null && (r.type === 'sleep' || r.type === 'feed' || r.type === 'walk'));
  if (!list.length) return null;
  const many = s.children.length > 1;
  return html`${list.map((r) => {
    const c = s.children.find((x) => x.id === r.childId);
    const who = many && c ? ` · ${c.name}` : '';
    if (r.type === 'sleep') {
      const noiseOn = p && /white|pink/.test(p.id || '');
      return html`
        <div class="plaque">
          <div class="plaque-top"><span class="plaque-title">Сон${who}</span><span class="plaque-time">${clock(now() - r.start)}</span></div>
          <div class="small">Спит с ${hhmm(r.start)}</div>
          <div class="plaque-btns">
            <button class="btn btn-gray" onClick=${() => { track('плашка:шум'); noiseOn ? stopPlayer() : playNoise('white'); }}>${noiseOn ? 'Выключить шум' : 'Шум'}</button>
            <button class="btn btn-primary" onClick=${() => finishSleep(r.id)}>Закончить</button>
          </div>
        </div>`;
    }
    if (r.type === 'feed') {
      const prev = s.records.filter((x) => x.childId === r.childId && x.type === 'feed' && x.end != null && x.data.method === 'breast').sort((a, b) => b.start - a.start)[0];
      return html`
        <div class="plaque">
          <div class="plaque-top"><span class="plaque-title">Кормление · ${SIDE[r.data.side]}${who}</span><span class="plaque-time">${clock(now() - r.start)}</span></div>
          <div class="small">С ${hhmm(r.start)}${prev ? ` · в прошлый раз закончили ${prev.data.side === 'left' ? 'левой' : 'правой'}` : ''}</div>
          <div class="plaque-btns">
            <button class="btn btn-gray" onClick=${() => { track('плашка:сменить-грудь'); switchSide(r.id); }}>Сменить грудь</button>
            <button class="btn btn-primary" onClick=${() => finishFeed(r.id)}>Закончить</button>
          </div>
        </div>`;
    }
    return html`
      <div class="plaque">
        <div class="plaque-top"><span class="plaque-title">Прогулка${who}</span><span class="plaque-time">${clock(now() - r.start)}</span></div>
        <div class="plaque-btns"><button class="btn btn-primary" onClick=${() => { finishRecord(r.id); recorded([r.id], 'Записано: прогулка'); }}>Закончить</button></div>
      </div>`;
  })}`;
}

// ——— Лист «Кормление» — один раз, пока способа ещё нет ———
export function FeedSheet() {
  const [method, setMethod] = useState('breast');
  const [side, setSide] = useState('left');
  const [ml, setMl] = useState(90);
  const start = () => {
    const ids = targets();
    closeSheet();
    if (method === 'breast') {
      addRecord(ids, 'feed', { method: 'breast', side }, { timer: true });
      toast({ text: `Кормление идёт — ${SIDE[side]} грудь. «Закончить» — на плашке`, ms: 3000 });
    } else {
      const made = addRecord(ids, 'feed', { method: 'bottle', ml });
      recorded(made, `Записано: бутылочка ${ml} мл`);
    }
  };
  return html`
    <div class="h2">Кормление</div>
    <div class="small">Запомним способ — в следующий раз хватит одного касания.</div>
    <div class="pills"><${Pill} on=${method === 'breast'} onClick=${() => setMethod('breast')}>Грудь<//><${Pill} on=${method === 'bottle'} onClick=${() => setMethod('bottle')}>Бутылочка<//></div>
    ${method === 'breast' ? html`
      <div class="label">С КАКОЙ ГРУДИ</div>
      <div class="pills"><${Pill} on=${side === 'left'} onClick=${() => setSide('left')}>Левая<//><${Pill} on=${side === 'right'} onClick=${() => setSide('right')}>Правая<//></div>
      <button class="btn btn-primary" onClick=${start}>Начать</button>` : html`
      <div class="label">СКОЛЬКО</div>
      <${Stepper} value=${ml} step=${10} unit="мл" onChange=${setMl} />
      <button class="btn btn-primary" onClick=${start}>Записать</button>`}
  `;
}

export function Stepper({ value, step, unit, onChange, min = 0, fmt }) {
  return html`
    <div style="display:flex;align-items:center;gap:12px">
      <button class="pill" onClick=${() => onChange(Math.max(min, +(value - step).toFixed(2)))}>−${String(step).replace('.', ',')}</button>
      <span class="big-num">${fmt ? fmt(value) : value} ${unit}</span>
      <button class="pill" onClick=${() => onChange(+(value + step).toFixed(2))}>+${String(step).replace('.', ',')}</button>
    </div>`;
}

// ——— Лист «Поправить запись»: время и объём кнопками, без клавиатуры ———
export function EditSheet({ id }) {
  const s = useStore();
  const r = s.records.find((x) => x.id === id);
  const [custom, setCustom] = useState(false);
  if (!r) return html`<div class="h2">Запись убрали</div><button class="btn btn-gray" onClick=${closeSheet}>Закрыть</button>`;
  const shift = (min) => editRecord(id, (x) => { const d = min * 60000; x.start -= d; if (x.end != null && x.type !== 'sleep' && x.type !== 'feed' && x.type !== 'walk') x.end -= d; if (x.end != null && x.end < x.start) x.end = x.start; });
  const setTime = (v) => { const [h, m] = v.split(':').map(Number); if (isNaN(h)) return; editRecord(id, (x) => { const d = new Date(x.start); d.setHours(h, m, 0, 0); const delta = d.getTime() - x.start; x.start += delta; if (x.end != null && !['sleep', 'feed', 'walk'].includes(x.type)) x.end += delta; }); };
  const d = r.data || {};
  const timed = ['sleep', 'feed', 'walk'].includes(r.type) && !(r.type === 'feed' && d.method === 'bottle');
  // Колесо даты и времени — системное, как в iOS и Android: можно записать день задним числом
  const loc = (t) => { const x = new Date(t); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
  const setStart = (v) => { const t = new Date(v).getTime(); if (isNaN(t)) return; editRecord(id, (x) => { const delta = t - x.start; x.start = t; if (x.end != null && !['sleep', 'feed', 'walk'].includes(x.type)) x.end += delta; if (x.end != null && x.end < x.start) x.end = x.start + 60000; }); };
  const setEnd = (v) => { const t = new Date(v).getTime(); if (isNaN(t)) return; editRecord(id, (x) => { x.end = Math.max(x.start + 60000, t); }); };
  return html`
    <div class="h2">Поправить запись</div>
    <div class="small">${describe(r)} · ${whenText(r)}</div>
    <div class="label">${timed ? 'Начало' : 'Когда'}</div>
    <div class="pills">
      ${[5, 15, 30].map((m) => html`<button class="pill" onClick=${() => shift(m)}>−${m} мин</button>`)}
      ${custom ? '' : html`<button class="pill" onClick=${() => setCustom(true)}>Другие дата и время</button>`}
    </div>
    ${custom && html`
      <label class="field"><span class="label">${timed ? 'Дата и время начала' : 'Дата и время'}</span><input type="datetime-local" value=${loc(r.start)} max=${loc(now())} onChange=${(e) => setStart(e.target.value)} /></label>
      ${timed && r.end != null && html`<label class="field"><span class="label">Дата и время конца</span><input type="datetime-local" value=${loc(r.end)} max=${loc(now())} onChange=${(e) => setEnd(e.target.value)} /></label>`}`}
    ${timed && r.end != null && html`
      <div class="label">Длительность · ${dur(r.end - r.start)}</div>
      <div class="pills">${[-10, -5, 5, 10].map((m) => html`<button class="pill" onClick=${() => editRecord(id, (x) => { x.end = Math.max(x.start + 60000, x.end + m * 60000); })}>${m > 0 ? '+' : '−'}${Math.abs(m)} мин</button>`)}</div>`}
    ${r.type === 'feed' && d.method === 'bottle' || r.type === 'pump' ? html`
      <div class="label">Сколько</div>
      <${Stepper} value=${d.ml || 0} step=${10} unit="мл" onChange=${(v) => editRecord(id, (x) => { x.data.ml = v; if (x.type === 'feed') update((st) => { st.settings.lastFeed = { method: 'bottle', ml: v }; }); })} />` : ''}
    ${r.type === 'feed' && d.method === 'breast' && html`
      <div class="pills">${['left', 'right'].map((sd) => html`<${Pill} on=${d.side === sd} onClick=${() => editRecord(id, (x) => { x.data.side = sd; })}>${SIDE[sd][0].toUpperCase() + SIDE[sd].slice(1)}<//>`)}</div>`}
    ${r.type === 'diaper' && html`<div class="pills">${Object.entries(DIAPER).map(([k, v]) => html`<${Pill} on=${(d.kind || 'wet') === k} onClick=${() => editRecord(id, (x) => { x.data.kind = k; })}>${v}<//>`)}</div>`}
    ${r.type === 'potty' && html`<div class="pills">${Object.entries(POTTY).map(([k, v]) => html`<${Pill} on=${(d.result || 'ok') === k} onClick=${() => editRecord(id, (x) => { x.data.result = k; })}>${v}<//>`)}</div>`}
    ${r.end == null && html`<button class="btn btn-gray" onClick=${() => { closeSheet(); r.type === 'feed' ? finishFeed(id) : r.type === 'sleep' ? finishSleep(id) : finishRecord(id); }}>Закончить сейчас</button>`}
    <button class="btn btn-primary" onClick=${() => { track('запись:поправить'); closeSheet(); }}>Готово</button>
    <button class="btn-quiet" onClick=${() => { removeRecord(id); closeSheet(); toast({ text: 'Запись убрали', ms: 2000 }); }}>Удалить запись</button>
  `;
}

// ——— «Другая запись» ———
export function OtherSheet() {
  const s = useStore();
  const child = activeChild(s);
  const m = ageMonths(child, now());
  // Болеет — температура или лекарство за последние трое суток: эти записи первыми
  const sick = child && s.records.some((r) => r.childId === child.id && (r.type === 'temp' || r.type === 'med') && r.start > now() - 3 * 864e5);
  let items = [
    ['feed-bottle', 'Бутылочка', 'Объём кнопками'],
    ['feed-breast', 'Грудь', 'Таймер с выбранной груди'],
    ['pump', 'Сцеживание', 'Сколько мл'],
    ...(m >= 4 ? [['solids', 'Прикорм', 'Что попробовали']] : []),
    ...(m >= 12 ? [['diaper', 'Подгузник', 'Мокрый, грязный или оба'], ['sleep', 'Сон', 'Таймер или задним числом'], ['potty', 'Горшок', 'Получилось, мимо, посидели']] : []),
    ['visit', 'К врачу', 'Когда и к кому — напомним накануне'],
    ['measure', 'Замер', 'Вес, рост, окружность головы'],
    ['moment', 'Момент', 'Фото, фраза, что-то впервые'],
    ['temp', 'Температура', 'Градусы и время'],
    ['med', 'Лекарство', 'Название и время'],
    ['walk', 'Прогулка', 'Таймер или задним числом'],
    ['bath', 'Купание', 'Одним касанием'],
  ];
  if (sick) items = [...items.filter(([k]) => k === 'temp' || k === 'med'), ...items.filter(([k]) => k !== 'temp' && k !== 'med')];
  return html`
    <div class="h2">Записать</div>
    <div class="rows">
      ${items.map(([k, t, sub]) => html`<button class="row" onClick=${() => { track('запись:другая:' + k); if (k === 'visit') { closeSheet(); go('/rebyonok/zdorovye?zapis=1'); return; } openSheet(OtherForm, { kind: k }); }}><span class="row-text"><span class="row-title">${t}</span><span class="row-sub">${sub}</span></span><span class="chev">›</span></button>`)}
    </div>`;
}

function OtherForm({ kind }) {
  const [ml, setMl] = useState(kind === 'pump' ? 60 : ((getState().settings.lastFeed || {}).ml || 90));
  const [side, setSide] = useState('left');
  const [text, setText] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [t, setT] = useState(36.6);
  const [kindD, setKindD] = useState('wet');
  const [file, setFile] = useState(null);
  const ids = targets();
  const done = (made, msg) => { closeSheet(); recorded(made, msg); };
  const titles = { 'feed-bottle': 'Бутылочка', 'feed-breast': 'Грудь', pump: 'Сцеживание', solids: 'Прикорм', diaper: 'Подгузник', sleep: 'Сон', potty: 'Горшок', measure: 'Замер', moment: 'Момент', temp: 'Температура', med: 'Лекарство', walk: 'Прогулка', bath: 'Купание' };
  const body = {
    'feed-bottle': () => html`<${Stepper} value=${ml} step=${10} unit="мл" onChange=${setMl} /><button class="btn btn-primary" onClick=${() => done(addRecord(ids, 'feed', { method: 'bottle', ml }), `Записано: бутылочка ${ml} мл`)}>Записать</button>`,
    'feed-breast': () => html`<div class="pills"><${Pill} on=${side === 'left'} onClick=${() => setSide('left')}>Левая<//><${Pill} on=${side === 'right'} onClick=${() => setSide('right')}>Правая<//></div><button class="btn btn-primary" onClick=${() => { addRecord(ids, 'feed', { method: 'breast', side }, { timer: true }); closeSheet(); toast({ text: `Кормление идёт — ${SIDE[side]} грудь`, ms: 2500 }); }}>Начать</button>`,
    pump: () => html`<${Stepper} value=${ml} step=${10} unit="мл" onChange=${setMl} /><button class="btn btn-primary" onClick=${() => done(addRecord(ids, 'pump', { ml }), `Записано: сцеживание ${ml} мл`)}>Записать</button>`,
    solids: () => html`<${Field} label="Что попробовали" value=${text} onInput=${setText} placeholder="Кабачок" /><button class="btn btn-primary" disabled=${!text.trim()} onClick=${() => done(addRecord(ids, 'solids', { what: text.trim() }), `Записано: ${text.trim()}`)}>Записать</button>`,
    diaper: () => html`<div class="pills">${Object.entries(DIAPER).map(([k, v]) => html`<${Pill} on=${kindD === k} onClick=${() => setKindD(k)}>${v}<//>`)}</div><button class="btn btn-primary" onClick=${() => done(addRecord(ids, 'diaper', { kind: kindD }), `Записано: ${DIAPER[kindD]}`)}>Записать</button>`,
    sleep: () => html`<button class="btn btn-primary" onClick=${() => { closeSheet(); tapSleep(); }}>Начать сон сейчас</button><div class="small">Сон задним числом: начните и поправьте время в листе «Поправить».</div>`,
    potty: () => html`<button class="btn btn-primary" onClick=${() => { closeSheet(); tapPotty(); }}>Записать</button>`,
    measure: () => html`<${Field} label="Вес, кг" value=${weight} inputmode="decimal" placeholder="6,2" onInput=${setWeight} /><${Field} label="Рост, см" value=${height} inputmode="decimal" placeholder="61" onInput=${setHeight} /><button class="btn btn-primary" disabled=${!weight && !height} onClick=${() => done(addRecord(ids, 'measure', { weight: weight.replace(',', '.'), height: height.replace(',', '.') }), 'Записано: замер')}>Записать</button>`,
    moment: () => html`<label class="field"><span class="label">Что случилось</span><textarea value=${text} placeholder="Первый раз засмеялся в голос" onInput=${(e) => setText(e.target.value)}></textarea></label>
      <label class="btn btn-gray">${file ? 'Фото выбрано' : 'Добавить фото'}<input type="file" accept="image/*" style="display:none" onChange=${(e) => setFile(e.target.files[0])} /></label>
      <button class="btn btn-primary" disabled=${!text.trim() && !file} onClick=${async () => { const photo = file ? await savePhoto(file) : null; update((st) => { ids.forEach((cid) => st.moments.unshift({ id: uid(), childId: cid, text: text.trim(), photo, at: now() })); }); track('запись:момент'); closeSheet(); toast({ text: 'Момент сохранили — он в «Ребёнок → Моменты»', ms: 3000 }); }}>Сохранить</button>`,
    temp: () => html`<${Stepper} value=${t} step=${0.1} unit="°" fmt=${(v) => v.toFixed(1).replace('.', ',')} onChange=${setT} /><button class="btn btn-primary" onClick=${() => done(addRecord(ids, 'temp', { t: t.toFixed(1).replace('.', ',') }), `Записано: ${t.toFixed(1).replace('.', ',')}°`)}>Записать</button>`,
    med: () => html`<${Field} label="Лекарство" value=${text} onInput=${setText} placeholder="Как назвал врач" /><button class="btn btn-primary" disabled=${!text.trim()} onClick=${() => done(addRecord(ids, 'med', { name: text.trim() }), 'Записано: лекарство')}>Записать</button>`,
    walk: () => html`<button class="btn btn-primary" onClick=${() => { addRecord(ids, 'walk', {}, { timer: true }); closeSheet(); toast({ text: 'Прогулка идёт', ms: 2000 }); }}>Начать прогулку</button>`,
    bath: () => html`<button class="btn btn-primary" onClick=${() => done(addRecord(ids, 'bath', {}), 'Записано: купание')}>Записать</button>`,
  };
  return html`
    <button class="back" onClick=${() => openSheet(OtherSheet, {})}>‹ Другая запись</button>
    <div class="h2">${titles[kind]}</div>
    ${body[kind]()}
  `;
}
