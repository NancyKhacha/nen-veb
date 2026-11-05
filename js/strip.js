// Запись: лист «Записать» по левой кнопке меню (журнал, 5 ноября: полосы над меню больше нет),
// плашки идущей записи и листы «Кормление», «Поправить» и формы остальных записей.
import { html, useState, useRef } from './lib.js?v=17';
import { useStore, useTick, activeChild, update, now, getState, savePhoto, uid } from './store.js?v=17';
import { ageMonths, clock, hhmm, dur, startOfDay } from './age.js?v=17';
import { addRecord, finishRecord, removeRecord, editRecord, switchSide, lastOf, ongoing, sinceLine, describe, whenText, recentTypes, sideTimes, breastLine, SIDE, DIAPER, POTTY } from './records.js?v=17';
import { openSheet, closeSheet, toast, Pill, Field, KidsBar } from './ui.js?v=17';
import { playNoise, usePlayer, playing, stop as stopPlayer } from './player.js?v=17';
import { track } from './stats.js?v=17';
import { go } from './router.js?v=17';
import { quickTypes, recordAllowed } from './stages.js?v=17';

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
    <button class="btn-quiet" onClick=${() => { closeSheet(); go('/rebyonok/istoriya/son'); }}>Вся история сна ›</button>`;
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

// Кормление — всегда листом, где виден способ (журнал, 5 ноября: раньше касание молча повторяло
// прошлый способ — бутылочку или другую грудь, и это путало)
export function tapFeed(tab) {
  const ids = targets(); if (!ids.length) return;
  const run = ongoing(ids[0]).find((r) => r.type === 'feed');
  track(run ? 'запись:кормление-идёт' : 'запись:кормление-лист');
  openSheet(FeedSheet, { runId: run ? run.id : null, tab });
}
export function finishFeed(id) {
  finishRecord(id);
  const r = getState().records.find((x) => x.id === id);
  track('запись:кормление-закончить');
  recorded([id], `Записано: грудь — ${breastLine(r)}`);
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
  // По возрасту — stages.js: до года сон, кормление, подгузник; на втором году — еда вместо
  // кормления; на третьем — горшок вместо подгузника; с трёх лет быстрых записей нет
  const m = ageMonths(child, now());
  const hidden = s.settings.hiddenButtons || [];
  const buttons = quickTypes(m);
  return { buttons: buttons.filter((b) => !hidden.includes(b)), line: m >= 36 };
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
  // «7 ч 48 мин» → «7 ч»: на плитке коротко, подробности — в истории
  const short = (x) => String(x || '').replace(/(\d+ ч) \d+ мин/, '$1');
  let a = '';
  if (run) a = 'идёт ' + clock(now() - run.start);
  else if (since && type === 'sleep') a = since.a === 'только что' ? 'только проснулись' : 'не спит ' + short(since.a);
  else if (since) a = [short(since.a), since.b].filter(Boolean).join(' · ');
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

// ——— Лист «Записать» — левая кнопка меню. Название — вся история вида, «＋» — записать сейчас ———
function hubStatus(child, type) {
  const run = ongoing(child.id).find((r) => r.type === type);
  if (run) return 'идёт ' + dur(now() - run.start);
  const since = sinceLine(child.id, type, now());
  if (!since) return 'ещё не записывали';
  const short = (x) => String(x || '').replace(/(\d+ ч) \d+ мин/, '$1');
  if (type === 'sleep') return since.a === 'только что' ? 'только проснулись' : 'не спит ' + short(since.a);
  return [short(since.a) + (since.a === 'только что' ? '' : ' назад'), since.b].filter(Boolean).join(' · ');
}
export function RecordHub() {
  const s = useStore();
  useTick(15000);
  const child = activeChild(s);
  const born = child && !child.expecting;
  const { buttons } = stripButtons(child, s);
  const types = born ? buttons : [];
  return html`
    <div class="h2">Записать${s.children.length > 1 && child ? html` <span class="hub-for">для ${child.name || 'малыша'}</span>` : ''}</div>
    ${s.children.length > 1 && html`<${KidsBar} compact />`}
    <div class="rows hub">
      <button class="row" onClick=${() => { track('записать:заметка'); closeSheet(); go('/zametka'); }}>
        <span class="row-text"><span class="row-title">Заметка</span><span class="row-sub">Мысль, вопрос к врачу — своими словами</span></span><span class="hub-add" aria-hidden="true">＋</span>
      </button>
      ${types.map((type) => html`
        <div class="row hub-row">
          <button class="hub-main" onClick=${() => { track('записать:история-' + type); closeSheet(); go('/rebyonok/istoriya/' + HIST[type][0]); }}>
            <span class="row-text"><span class="row-title">${LABEL[type]}</span><span class="row-sub">${hubStatus(child, type)} · история ›</span></span>
          </button>
          <button class="hub-add" aria-label=${'Записать: ' + LABEL[type]} onClick=${() => { track('записать:' + type); closeSheet(); TAP[type](); }}>＋</button>
        </div>`)}
      ${born && otherItems(s, child).filter(([k]) => !types.includes(k)).map(([k, t, sub]) => html`
        <button class="row" key=${k} onClick=${() => openOther(k)}><span class="row-text"><span class="row-title">${t}</span><span class="row-sub">${sub}</span></span><span class="chev">›</span></button>`)}
    </div>
    ${born && html`<p class="tiny">«＋» — записать сейчас. Касание названия — вся история.</p>`}`;
}

// Идёт сон, кормление или прогулка — короткая плашка над меню на всех экранах, кроме «Сегодня»
export function RunningPill() {
  const s = useStore();
  useTick(1000);
  const r = s.records.find((x) => x.end == null && (x.type === 'sleep' || x.type === 'feed' || x.type === 'walk'));
  if (!r) return null;
  const c = s.children.find((x) => x.id === r.childId);
  const label = r.type === 'sleep' ? 'Сон' : r.type === 'feed' ? 'Кормление' : 'Прогулка';
  const done = () => { if (r.type === 'sleep') finishSleep(r.id); else if (r.type === 'feed') finishFeed(r.id); else { finishRecord(r.id); recorded([r.id], 'Записано: прогулка'); } };
  return html`
    <div class="run-pill">
      <button class="run-main" onClick=${() => (r.type === 'feed' ? openSheet(FeedSheet, { runId: r.id }) : openSheet(EditSheet, { id: r.id }))}><i></i><b>${label}${s.children.length > 1 && c ? ' · ' + c.name : ''}</b><span>${clock(now() - r.start)}</span></button>
      <button class="run-stop" onClick=${() => { track('плашка-меню:закончить'); done(); }}>Закончить</button>
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
          <div class="plaque-top"><span class="plaque-title">Кормление · ${SIDE[r.data.side]} грудь${who}</span><span class="plaque-time">${clock(now() - r.start)}</span></div>
          <div class="small">С ${hhmm(r.start)} · ${breastLine(r)}</div>
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
// ——— Лист «Кормление»: грудь, бутылочка, сцеживание и прикорм — в одном месте ———
const ML = [60, 90, 120, 150];
const AGO = [[0, 'Сейчас'], [15, '15 мин назад'], [30, '30 мин назад'], [60, 'Час назад']];
export function FeedSheet({ runId, tab: tab0 }) {
  const s = useStore();
  useTick(1000);
  const child = activeChild(s);
  const t = now();
  const m = child ? ageMonths(child, t) : 0;
  const ids = targets();
  const lf = s.settings.lastFeed || {};
  const run = (runId && s.records.find((x) => x.id === runId && x.end == null)) || (child && ongoing(child.id).find((r) => r.type === 'feed'));
  const [tab, setTab] = useState(tab0 || (run ? 'breast' : lf.method === 'bottle' ? 'bottle' : 'breast'));
  const [manual, setManual] = useState(false);
  const [mins, setMins] = useState({ left: 10, right: 0 });
  const [ml, setMl] = useState(lf.ml || 90);
  const [milk, setMilk] = useState(lf.milk || 'formula');
  const [pumpSide, setPumpSide] = useState('both');
  const [pumpMl, setPumpMl] = useState(60);
  const [ago, setAgo] = useState(0);
  const [what, setWhat] = useState('');
  const lastFeed = child && lastOf(child.id, 'feed');
  const lastBreast = child && s.records.filter((r) => r.childId === child.id && r.type === 'feed' && (r.data || {}).method !== 'bottle' && r.end != null).sort((x, y) => y.start - x.start)[0];
  const next = lastBreast && (lastBreast.data || {}).side === 'left' ? 'right' : 'left';
  const at = t - ago * 60000;
  const prevLine = lastFeed ? `В прошлый раз — ${(lastFeed.data || {}).method === 'bottle' ? `бутылочка ${(lastFeed.data || {}).ml || ''} мл` : 'грудь, ' + breastLine(lastFeed, t)}, ${whenText(lastFeed, t).replace(/^Сегодня /, 'сегодня ')}` : 'Это первое кормление в дневнике.';
  const tabs = [['breast', 'Грудь'], ['bottle', 'Бутылочка'], ['pump', 'Сцеживание'], ...(m >= 4 && m < 12 ? [['solids', 'Прикорм']] : [])];
  const When = () => html`<div class="label">Когда</div><div class="pills">${AGO.map(([k, l]) => html`<${Pill} on=${ago === k} onClick=${() => setAgo(k)}>${l}<//>`)}</div>`;
  const save = (type, data, msg, opts) => { const made = addRecord(ids, type, data, opts || { start: at }); closeSheet(); recorded(made, msg); };

  // Идёт кормление грудью: две груди с временем, смена касанием, «Закончить»
  if (run) {
    const st = sideTimes(run, t);
    const cur = (run.data || {}).side;
    return html`
      <div class="h2">Кормление идёт · ${clock(t - run.start)}</div>
      <p class="small">Касание другой груди — переключить. Время у каждой считаем отдельно.</p>
      <div class="feed-sides">
        ${['left', 'right'].map((sd) => html`
          <button class=${'feed-side' + (cur === sd ? ' on' : '')} onClick=${() => { if (cur !== sd) { track('кормление:сменить'); switchSide(run.id); } }}>
            <span class="l">${sd === 'left' ? 'Левая' : 'Правая'}</span>
            <b>${clock(st[sd])}</b>
            <span class="s">${cur === sd ? 'сейчас' : 'переключить'}</span>
          </button>`)}
      </div>
      <button class="btn btn-primary" onClick=${() => { closeSheet(); finishFeed(run.id); }}>Закончить</button>
      <button class="btn-quiet" onClick=${() => { removeRecord(run.id); closeSheet(); track('кормление:отменить'); toast({ text: 'Кормление убрали', ms: 2000 }); }}>Отменить это кормление</button>`;
  }

  return html`
    <div class="h2">Кормление</div>
    <p class="small">${prevLine}</p>
    <div class="seg feed-tabs">${tabs.map(([k, l]) => html`<button class=${tab === k ? 'on' : ''} onClick=${() => { setTab(k); track('кормление:вкладка-' + k); }}>${l}</button>`)}</div>

    ${tab === 'breast' && !manual && html`
      <p class="small">С какой груди начинаете? Время пойдёт сразу.</p>
      <div class="feed-sides">
        ${['left', 'right'].map((sd) => html`
          <button class=${'feed-side' + (sd === next ? ' next' : '')} onClick=${() => { track('кормление:начать-' + sd); addRecord(ids, 'feed', { method: 'breast', side: sd, log: [{ side: sd, start: now() }] }, { timer: true }); }}>
            <span class="l">${sd === 'left' ? 'Левая' : 'Правая'}</span>
            <b>▶</b>
            <span class="s">${sd === next && lastBreast ? 'по очереди — эта' : 'начать'}</span>
          </button>`)}
      </div>
      <button class="btn-quiet" onClick=${() => setManual(true)}>Уже покормили — записать без таймера</button>`}

    ${tab === 'breast' && manual && html`
      <div class="label">Сколько минут</div>
      ${['left', 'right'].map((sd) => html`<div class="feed-row"><span>${sd === 'left' ? 'Левая' : 'Правая'}</span><${Stepper} value=${mins[sd]} step=${5} unit="мин" onChange=${(v) => setMins({ ...mins, [sd]: v })} /></div>`)}
      <${When} />
      <button class="btn btn-primary" disabled=${!mins.left && !mins.right} onClick=${() => {
        const total = (mins.left + mins.right) * 60000; const start = at - total;
        const first = mins.left ? 'left' : 'right'; const log = [{ side: first, start }];
        if (mins.left && mins.right) log.push({ side: 'right', start: start + mins.left * 60000 });
        track('кормление:грудь-вручную');
        save('feed', { method: 'breast', side: log[log.length - 1].side, log }, `Записано: грудь — ${[mins.left && 'левая ' + mins.left + ' мин', mins.right && 'правая ' + mins.right + ' мин'].filter(Boolean).join(', ')}`, { start, end: at });
      }}>Записать</button>
      <button class="btn-quiet" onClick=${() => setManual(false)}>С таймером</button>`}

    ${tab === 'bottle' && html`
      <div class="label">Что в бутылочке</div>
      <div class="pills"><${Pill} on=${milk === 'formula'} onClick=${() => setMilk('formula')}>Смесь<//><${Pill} on=${milk === 'expressed'} onClick=${() => setMilk('expressed')}>Сцеженное молоко<//></div>
      <div class="label">Сколько</div>
      <div class="pills">${ML.map((v) => html`<${Pill} on=${ml === v} onClick=${() => setMl(v)}>${v} мл<//>`)}</div>
      <${Stepper} value=${ml} step=${10} unit="мл" onChange=${setMl} />
      <${When} />
      <button class="btn btn-primary" onClick=${() => { track('кормление:бутылочка'); save('feed', { method: 'bottle', ml, milk }, `Записано: бутылочка ${ml} мл, ${milk === 'formula' ? 'смесь' : 'сцеженное'}`); }}>Записать ${ml} мл</button>`}

    ${tab === 'pump' && html`
      <div class="label">Какая грудь</div>
      <div class="pills">${[['left', 'Левая'], ['right', 'Правая'], ['both', 'Обе']].map(([k, l]) => html`<${Pill} on=${pumpSide === k} onClick=${() => setPumpSide(k)}>${l}<//>`)}</div>
      <div class="label">Сколько</div>
      <${Stepper} value=${pumpMl} step=${10} unit="мл" onChange=${setPumpMl} />
      <${When} />
      <button class="btn btn-primary" onClick=${() => { track('кормление:сцеживание'); save('pump', { ml: pumpMl, side: pumpSide }, `Записано: сцеживание ${pumpMl} мл`); }}>Записать ${pumpMl} мл</button>`}

    ${tab === 'solids' && html`
      <${Field} label="Что попробовали" value=${what} onInput=${setWhat} placeholder="Кабачок" />
      <${When} />
      <button class="btn btn-primary" disabled=${!what.trim()} onClick=${() => { track('кормление:прикорм'); save('solids', { what: what.trim() }, `Записано: ${what.trim()}`); }}>Записать</button>`}
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

// История вида записи — «Ребёнок → Дневник» (istoriya.js)
const HIST = { sleep: ['son', 'Вся история сна'], feed: ['kormleniya', 'Все кормления'], pump: ['kormleniya', 'Все кормления'], diaper: ['podguzniki', 'Все подгузники'], food: ['eda', 'Вся еда'], solids: ['eda', 'Вся еда'], potty: ['gorshok', 'Весь горшок'] };

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
    ${HIST[r.type] && html`<button class="btn-quiet" onClick=${() => { closeSheet(); go('/rebyonok/istoriya/' + HIST[r.type][0]); }}>${HIST[r.type][1]} ›</button>`}
  `;
}

