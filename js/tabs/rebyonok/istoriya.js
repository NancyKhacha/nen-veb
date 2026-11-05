// «Ребёнок → Дневник»: история и итоги по каждому виду записи — сон, кормления, подгузники, еда, горшок
// (журнал, 5 ноября). Вход — плитками «Сегодня» на дашборде «Ребёнка» и из листов записи.
// Данные — те же записи, что пишет «Записать»; хранение не меняется.
import { html, useState } from '../../lib.js?v=25';
import { useStore, useTick, now, update } from '../../store.js?v=25';
import { Header, SecTitle, Row, openSheet, toast } from '../../ui.js?v=25';
import { DAY, startOfDay, dayKey, weekdayShort, hhmm, ageMonths, pl } from '../../age.js?v=25';
import { recordsOf, daySummary, sleepNorm, sideTimes, SIDE, DIAPER } from '../../records.js?v=25';
import { ARTICLES } from '../../content/articles.js?v=25';
import { Ill } from '../../ui.js?v=25';
import { EditSheet, tapSleep, tapFeed, tapDiaper, tapPotty, tapFood } from '../../strip.js?v=25';
import { go } from '../../router.js?v=25';
import { track } from '../../stats.js?v=25';
import { bornChild, nameOf, dayTitle, recTitle, recTime, durNoPad, NotBorn } from './util.js?v=25';

// Адрес → вид записи
export const KINDS = {
  son: { type: 'sleep', title: 'Сон', add: 'Записать сон', tap: tapSleep },
  kormleniya: { type: 'feed', title: 'Кормления', add: 'Записать кормление', tap: tapFeed },
  podguzniki: { type: 'diaper', title: 'Подгузники', add: 'Записать подгузник', tap: tapDiaper },
  eda: { type: 'food', title: 'Еда', add: 'Записать еду', tap: tapFood },
  gorshok: { type: 'potty', title: 'Горшок', add: 'Записать горшок', tap: tapPotty },
};
export const slugOf = (type) => Object.keys(KINDS).find((k) => KINDS[k].type === type);
export const historyPath = (type) => '/rebyonok/istoriya/' + slugOf(type);

// Записи этого вида: к кормлениям относим и сцеживание, к еде — прикорм
const matches = (type) => (r) => r.type === type || (type === 'feed' && r.type === 'pump') || (type === 'food' && r.type === 'solids');
const H = (ms) => ms / 3600e3;
const ago = (ms) => (ms < 60000 ? 'только что' : durNoPad(ms) + ' назад');

// Итог одного дня по виду записи
function dayValue(child, type, d, t) {
  if (type === 'sleep') return H(daySummary(child.id, d, t).sleep);
  return recordsOf(child.id).filter((r) => matches(type)(r) && r.type !== 'pump' && r.start >= d && r.start < d + DAY).length;
}

