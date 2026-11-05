// Детали «Сегодня»: неделя, итог, карточка дня, «Для вас», «На этой неделе», погода и листы.
import { html, useState, useEffect } from '../../lib.js?v=24';
import { useStore, update, uid, now, getState } from '../../store.js?v=24';
import { DAY, startOfDay, dayKey, weekdayShort, weekdayLong, dateWithWeekday, hhmm, diffYMD } from '../../age.js?v=24';
import { Row, SecTitle, Ill, Pill, Field, SaveButton, openSheet, closeSheet, toast } from '../../ui.js?v=24';
import { cover, coverOfUrl } from '../../content/covers.js?v=24';
import { go } from '../../router.js?v=24';
import { track } from '../../stats.js?v=24';
import { selectWear, WEAR_SOURCES, WEAR_WEATHER, WEAR_MODES, wearCat, wearNow } from '../../content/segodnya-wear.js?v=24';
import { ROUTES, seg, lowerFirst, whenLine, articleByUrl, shortUrl, diseasesOf } from './logic.js?v=24';
import { weatherLine, describeCode, staleLabel, WeatherIcon, isOffline } from './weather.js?v=24';

// ——— Состояние вкладки ———
export function setSeg(fn) { update((d) => { d.segodnya = d.segodnya || {}; fn(d.segodnya, d); }); }
export function markOpened(id) { setSeg((g) => { g.opened = { ...(g.opened || {}), [id]: now() }; }); }

export function dismiss(key) {
  update((d) => { d.dismissed = d.dismissed || []; if (!d.dismissed.includes(key)) d.dismissed.push(key); });
  track('сегодня:не-показывать');
  toast({
    text: 'Убрали — на этом месте будет другое',
    actions: [{ label: 'Вернуть', onClick: () => update((d) => { d.dismissed = (d.dismissed || []).filter((k) => k !== key); }) }],
  });
}

// ——— Неделя ———
export function WeekStrip({ days }) {
  const t = now();
  return html`
    <div class="week">
      <div class="week-head">
        <span>${dateWithWeekday(t)}</span>
        <button onClick=${() => { track('сегодня:вся-неделя'); go(ROUTES.week); }}>Вся неделя ›</button>
      </div>
      <div class="days">
        ${days.map((d) => html`
          <button class=${'day' + (d.today ? ' today' : '')} aria-label=${dateWithWeekday(d.t)}
            onClick=${() => { track('сегодня:неделя-день'); go(ROUTES.day(d.t)); }}>
            <span class="dn">${weekdayShort(d.t)}</span>
            <span class="dd">${new Date(d.t).getDate()}</span>
            <span class="marks">${d.rec && html`<i class="mark"></i>`}${d.plan && html`<i class="mark plan"></i>`}</span>
          </button>`)}
      </div>
    </div>`;
}

// ——— Итог дня и строки под ним ———
export function Total({ lines, t }) {
  return html`
    <button class="total" onClick=${() => { track('сегодня:итог'); go(ROUTES.day(t)); }}>
      <span>${lines.map((l, i) => html`${i ? html`<br />` : ''}${l}`)}</span><span class="chev">›</span>
    </button>`;
}
export function Note({ children, onClick }) {
  return onClick
    ? html`<button class="quote sg-note" onClick=${onClick}>${children}</button>`
    : html`<div class="quote sg-note">${children}</div>`;
}

// Карточка про статью — с её обложкой
const artId = (c) => (c && c.key && c.key.startsWith('article:') ? c.key.slice(8) : null);

// ——— Карточка дня: одна большая ———
export function DayCard({ card }) {
  if (!card) return null;
  const open = card.path ? () => { track('сегодня:карточка-дня:' + card.kind); if (card.onOpen) card.onOpen(); go(card.path); } : null;
  const Main = html`
    ${card.ill !== false && html`<${Ill} id=${artId(card)} from=${card.source} />`}
    ${card.label && html`<div class="tiny">${card.label}</div>`}
    <div class=${'h2' + (card.title.length > 80 ? ' sg-long' : '')}>${card.title}</div>
    ${card.text && html`<p class="p sg-text">${card.text}</p>`}`;
  return html`
    <div class=${'card sg-day' + (card.done ? ' sg-done' : '')}>
      ${open ? html`<button class="sg-day-main" onClick=${open}>${Main}</button>` : html`<div class="sg-day-main">${Main}</div>`}
      <div class="actions sg-actions">
        ${(card.actions || []).map((a) => html`<button onClick=${a.onClick}>${a.label}</button>`)}
        ${card.save && html`<${SaveButton} item=${card.save} />`}
        ${card.dismissKey && html`<button class="sg-dismiss" onClick=${() => dismiss(card.dismissKey)}>Не показывать</button>`}
      </div>
    </div>`;
}