// ——— «Другая запись» ———
// Все остальные виды записи — сразу списком в «Записать», как в первой веб-версии (журнал, 5 ноября)
function otherItems(s, child) {
  const m = ageMonths(child, now());
  // Болеет — температура или лекарство за последние трое суток: эти записи первыми
  const sick = child && s.records.some((r) => r.childId === child.id && (r.type === 'temp' || r.type === 'med') && r.start > now() - 3 * 864e5);
  // Бутылочка, грудь, сцеживание, а до года и прикорм — во вкладках листа «Кормление» (замечание Марии Даниной)
  // Что записывают в этом возрасте — stages.js (RECORD_AGES): грудь — до трёх лет, подгузник — до четырёх,
  // горшок — до пяти; кружки и дела — у дошкольников и школьников
  let items = [
    ...(m >= 12 ? [['feed', 'Кормление', 'Грудь, бутылочка, сцеживание'], ['solids', 'Прикорм', 'Что попробовали']] : []),
    ...(m >= 12 ? [['diaper', 'Подгузник', 'Мокрый, грязный или оба'], ['sleep', 'Сон', 'Таймер или задним числом'], ['potty', 'Горшок', 'Получилось, мимо, посидели']] : []),
    ['task', 'Дело или напоминание', 'Справка, оплата, родительское собрание'],
    ['club', 'Кружок или секция', 'Дни, время, что взять с собой'],
    ['visit', 'К врачу', 'Когда и к кому — напомним накануне'],
    ['measure', 'Замер', m < 36 ? 'Вес, рост, окружность головы' : 'Вес и рост'],
    ['moment', 'Момент', m < 36 ? 'Фото, фраза, что-то впервые' : 'Фото, фраза, рисунок, победа'],
    ['temp', 'Температура', 'Градусы и время'],
    ['med', 'Лекарство', 'Название и время'],
    ['walk', 'Прогулка', 'Таймер или задним числом'],
    ['bath', 'Купание', 'Одним касанием'],
  ].filter(([k]) => recordAllowed(k, m));
  if (sick) items = [...items.filter(([k]) => k === 'temp' || k === 'med'), ...items.filter(([k]) => k !== 'temp' && k !== 'med')];
  return items;
}
const openOther = (k) => {
  track('запись:другая:' + k);
  if (k === 'visit') { closeSheet(); go('/rebyonok/zdorovye?zapis=1'); return; }
  if (k === 'feed') { tapFeed(); return; }
  if (k === 'club') { closeSheet(); go('/rebyonok/kruzhki?novyy=1'); return; }
  if (k === 'task') { const c = activeChild(getState()); import('./tabs/rebyonok/dnevnik.js?v=17').then((mod) => mod.openNewTask(c, startOfDay(now()))); return; }
  openSheet(OtherForm, { kind: k });
};
// Прежний лист «Другая запись» — теперь тот же «Записать»: один список на всё
export const OtherSheet = (props) => RecordHub(props);

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
    <button class="back" onClick=${() => openSheet(RecordHub, {})}>‹ Записать</button>
    <div class="h2">${titles[kind]}</div>
    ${body[kind]()}
  `;
}