// Плашка «Сегодня»: главные цифры и последняя запись
function todayFacts(child, type, t) {
  const today = startOfDay(t);
  const all = recordsOf(child.id).filter(matches(type)).sort((a, b) => b.start - a.start);
  const day = all.filter((r) => r.start >= today);
  const last = all[0];
  const facts = [];
  let big;
  if (type === 'sleep') {
    const run = all.find((r) => r.end == null);
    const total = daySummary(child.id, today, t).sleep;
    big = total ? durNoPad(total) : '—';
    const naps = day.filter((r) => r.end != null);
    if (naps.length) facts.push(pl(naps.length, 'раз', 'раза', 'раз') + ' за день');
    const longest = naps.reduce((m, r) => Math.max(m, r.end - r.start), 0);
    if (longest) facts.push('самый долгий — ' + durNoPad(longest));
    if (run) facts.unshift('спит уже ' + durNoPad(t - run.start));
    else if (last && last.end) facts.unshift('не спит ' + durNoPad(t - last.end));
  } else if (type === 'feed') {
    const feeds = day.filter((r) => r.type === 'feed');
    big = String(feeds.length);
    const breast = feeds.filter((r) => (r.data || {}).method !== 'bottle');
    const bottle = feeds.filter((r) => (r.data || {}).method === 'bottle');
    if (breast.length) {
      // Минуты у каждой груди — по отрезкам кормления: в одно кормление бывают обе
      const st = breast.reduce((acc, r) => { const x = sideTimes(r, t); return { left: acc.left + x.left, right: acc.right + x.right }; }, { left: 0, right: 0 });
      const part = (ms) => (ms >= 60000 ? durNoPad(ms) : '—');
      facts.push(`грудь ${pl(breast.length, 'раз', 'раза', 'раз')}: левая ${part(st.left)}, правая ${part(st.right)}`);
    }
    if (bottle.length) facts.push(`бутылочка: ${bottle.length} · ${bottle.reduce((m, r) => m + (+(r.data || {}).ml || 0), 0)} мл`);
    const pump = day.filter((r) => r.type === 'pump');
    if (pump.length) facts.push(`сцедили ${pump.reduce((m, r) => m + (+(r.data || {}).ml || 0), 0)} мл`);
    if (feeds.length > 2) { const gap = (feeds[0].start - feeds[feeds.length - 1].start) / (feeds.length - 1); if (gap > 20 * 60000) facts.push('в среднем раз в ' + durNoPad(gap)); }
    const lf = all.find((r) => r.type === 'feed');
    if (lf) facts.unshift('последнее — ' + ago(t - lf.start) + ', в ' + hhmm(lf.start) + ((lf.data || {}).method === 'bottle' ? `, ${(lf.data || {}).ml || ''} мл` : lf.data && lf.data.side ? `, ${SIDE[lf.data.side]} грудь` : ''));
  } else if (type === 'diaper') {
    big = String(day.length);
    const k = (x) => day.filter((r) => ((r.data || {}).kind || 'wet') === x).length;
    const wet = k('wet') + k('both'); const dirty = k('dirty') + k('both');
    if (day.length) facts.push(`мокрых ${wet}, грязных ${dirty}`);
    if (last) facts.unshift('последний — ' + ago(t - last.start) + ', в ' + hhmm(last.start) + ', ' + (DIAPER[(last.data || {}).kind] || 'мокрый'));
  } else {
    big = String(day.length);
    if (last) facts.unshift('последний раз — ' + ago(t - last.start) + ', в ' + hhmm(last.start));
  }
  return { big, facts, any: all.length > 0 };
}

// «3 кормления», «5 подгузников», «10 ч сна»
function unitWord(type, big) {
  const n = parseInt(big, 10);
  if (type === 'sleep') return big === '—' ? 'сна пока нет' : 'сна';
  if (isNaN(n)) return '';
  const w = (a, b, c) => pl(n, a, b, c).replace(/^\d+\s*/, '');
  return type === 'feed' ? w('кормление', 'кормления', 'кормлений') : type === 'diaper' ? w('подгузник', 'подгузника', 'подгузников') : w('раз', 'раза', 'раз');
}

// Ритм дня: сутки полоской — сон отрезками, остальное отметками (как «Rhythm» у May Baby, но проще)
function DayRhythm({ child, type, t }) {
  const d0 = startOfDay(t);
  const W = 320; const x = (ms) => 6 + Math.max(0, Math.min(1, (ms - d0) / DAY)) * (W - 12);
  const recs = recordsOf(child.id).filter((r) => matches(type)(r) && (r.end ?? t) >= d0 && r.start < d0 + DAY);
  return html`
    <svg class="rb-rhythm" viewBox=${`0 0 ${W} 34`} role="img" aria-label="Когда за сутки">
      <rect x="6" y="10" width=${W - 12} height="10" rx="5" class="track" />
      ${recs.map((r) => (type === 'sleep'
        ? html`<rect x=${x(r.start)} y="10" width=${Math.max(4, x(r.end ?? t) - x(r.start))} height="10" rx="5" class="seg" />`
        : html`<circle cx=${x(r.start)} cy="15" r="5" class=${'pt' + (r.type === 'pump' ? ' light' : '')} />`))}
      <line x1=${x(t)} x2=${x(t)} y1="6" y2="24" class="now" />
      ${[[0, '0'], [0.5, '12'], [1, '24']].map(([k, l]) => html`<text x=${6 + k * (W - 12)} y="33" class="lbl" text-anchor=${k === 0 ? 'start' : k === 1 ? 'end' : 'middle'}>${l}</text>`)}
    </svg>`;
}

// Статьи НЭН по теме и возрасту — прямо в истории, как «Learn more» у May Baby
const TOPIC = { sleep: [/сон|сна\b|спит|засып|ноч/, 'sleep'], feed: [/корм|груд|бутыл|смес|молок/, 'food'], food: [/еда|ест\b|прикорм|питан|аппетит/, 'food'], potty: [/горш/, null], diaper: [/подгуз|стул|какает|запор/, null] };
function readFor(type, m) {
  const [rx, topic] = TOPIC[type] || [];
  if (!rx) return [];
  const fit = (a) => a.fromM >= 0 && a.fromM <= m && m <= a.toM;
  return ARTICLES.filter((a) => fit(a) && (rx.test(a.title.toLowerCase()) || (topic && (a.topics || []).includes(topic) && rx.test((a.lead || '').toLowerCase())))).slice(0, 3);
}