// ——— Лента «Для вас» ———
export function Feed({ cards }) {
  if (!cards.length) return null;
  // Одна картинка — один раз в ленте: у фактов из одной статьи обложка общая
  const used = new Set();
  const pic = (c) => { const u = artId(c) ? cover(artId(c)) : coverOfUrl(c.source); if (!u || used.has(u)) return null; used.add(u); return u; };
  return html`
    <${SecTitle} more="Все" onMore=${() => { track('сегодня:для-вас-все'); go('/segodnya/dlya-vas'); }}>Для вас<//>
    <div class="feed">
      ${cards.map((c) => html`
        <button class="feed-card" key=${c.key} onClick=${() => { track('сегодня:для-вас:' + c.kind); if (c.onOpen) c.onOpen(); if (c.path) go(c.path); }}>
          <${Ill} src=${pic(c)} seed=${c.key + c.title} keep />
          ${c.label && html`<span class="tiny">${c.label}</span>`}
          <span class="t">${c.title}</span>
        </button>`)}
    </div>`;
}

// ——— Когда: день недели и время кнопками, без клавиатуры ———
const TIMES = ['9:00', '12:00', '18:00'];
export function useWhen(init = {}) {
  const [d, setD] = useState(init.d ?? 0);
  const [tm, setTm] = useState(init.tm ?? 'none');
  const [other, setOther] = useState(init.other || '10:00');
  const sod = startOfDay(now());
  const hm = tm === 'none' ? null : (tm === 'other' ? other : tm);
  const [h, m] = (hm || '0:0').split(':').map(Number);
  const when = sod + d * DAY + (hm ? (h * 60 + m) * 60000 : 0);
  return { d, setD, tm, setTm, other, setOther, when, time: !!hm };
}
export function WhenPicker({ w, needTime = false, label = 'Когда' }) {
  const sod = startOfDay(now());
  return html`
    <div class="label">${label}</div>
    <div class="pills">
      ${Array.from({ length: 7 }, (_, i) => html`<${Pill} on=${w.d === i} onClick=${() => w.setD(i)}>${i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : weekdayLong(sod + i * DAY)}<//>`)}
    </div>
    <div class="label">Время</div>
    <div class="pills">
      ${!needTime && html`<${Pill} on=${w.tm === 'none'} onClick=${() => w.setTm('none')}>Без времени<//>`}
      ${TIMES.map((x) => html`<${Pill} on=${w.tm === x} onClick=${() => w.setTm(x)}>${x}<//>`)}
      ${w.tm === 'other'
        ? html`<input type="time" class="pill on" value=${w.other.padStart(5, '0')} onChange=${(e) => e.target.value && w.setOther(e.target.value.replace(/^0(\d)/, '$1'))} />`
        : html`<${Pill} on=${false} onClick=${() => w.setTm('other')}>Другое<//>`}
    </div>`;
}
const whenSaid = (when, time) => lowerFirst(whenLine(when, time));

// ——— Лист «Новое дело» ———
const PRESETS = [['Прогулка', 'walk'], ['Врач', 'doctor'], ['Анализы', 'tests'], ['Купить', 'buy']];
export function NewTaskSheet({ childId, d = 0 }) {
  const [what, setWhat] = useState(null);
  const [own, setOwn] = useState('');
  const w = useWhen({ d });
  const title = own.trim() || what;
  const add = () => {
    const id = uid();
    const kind = own.trim() ? 'own' : (PRESETS.find((p) => p[0] === what) || [])[1] || 'own';
    update((s) => { s.tasks = s.tasks || []; s.tasks.push({ id, childId, title, when: w.when, time: w.time, kind, done: null, at: now() }); });
    track('сегодня:дело-добавить:' + kind);
    closeSheet();
    toast({ text: `Добавлено: ${whenSaid(w.when, w.time)}`, actions: [{ label: 'Отменить', onClick: () => update((s) => { s.tasks = s.tasks.filter((x) => x.id !== id); }) }] });
  };
  return html`
    <div class="h2">Новое дело</div>
    <div class="label">Что</div>
    <div class="pills">${PRESETS.map(([l]) => html`<${Pill} on=${what === l && !own.trim()} onClick=${() => { setWhat(l); setOwn(''); }}>${l}<//>`)}</div>
    <${Field} label="Или своё название" value=${own} onInput=${setOwn} placeholder="Например, забрать анализы" />
    <${WhenPicker} w=${w} />
    <button class="btn btn-primary" disabled=${!title} onClick=${add}>Добавить</button>`;
}

// ——— Лист своего дела: «Получилось?», «Перенести», «Сделали» ———
export function TaskSheet({ id }) {
  const s = useStore();
  const x = (s.tasks || []).find((k) => k.id === id);
  const [moving, setMoving] = useState(false);
  const w = useWhen({ d: 0, tm: x && x.time ? 'other' : 'none', other: x && x.time ? hhmm(x.when) : '10:00' });
  if (!x) return html`<div class="h2">Дело убрали</div><button class="btn btn-gray" onClick=${closeSheet}>Закрыть</button>`;
  const set = (fn, msg) => { update((st) => { const k = st.tasks.find((y) => y.id === id); if (k) fn(k); }); closeSheet(); if (msg) toast({ text: msg, ms: 2500 }); };
  const past = x.time ? x.when <= now() : startOfDay(x.when) < startOfDay(now());
  if (moving) return html`
    <div class="h2">Перенести</div>
    <div class="small">${x.title}</div>
    <${WhenPicker} w=${w} />
    <button class="btn btn-primary" onClick=${() => { track('сегодня:дело-перенести'); set((k) => { k.when = w.when; k.time = w.time; k.done = null; k.skipped = null; }, `Перенесли: ${whenSaid(w.when, w.time)}`); }}>Перенести</button>`;
  return html`
    <div class="h2">${x.title}</div>
    <div class="small">${whenLine(x.when, x.time)}</div>
    ${past && !x.done ? html`
      <div class="label">Получилось?</div>
      <div class="pills">
        <button class="pill" onClick=${() => { track('сегодня:дело-да'); set((k) => { k.done = now(); }, 'Отметили'); }}>Да</button>
        <button class="pill" onClick=${() => { track('сегодня:дело-нет'); set((k) => { k.skipped = now(); }, 'Ничего, бывает'); }}>Нет</button>
        <button class="pill" onClick=${() => setMoving(true)}>Перенести</button>
      </div>` : html`
      <button class="btn btn-primary" onClick=${() => { track('сегодня:дело-сделали'); set((k) => { k.done = now(); }, 'Отметили'); }}>Сделали</button>
      <button class="btn btn-gray" onClick=${() => setMoving(true)}>Перенести</button>`}
    <button class="btn-quiet" onClick=${() => { closeSheet(); go(ROUTES.day(x.when)); }}>Этот день в «Дневнике»</button>
    <button class="btn-quiet" onClick=${() => {
      const copy = { ...x };
      update((st) => { st.tasks = st.tasks.filter((k) => k.id !== id); });
      closeSheet();
      toast({ text: 'Дело убрали', actions: [{ label: 'Вернуть', onClick: () => update((st) => { st.tasks.push(copy); }) }] });
    }}>Убрать дело</button>`;
}

// ——— Лист прививки: «Записались», «Сделали» ———
export function VaccineSheet({ group, childIds, planned }) {
  const [step, setStep] = useState(planned ? 'menu' : 'menu');
  const w = useWhen({ d: 0, tm: '9:00' });
  const mark = (status, when, msg) => {
    update((d) => {
      d.vaccineMarks = d.vaccineMarks || {};
      for (const id of group.ids) d.vaccineMarks[id] = { status, at: now(), when, childIds };
    });
    track('сегодня:прививка-' + (status === 'done' ? 'сделали' : 'записались'));
    closeSheet();
    toast({ text: msg, ms: 3000 });
  };
  const unplan = () => {
    update((d) => { for (const id of group.ids) delete (d.vaccineMarks || {})[id]; });
    closeSheet();
    toast({ text: 'Запись убрали — прививка снова в «На этой неделе»', ms: 3000 });
  };
  if (step === 'plan') return html`
    <div class="h2">${group.title}</div>
    <div class="small">На когда записались?</div>
    <${WhenPicker} w=${w} needTime=${false} />
    <button class="btn btn-primary" onClick=${() => mark('planned', w.when, `Записались: ${whenSaid(w.when, w.time)}. Накануне напомним в «Что нового»`)}>Записались</button>`;
  return html`
    <div class="h2">${group.title}</div>
    <div class="small">${planned ? whenLine(group.when, true) + ' · записались' : `От ${diseasesOf(group.items)}. ${group.sub.replace(/\. Записаться и отметить$/, '')}.`}</div>
    ${!planned && html`<p class="small">Сроки считаются от даты рождения.</p>`}
    ${planned ? html`
      <button class="btn btn-primary" onClick=${() => mark('done', now(), 'Отметили: прививку сделали')}>Сделали</button>
      <button class="btn btn-gray" onClick=${() => setStep('plan')}>Перенести</button>
      <button class="btn-quiet" onClick=${unplan}>Не записаны</button>` : html`
      <button class="btn btn-primary" onClick=${() => setStep('plan')}>Записались</button>
      <button class="btn btn-gray" onClick=${() => mark('done', now(), 'Отметили: прививку сделали')}>Сделали</button>`}
    <button class="btn-quiet" onClick=${() => { closeSheet(); go(ROUTES.health); }}>Все прививки — в «Здоровье»</button>`;
}

// ——— Лист осмотра по графику ———
export function CheckupSheet({ item, childId }) {
  const [step, setStep] = useState('menu');
  const w = useWhen({ d: 0, tm: '9:00' });
  if (step === 'plan') return html`
    <div class="h2">${item.title}</div>
    <div class="small">На когда записались?</div>
    <${WhenPicker} w=${w} />
    <button class="btn btn-primary" onClick=${() => {
      update((s) => { s.tasks = s.tasks || []; s.tasks.push({ id: uid(), childId, title: item.title, when: w.when, time: w.time, kind: 'doctor', checkup: item.checkup, done: null, at: now() }); });
      track('сегодня:осмотр-записались');
      closeSheet();
      toast({ text: `Записались: ${whenSaid(w.when, w.time)}. Накануне напомним в «Что нового»`, ms: 3000 });
    }}>Записались</button>`;
  return html`
    <div class="h2">${item.title}</div>
    <div class="small">${item.sub.replace(/\. Записаться и отметить$/, '.')}</div>
    <button class="btn btn-primary" onClick=${() => setStep('plan')}>Записались</button>
    <button class="btn btn-gray" onClick=${() => { const age = Number(item.checkup.slice(1)); update((st) => { st.rebyonok = st.rebyonok || {}; const c = (st.rebyonok.checkups = st.rebyonok.checkups || {}); c[childId] = { ...(c[childId] || {}), [age]: now() }; }); track('сегодня:осмотр-был'); closeSheet(); toast({ text: 'Отметили', ms: 2000 }); }}>Уже были</button>
    <button class="btn-quiet" onClick=${() => { closeSheet(); go(ROUTES.health); }}>Здоровье ребёнка</button>`;
}

// ——— «На этой неделе» ———
export function ThisWeek({ items, onAdd }) {
  return html`
    <${SecTitle}>На этой неделе<//>
    <div class="rows">
      ${items.map((it) => html`<${Row} key=${it.key} title=${it.title} sub=${it.sub} onClick=${it.onClick} />`)}
      <${Row} title="＋ Добавить дело" sub="На любой день недели" onClick=${onAdd} />
    </div>`;
}

// ——— Погода и «Что надеть» ———
export function WeatherCard({ wear = true, child }) {
  const s = useStore();
  const w = s.weather;
  const city = s.settings.city || 'Москва';
  const off = isOffline();
  const stale = w && (off || Date.now() - w.at > 2 * 3600e3);
  const tap = wear ? () => { track('сегодня:погода'); openSheet(WearSheet, { childId: child && child.id }); } : null;
  const body = html`
    <${WeatherIcon} kind=${w ? describeCode(w.code).icon : 'cloud'} />
    <span class="sg-wtext">
      <span class="h3">${w && w.city === city ? weatherLine(w) : (off ? 'Прогноз придёт, когда появится сеть' : 'Узнаём погоду…')}</span>
      ${w && w.city === city && stale ? html`<span class="small">${staleLabel(w)}</span>` : ''}
    </span>
    ${wear && html`<span class="sg-wear">Что надеть ›</span>`}`;
  // Город — своей кнопкой под погодой: сменить можно прямо здесь (журнал, 5 ноября)
  return html`
    <div class="card-gray sg-weather-wrap">
      ${tap ? html`<button class="sg-weather" onClick=${tap}>${body}</button>` : html`<div class="sg-weather">${body}</div>`}
      <button class="sg-city" onClick=${() => { track('сегодня:город'); go('/profil/gorod'); }}>${city} · сменить</button>
    </div>`;
}

export function WearSheet({ childId }) {
  const s = useStore();
  const child = s.children.find((c) => c.id === childId);
  const m = child && !child.expecting ? diffYMD(child.dob, now()).months : 0;
  const infant = m < 12;
  const choice = seg(s).wear || {};
  const set = (k, v) => { setSeg((g) => { g.wear = { ...(g.wear || {}), [k]: v }; }); track('сегодня:что-надеть:' + k); };
  const w = s.weather;
  const city = s.settings.city || 'Москва';
  const known = w && w.city === city && typeof w.t === 'number';
  // Погоду знаем — не спрашиваем; нет прогноза — тогда спросим
  const cat = known ? wearCat(w.t) : (choice.cat || null);
  const icon = known ? describeCode(w.code).icon : null;
  const precip = icon === 'rain' || icon === 'storm' ? 'rain' : icon === 'snow' ? 'snow' : null;
  const mode = choice.mode || (m < 24 ? 'stroller' : 'walk');
  const now0 = cat ? wearNow({ cat, age: m < 24 ? 'baby' : 'kid', mode, precip, windy: known && w.wind >= 7 }) : null;
  const sel = cat ? selectWear({ cat: cat === 'hardfrost' ? 'frost' : cat, mode, activity: m < 12 ? 'inactive' : 'active', sling: 'under' }, infant) : { advice: [], related: ['GUL', 'WIN', 'ZH'] };
  const openSrc = (id) => { const src = WEAR_SOURCES[id]; const a = articleByUrl(src.url); track('что-надеть:статья'); if (a) { closeSheet(); go(ROUTES.article(a.id)); } else window.open(src.url, '_blank', 'noopener'); };
  return html`
    <div class="h2">Что надеть</div>
    ${known ? html`<p class="small">Сейчас ${weatherLine(w)} · ${city}</p>` : html`
      <p class="small">Прогноза пока нет — какая погода на улице?</p>
      <div class="pills">${WEAR_WEATHER.map(([k, l]) => html`<${Pill} on=${choice.cat === k} onClick=${() => set('cat', k)}>${l}<//>`)}</div>`}
    <div class="pills wear-mode">${WEAR_MODES.map(([k, l]) => html`<${Pill} on=${mode === k} onClick=${() => set('mode', k)}>${l}<//>`)}</div>
    ${now0 && html`
      <div class="card wear-now">
        <ul class="wear-list">${now0.layers.map((x) => html`<li>${x}</li>`)}</ul>
        <p class="small">${now0.rule}${infant ? ' Проверьте шею сзади: тёплая и сухая — всё хорошо.' : ''}</p>
      </div>`}
    ${sel.advice.length > 0 && html`
      <div class="label">Советы НЭН</div>
      ${sel.advice.map((a, i, arr) => html`<button class="note-box sg-advice wear-quote" onClick=${() => openSrc(a.src)}>«${a.text}»${(i === arr.length - 1 || arr[i + 1].src !== a.src) ? html`<span class="wear-src">${WEAR_SOURCES[a.src].title} ›</span>` : ''}</button>`)}`}
    <div class="label">Почему так — почитать</div>
    <div class="rows">${sel.related.map((id) => html`<${Row} key=${id} title=${WEAR_SOURCES[id].title} sub=${isOffline() ? 'Нужна сеть' : ''} onClick=${() => openSrc(id)} />`)}</div>
  `;
}