function Bars({ bars, norm, unit }) {
  const W = 340, Hh = 160, L = 30, T = 22, B = 24;
  const max = Math.max(...bars.map((b) => b.v), norm ? norm[1] + 1 : 0, unit === 'ч' ? 8 : 4);
  const y = (v) => T + (1 - v / max) * (Hh - T - B);
  const bw = (W - L - 6) / bars.length;
  const ticks = norm ? [norm[1], norm[0]] : [Math.round(max), Math.round(max / 2)];
  return html`
    <svg viewBox=${`0 0 ${W} ${Hh}`} role="img" aria-label="По дням">
      ${norm && html`<rect x=${L} y=${y(norm[1])} width=${W - L - 4} height=${y(norm[0]) - y(norm[1])} class="band" />`}
      ${ticks.map((v) => html`<text x="2" y=${y(v) + 4} class="lbl">${v}${unit === 'ч' ? ' ч' : ''}</text>`)}
      ${bars.map((b, i) => html`
        <g onClick=${b.onClick} style="cursor:pointer">
          <rect x=${L + i * bw + bw * 0.2} y=${y(b.v)} width=${bw * 0.6} height=${Math.max(b.v ? 3 : 0, y(0) - y(b.v))} rx="6" class=${'bar' + (b.today ? ' light' : '')} />
          ${b.v ? html`<text x=${L + i * bw + bw / 2} y=${y(b.v) - 4} class="lbl" text-anchor="middle">${unit === 'ч' ? String(Math.round(b.v * 10) / 10).replace('.', ',') : b.v}</text>` : ''}
          <text x=${L + i * bw + bw / 2} y=${Hh - 6} class="lbl" text-anchor="middle">${b.label}</text>
        </g>`)}
    </svg>`;
}

function History({ params }) {
  const s = useStore();
  useTick(30000);
  const kind = KINDS[params.slug] || KINDS.kormleniya;
  const { type } = kind;
  const child = bornChild(s);
  const [days, setDays] = useState(3);
  if (!child) return html`<${NotBorn} title=${kind.title} text="История появится, когда малыш родится." />`;
  const t = now();
  const today = startOfDay(t);
  const f = todayFacts(child, type, t);
  const week = Array.from({ length: 7 }, (_, i) => startOfDay(today - (6 - i) * DAY + 3 * 3600e3));
  const bars = week.map((d) => ({ v: dayValue(child, type, d, t), label: weekdayShort(d), today: d === today, onClick: () => { track('история:день'); go('/rebyonok/dnevnik?den=' + dayKey(d)); } }));
  const past = bars.filter((b) => !b.today && b.v);
  const avg = past.length ? past.reduce((m, b) => m + b.v, 0) / past.length : 0;
  const norm = type === 'sleep' ? sleepNorm(ageMonths(child, t)) : null;
  const unit = type === 'sleep' ? 'ч' : '';
  const recs = recordsOf(child.id).filter(matches(type)).sort((a, b) => b.start - a.start);
  const groups = [];
  for (const r of recs) {
    const d = startOfDay(r.start);
    let g = groups[groups.length - 1];
    if (!g || g.d !== d) { if (groups.length >= days) break; g = { d, list: [] }; groups.push(g); }
    g.list.push(r);
  }
  const moreDays = new Set(recs.map((r) => startOfDay(r.start))).size > groups.length;
  const avgText = !avg ? '' : type === 'sleep' ? `В среднем ${durNoPad(avg * 3600e3)} в сутки за неделю.` : `В среднем ${String(Math.round(avg * 10) / 10).replace('.', ',')} в день за неделю.`;
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">${kind.title}</h1>
      <div class="card rb-today">
        <div class="tiny">Сегодня · ${nameOf(child)}</div>
        <div class="rb-big">${f.big}<span>${unitWord(type, f.big)}</span></div>
        ${f.facts.map((x) => html`<div class="rb-fact">${x}</div>`)}
        ${f.any && html`<${DayRhythm} child=${child} type=${type} t=${t} />`}
        ${!f.any && html`<p class="small">Пока ни одной записи.</p>`}
        <button class="btn btn-primary rb-add-top" onClick=${() => { track('история:записать'); kind.tap(); }}>＋ ${kind.add}</button>
      </div>
      <${SecTitle}>Неделя<//>
      <div class="rb-chart">
        <${Bars} bars=${bars} norm=${norm} unit=${unit} />
        <p class="tiny">${[avgText, norm ? `Полоса — ориентир возраста: ${norm[0]}–${norm[1]} ч в сутки, бывает и больше, и меньше.` : '', 'Сегодня в среднее не входит — день ещё не кончился.'].filter(Boolean).join(' ')}</p>
      </div>
      ${(() => { const list = readFor(type, ageMonths(child, t)); return list.length ? html`
        <${SecTitle}>Почитать<//>
        <div class="feed">${list.map((a) => html`<button key=${a.id} class="feed-card" onClick=${() => { track('история:статья'); go('/statya/' + a.id); }}><${Ill} id=${a.id} keep seed=${a.id} /><span class="t">${a.title}</span></button>`)}</div>` : ''; })()}
      ${groups.map((g) => html`
        <${SecTitle}>${dayTitle(g.d, t)} · ${pl(g.list.length, 'запись', 'записи', 'записей')}<//>
        <div class="rows">${g.list.map((r) => html`<${Row} key=${r.id} title=${recTitle(r)} sub=${recTime(r)} onClick=${() => { track('история:запись'); openSheet(EditSheet, { id: r.id }); }} />`)}</div>`)}
      ${moreDays && html`<button class="rb-more" onClick=${() => { track('история:ещё'); setDays(days + 7); }}>Ещё дни ›</button>`}
      ${type === 'sleep' && html`<button class="rb-more" onClick=${() => { track('история:сон-месяц'); go('/rebyonok/dnevnik/son?vid=mesyac'); }}>Сон по месяцам ›</button>`}
      ${type === 'diaper' && html`<button class="btn-quiet" onClick=${() => { update((d) => { d.childPrefs = d.childPrefs || {}; d.childPrefs[child.id] = { ...(d.childPrefs[child.id] || {}), noDiapers: true, potty: true }; }); track('история:без-подгузников'); toast({ text: 'Подгузники убрали, вместо них — горшок. Вернуть — в профиле, «Быстрая запись»', ms: 4000, actions: [{ label: 'Отменить', onClick: () => update((d) => { d.childPrefs[child.id] = { ...(d.childPrefs[child.id] || {}), noDiapers: false }; }) }] }); go('/rebyonok/istoriya/gorshok', { replace: true }); }}>Уже без подгузников — ходим на горшок</button>`}
    </div>`;
}

// Плитки «Сегодня» на дашборде «Ребёнка»: что было за день и сколько прошло с последней записи
// Коротко для плитки: «7 ч назад», «спит 20 мин», «не спит 3 ч»
function tileLine(child, type, t) {
  const all = recordsOf(child.id).filter((r) => matches(type)(r) && r.type !== 'pump').sort((a, b) => b.start - a.start);
  const last = all[0];
  if (!last) return 'нет записей';
  const short = (ms) => (ms < 60000 ? 'только что' : durNoPad(ms).replace(/(\d+ ч) \d+ мин/, '$1'));
  if (type === 'sleep') return last.end == null ? 'спит ' + short(t - last.start) : 'не спит ' + short(t - last.end);
  const x = short(t - last.start);
  return x === 'только что' ? x : x + ' назад';
}

export function TodayTiles({ child, types }) {
  useTick(30000);
  const t = now();
  return html`
    <div class="rb-tiles">
      ${types.map((type) => {
        const f = todayFacts(child, type, t);
        const kind = KINDS[slugOf(type)];
        return html`
          <div class="rb-tile">
            <button class="rb-tile-main" onClick=${() => { track('ребёнок:история-' + type); go(historyPath(type)); }}>
              <span class="l">${kind.title}</span>
              <b>${f.big}</b>
              <span class="s">${tileLine(child, type, t)}</span>
            </button>
            <button class="rb-tile-add" aria-label=${kind.add} onClick=${() => { track('ребёнок:плитка-записать-' + type); kind.tap(); }}>＋</button>
          </div>`;
      })}
    </div>`;
}

export const istoriyaRoutes = [
  { path: '/rebyonok/istoriya/:slug', view: History, tab: '/rebyonok', strip: true },
];
