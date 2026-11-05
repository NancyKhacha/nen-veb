// Вкладка «Для себя» — раздел о самом родителе (бриф docs/razdely/dlya-sebya.md,
// Фигма «34 · V3 · Для себя», экраны 1–18). Главный экран меняется по времени суток:
// днём полный состав, вечером — вечерние практики, ночью — тёмный экран с ночными практиками.
import { html, useState, useEffect } from '../lib.js?v=18';
import { useStore, update, getState, activeChild, now, uid, isSaved, toggleSaved, useTick } from '../store.js?v=18';
import { Header, Back, Row, SecTitle, Ill, Pill, SaveButton, openSheet, closeSheet, toast } from '../ui.js?v=18';
import { go, back } from '../router.js?v=18';
import { track } from '../stats.js?v=18';
import { usePlayer } from '../player.js?v=18';
import { stripButtons } from '../strip.js?v=18';
import { partOfDay, diffYMD, dateLong, weekdayShort, startOfDay, fromKey, clock, DAY, pl } from '../age.js?v=18';
import {
  PRACTICES, practiceById, locked, hasPlus, isDownloaded, startPractice, stopPractice, pauseOrResume, skipStep,
  isRunning, usePractice, elapsedSec, totalSec, stepAt, stepText, savedItem,
} from './dlya-sebya/minutka.js?v=18';
import {
  PODBORKI, podborkaById, ORDER_FIRST_YEAR, ORDER_LATER, ORDER_NO_CHILD, TESTS, TOPIC_TESTS, HELP, PHONES,
  anyArticle, articleRoute, rowText,
} from '../content/dlya-sebya-podborki.js?v=18';
import { STATI } from '../content/dlya-sebya-stati.js?v=18';

// ——— Общее ———
const ds = (s = getState()) => s.dlyaSebya || {};
const isOffline = (s = getState()) => !!(s.demo && s.demo.offline) || (typeof navigator !== 'undefined' && navigator.onLine === false);
function useOffline() {
  const s = useStore();
  const [, f] = useState(0);
  useEffect(() => {
    const on = () => f((x) => x + 1);
    window.addEventListener('online', on); window.addEventListener('offline', on);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', on); };
  }, []);
  return isOffline(s);
}
const NEED_NET = 'Нужна сеть';
const netToast = (what = 'Откроется') => toast({ text: `${NEED_NET}. ${what}, когда появится интернет`, ms: 3000 });

// Статья доступна без сети, если сохранена или уже открывалась на этом телефоне (экран 18)
const readable = (id, s = getState()) => !isOffline(s) || isSaved('article', id) || !!(ds(s).read || {})[id];
function openArticle(id) {
  if (!readable(id)) { netToast(); return; }
  update((s) => { s.dlyaSebya = s.dlyaSebya || {}; s.dlyaSebya.read = { ...(s.dlyaSebya.read || {}), [id]: Date.now() }; });
  track('для себя:статья');
  go(articleRoute(id));
}
const articleItem = (a) => ({ kind: 'article', id: a.id, title: a.title, sub: '', route: articleRoute(a.id) });
const firstSentence = (t) => { const m = /^(.{40,220}?[.!?])\s/.exec(t || ''); return m ? m[1] : t; };
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const dateFull = (t) => `${dateLong(t)} ${new Date(t).getFullYear()}`;

// Подборки — по младшему рождённому ребёнку и по фактическому возрасту (экраны 9, 15, 16)
function podborkiOrder(s) {
  const born = s.children.filter((c) => !c.expecting && c.dob);
  if (!born.length) return ORDER_NO_CHILD;
  const dob = Math.max(...born.map((c) => c.dob));
  return diffYMD(dob, now()).months < 12 ? ORDER_FIRST_YEAR : ORDER_LATER;
}

// Полоса записи — как на «Сегодня», но с трёх лет её здесь нет (экран 9)
function showStrip() {
  const s = getState();
  const c = activeChild(s);
  if (!c || c.expecting) return false;
  return !stripButtons(c, s).line;
}

// После ночи с частыми пробуждениями утром первой — «После бессонной ночи» (путь Б).
// Порог — вопрос редакции и психолога; здесь — четыре и больше снов за ночь.
function heavyNight(s) {
  const c = activeChild(s);
  if (!c || c.expecting) return false;
  const t = now();
  const h = new Date(t).getHours();
  if (h < 7 || h >= 11) return false;
  const from = startOfDay(t) - 2 * 3600000; const to = startOfDay(t) + 7 * 3600000;
  return s.records.filter((r) => r.childId === c.id && r.type === 'sleep' && r.start >= from && r.start < to).length >= 4;
}

const FEED = {
  day: ['tri-minuty-na-kuhne', 'dyhanie-4-6', 'opustit-plechi', 'ya-zlyus'],
  evening: ['blagodarnost-sebe', 'pered-snom', 'dyhanie-4-6', 'tri-minuty-na-kuhne'],
  night: ['trevoga-nochyu', 'pauza-vo-vremya-kormleniya', 'dyhanie-4-6'],
};
const NIGHT_SHORT = ['trevoga-nochyu', 'pauza-vo-vremya-kormleniya'];

// ——— Практики ———
function openPractice(id) {
  const p = practiceById(id);
  const s = getState();
  if (!p) return;
  if (locked(p, s)) { track('для себя:плюс'); openSheet(PlusSheet, { id }); return; }
  if (isOffline(s) && !isDownloaded(id, s)) { netToast('Практика скачается'); return; }
  if (!isRunning(id)) startPractice(id);
  go('/dlya-sebya/minutka/' + id);
}

// Строка под названием практики: длительность, «Плюс», «скачано», «Нужна сеть», «Шум остановится»
function practiceLine(p, { s, offline, noise, part, long = false }) {
  if (isRunning(p.id)) {
    const left = Math.min(p.min, Math.max(1, Math.round((totalSec(p) - elapsedSec()) / 60)));
    return { text: `Идёт · ещё ${left} мин`, off: false };
  }
  if (offline && !isDownloaded(p.id, s)) return { text: NEED_NET, off: true };
  if (noise) return { text: 'Шум остановится', off: false };
  let t = `${p.min} мин`;
  if (long || (part === 'night' && NIGHT_SHORT.includes(p.id))) t += ` · ${p.short}`;
  if (locked(p, s)) t += ' · Плюс';
  else if (offline) t += ' · скачано';
  return { text: t, off: false };
}

function PracticeCard({ id, ctx }) {
  const p = practiceById(id);
  const line = practiceLine(p, ctx);
  return html`
    <button class=${'feed-card' + (line.off ? ' ds-off' : '')} onClick=${() => openPractice(id)}>
      <${Ill} keep seed=${id + p.title} />
      <span class="tiny">${line.text}</span>
      <span class="t">${p.title}</span>
    </button>`;
}
function PracticeRow({ id, ctx }) {
  const p = practiceById(id);
  const line = practiceLine(p, { ...ctx, long: true });
  return html`<div class=${line.off ? 'ds-off' : ''}><${Row} title=${p.title} sub=${line.text} onClick=${() => openPractice(id)} /></div>`;
}

function useCtx() {
  const s = useStore();
  const offline = useOffline();
  const pl = usePlayer();
  const noise = !!(pl && /white|pink/.test(pl.id || ''));
  return { s, offline, noise, part: partOfDay(now()) };
}

// ——— Лист практики из Плюса (экран 14) ———
function PlusSheet({ id }) {
  const p = practiceById(id);
  return html`
    <div class="h2">${p.title}</div>
    <p class="small">${p.min} мин · в Плюсе</p>
    <span class="label">Что внутри</span>
    <p class="p">${p.sub} Эта запись доступна с Плюсом.</p>
    <span class="label">Бесплатно всегда</span>
    <div class="pills">
      ${['dyhanie-4-6', 'tri-minuty-na-kuhne'].map((f) => html`<button class="pill" onClick=${() => { closeSheet(); openPractice(f); }}>${practiceById(f).title}</button>`)}
    </div>
    <button class="btn btn-primary" onClick=${() => { track('для себя:что даёт плюс'); openSheet(PlusInfo); }}>Что даёт Плюс</button>`;
}
function PlusInfo() {
  return html`
    <div class="h2">НЭН Плюс</div>
    <p class="p">В Плюсе вся библиотека сказок, колыбельных и «Минутки для себя». Бесплатно — базовая подборка и все звуки.</p>
    <p class="p">Платный Клуб включает Плюс.</p>
    <p class="small">В пробной версии приложения Плюс не продаётся. Бесплатные практики, «Как вы?», заметки, подборки и «Если тяжело» работают целиком.</p>
    <button class="btn btn-gray" onClick=${closeSheet}>Понятно</button>`;
}

// ——— «Как вы?» (экраны 1, 2, 7) ———
// Ответ нигде не сохраняется: живёт только в памяти, пока приложение открыто.
let answerNow = null; // { day, key }
const ANSWERS = [['good', 'Хорошо'], ['tired', 'Нет сил'], ['anxious', 'Тревожно'], ['hard', 'Тяжело']];
const HELP_ROW = { title: 'Если тяжело', sub: 'Так бывает у многих. Что можно сделать сейчас' };

function answerContent(key, part, s) {
  const order = podborkiOrder(s);
  const first = podborkaById(order[0]).items.find((it) => anyArticle(it.id));
  switch (key) {
    case 'good': return {
      lead: 'Хорошо, что так. Если есть пара минут — это для вас.',
      items: part === 'evening' ? [{ practice: 'blagodarnost-sebe' }] : [{ article: first }],
    };
    case 'tired': return {
      lead: 'Тяжёлый день. Вот что можно сделать за пару минут.',
      items: [{ practice: 'tri-minuty-na-kuhne' }, { article: { id: 'kak-byt-roditeliu-v-depressii', t: 'Нет сил заботиться', s: 'О родителе, которого накрыла депрессия' } }],
    };
    case 'anxious': return {
      lead: 'Тревожно — так бывает. Вот что можно сделать за пару минут.',
      items: [{ practice: part === 'night' ? 'trevoga-nochyu' : 'dyhanie-4-6' }],
    };
    default: return {
      lead: 'Так бывает у многих. Вот что можно сделать сейчас.',
      items: [{ help: true }, { practice: 'rebenok-plachet-sil-net' }],
      helpFirst: true,
    };
  }
}

function ArticleRow({ item, s }) {
  const r = rowText(item);
  if (!r) return null;
  const ok = readable(item.id, s);
  return html`<div class=${ok ? '' : 'ds-off'}><${Row} title=${r.t} sub=${ok ? r.s : NEED_NET} onClick=${() => openArticle(item.id)} /></div>`;
}
const HelpRow = () => html`<${Row} title=${HELP_ROW.title} sub=${HELP_ROW.sub} onClick=${() => { track('для себя:если тяжело'); go('/dlya-sebya/esli-tyazhelo'); }} />`;

function KakVyBlock({ ctx }) {
  const day = startOfDay(now());
  const [key, setKey] = useState(answerNow && answerNow.day === day ? answerNow.key : null);
  const pick = (k) => {
    const next = key === k ? null : k;
    answerNow = next ? { day, key: next } : null;
    setKey(next);
    if (next) track('для себя:как вы');
  };
  const c = key && answerContent(key, ctx.part, ctx.s);
  const off = ds(ctx.s).kakVy && ds(ctx.s).kakVy.off;
  return html`
    <div class="card ds-kakvy">
      ${off ? html`<button class="label ds-link" onClick=${() => go('/dlya-sebya/kak-vy')}>Как вы? · анкета раз в месяц ›</button>` : null}
      <div class="h2">Как вы сегодня?</div>
      <div class="ds-answers">
        ${ANSWERS.map(([k, l]) => html`<button class=${'ds-answer' + (key === k ? ' on' : '')} aria-pressed=${key === k} onClick=${() => pick(k)}>${l}</button>`)}
      </div>
      ${c && html`
        <p class="p">${c.lead}</p>
        <div class="rows ds-in-card">
          ${c.items.map((it) => it.practice ? html`<${PracticeRow} id=${it.practice} ctx=${ctx} />`
            : it.article ? html`<${ArticleRow} item=${it.article} s=${ctx.s} />`
            : html`<${HelpRow} />`)}
          ${!c.helpFirst && html`<${HelpRow} />`}
        </div>`}
      <span class="tiny">Ответ нигде не сохраняется</span>
    </div>`;
}

// Раз в месяц — приглашение к анкете (экран 7). Впервые — на четвёртый день, потом раз в месяц.
function inviteDue(s) {
  const k = ds(s).kakVy || {};
  if (k.off) return false;
  const due = k.next || (s.createdAt || Date.now()) + 3 * DAY;
  return now() >= due;
}
function setKakVy(patch) { update((s) => { s.dlyaSebya = s.dlyaSebya || {}; s.dlyaSebya.kakVy = { ...(s.dlyaSebya.kakVy || {}), ...patch }; }); }
function MonthlyInvite() {
  return html`
    <div class="card">
      <span class="label">Раз в месяц</span>
      <div class="h2">Как вы?</div>
      <p class="p">Раз в месяц мы спрашиваем о вас, а не о малыше. Десять коротких вопросов, около пяти минут.</p>
      <p class="small">Отвечать не обязательно. Ответы остаются только в этом телефоне.</p>
      <div class="actions">
        <button onClick=${() => { track('для себя:анкета ответить'); go('/dlya-sebya/kak-vy'); }}>Ответить</button>
        <button style="font-weight:500" onClick=${() => { track('для себя:анкета не сейчас'); setKakVy({ next: now() + 30 * DAY }); toast({ text: 'Хорошо. Напомним через месяц.', ms: 3000 }); }}>Не сейчас</button>
        <button style="font-weight:500" onClick=${() => {
          track('для себя:анкета не напоминать');
          setKakVy({ off: true });
          toast({ text: 'Больше не напомним. «Как вы?» остаётся в разделе «Для себя» — можно ответить, когда захочется.', ms: 5000, actions: [{ label: 'Отменить', onClick: () => setKakVy({ off: false }) }] });
        }}>Не напоминать</button>
      </div>
    </div>`;
}

// ——— Заметки (строка на главном) ———
// Общий ключ s.notes: { id, text, at }. Первая строка текста — название заметки.
const noteTitle = (n) => (n.text || '').split('\n')[0].trim() || 'Без названия';
const noteBody = (n) => (n.text || '').split('\n').slice(1).join('\n').trim();
const notesSorted = (s) => [...(s.notes || [])].sort((a, b) => b.at - a.at);
function NotesRow({ s }) {
  const last = notesSorted(s)[0];
  return html`<${Row} title="Заметки" sub=${last ? `Последняя — «${noteTitle(last)}», ${dateLong(last.at)}` : 'Сохраните свои вопросы, планы и мысли'}
    onClick=${() => { track('для себя:заметки'); go('/dlya-sebya/zametki'); }} />`;
}

// ——— Главный экран (экраны 1, 5, 6, 7, 9, 11, 13–17) ———
function Home() {
  usePractice();
  useTick(30000);
  const ctx = useCtx();
  const { s, part, offline } = ctx;

  if (part === 'night') {
    return html`
      <div class="screen">
        <${Header} />
        <${SecTitle}>Минутка для себя<//>
        <div class="feed">${FEED.night.map((id) => html`<${PracticeCard} key=${id} id=${id} ctx=${ctx} />`)}</div>
        <div class="rows"><${HelpRow} /></div>
      </div>`;
  }

  let feed = FEED[part] || FEED.day;
  if (part === 'day' && heavyNight(s)) feed = ['posle-bessonnoy-nochi', ...feed];
  const order = podborkiOrder(s);
  return html`
    <div class="screen">
      <${Header} />
      ${inviteDue(s) ? html`<${MonthlyInvite} />` : html`<${KakVyBlock} ctx=${ctx} />`}
      <div class="rows"><${NotesRow} s=${s} /></div>

      <${SecTitle} more="Все" onMore=${() => { track('для себя:все практики'); go('/dlya-sebya/minutka'); }}>Минутка для себя<//>
      <div class="feed">${feed.map((id) => html`<${PracticeCard} key=${id} id=${id} ctx=${ctx} />`)}</div>

      <${SecTitle} more="Все" onMore=${() => { track('для себя:все подборки'); go('/dlya-sebya/podborki'); }}>Подборки<//>
      <div class="feed">
        ${order.slice(0, 4).map((id) => html`
          <button key=${id} class="feed-card" onClick=${() => { track('для себя:подборка'); go('/dlya-sebya/podborka/' + id); }}>
            <${Ill} id=${(podborkaById(id).items[0] || {}).id} keep /><span class="tiny">${pl(podborkaById(id).items.length, 'статья', 'статьи', 'статей')}</span><span class="t">${podborkaById(id).title}</span>
          </button>`)}
      </div>

      <${SecTitle} more="Все" onMore=${() => { track('для себя:все тесты'); go('/dlya-sebya/testy'); }}>Тесты<//>
      <div class="feed">${TESTS.slice(0, 4).map((t) => html`<${TestCard} key=${t.id} test=${t} offline=${offline} />`)}</div>

      <div class="rows"><${HelpRow} /></div>
    </div>`;
}

function openTest(t) {
  if (isOffline()) { netToast('Тест откроется'); return; }
  track('для себя:тест');
  window.open(t.url, '_blank', 'noopener');
}
function TestCard({ test, offline }) {
  return html`
    <button class=${'feed-card' + (offline ? ' ds-off' : '')} onClick=${() => openTest(test)}>
      <${Ill} keep from=${test.url} seed=${test.id} /><span class="tiny">${offline ? NEED_NET : 'Тест'}</span><span class="t">${test.title}</span>
    </button>`;
}

// ——— Минутка играет (экран 3) ———
function MinutkaScreen({ params }) {
  const p = practiceById(params.id);
  const run = usePractice();
  useTick(1000);
  const ctx = useCtx();
  const [full, setFull] = useState(false);
  const blocked = p && (locked(p, ctx.s) || (ctx.offline && !isDownloaded(p.id, ctx.s)));
  useEffect(() => { if (p && !blocked && (!run || run.id !== p.id || run.done)) startPractice(p.id); }, [params.id]);

  if (!p) return html`<div class="screen"><${Back} title="Минутка для себя" /><p class="empty">Такой практики нет.</p><button class="btn btn-gray" onClick=${() => go('/dlya-sebya/minutka')}>Все практики</button></div>`;

  if (locked(p, ctx.s)) {
    return html`<div class="screen"><${Back} /><div class="stack"><${PlusSheet} id=${p.id} /></div></div>`;
  }
  if (blocked) {
    const ready = PRACTICES.filter((x) => !locked(x, ctx.s) && isDownloaded(x.id, ctx.s));
    return html`
      <div class="screen">
        <${Back} title=${p.title} />
        <p class="lead">Эта практика ещё не скачана — нужна сеть. Скачается сама, когда появится интернет.</p>
        ${ready.length > 0 && html`<${SecTitle}>Уже в телефоне<//><div class="rows">${ready.map((x) => html`<${PracticeRow} id=${x.id} ctx=${ctx} />`)}</div>`}
        <div class="rows"><${HelpRow} /></div>
      </div>`;
  }

  const mine = run && run.id === p.id;
  const total = totalSec(p);
  const el = mine ? (run.done ? total : elapsedSec()) : 0;
  const at = stepAt(p, el);
  const { text, hint } = stepText(p, at.i);
  const left = Math.min(p.min, Math.max(1, Math.round((total - el) / 60)));
  const paused = mine && !!run.pausedAt;
  const status = !mine ? `${p.min} мин · ${p.short}` : run.done ? 'Практика закончилась' : `${paused ? 'Пауза' : 'Играет'} · ещё ${left} мин из ${p.min}`;
  const saved = isSaved('practice', p.id);
  const save = () => { const added = toggleSaved(savedItem(p)); track('сохранить:practice'); toast({ text: added ? 'Сохранено — под сердечком в шапке' : 'Убрали из сохранённого', ms: 2500, actions: added ? [{ label: 'Отменить', onClick: () => toggleSaved(savedItem(p)) }] : [] }); };
  const isCry = p.id === 'rebenok-plachet-sil-net';

  return html`
    <div class="screen">
      <${Back} />
      <h1 class="h1" style="font-size:24px">${p.title}</h1>
      <p class="small">${status}</p>
      <div class="ds-bar"><i style=${`width:${Math.min(100, (el / total) * 100)}%`}></i></div>

      ${mine && !run.done && html`
        <span class="label">Сейчас</span>
        <div class="card-gray ds-now">
          <p class="ds-step">${text}</p>
          ${hint && html`<p class="small">${hint}</p>`}
          ${at.quiet && at.left > 3 && html`<p class="tiny">Тишина · ${clock(at.left * 1000)}</p>`}
        </div>
        <div class="pills">
          <button class="pill" onClick=${pauseOrResume}>${paused ? 'Продолжить' : 'Пауза'}</button>
          <button class="pill" onClick=${() => { stopPractice(); back('/dlya-sebya'); }}>Стоп</button>
          <button class="pill" onClick=${save}>${saved ? '♥ В избранном' : '♡ В избранное'}</button>
        </div>
        <button class="link ds-left" onClick=${skipStep}>Следующий шаг ›</button>`}

      ${mine && run.done && html`
        <div class="card-gray">
          <p class="ds-step">Практика закончилась.</p>
          <div class="actions">
            <button onClick=${() => startPractice(p.id)}>Ещё раз</button>
            ${!saved && html`<button onClick=${save}>♡ Сохранить</button>`}
          </div>
        </div>`}

      ${!mine && html`
        <div class="pills">
          <button class="pill" onClick=${() => startPractice(p.id)}>Начать заново</button>
          <button class="pill" onClick=${save}>${saved ? '♥ В избранном' : '♡ В избранное'}</button>
        </div>`}

      ${isCry && html`
        <span class="label">Ещё</span>
        <div class="pills"><button class="pill" onClick=${() => { track('для себя:если тяжело'); go('/dlya-sebya/esli-tyazhelo'); }}>Если тяжело ›</button></div>
        <p class="small">8-800-2000-122 · 124 с мобильного — детский телефон доверия, помогает и родителям. 103 — скорая.</p>`}

      <p class="small">${p.sub}</p>

      <button class="link ds-left" onClick=${() => { setFull(!full); if (!full) track('для себя:минутка текст'); }}>${full ? 'Свернуть текст' : 'Весь текст практики'}</button>
      ${full && html`<div class="prose">${p.steps.filter((st) => st.t || st.h).map((st, i) => st.t
        ? html`<p class=${mine && !run.done && stepText(p, at.i).text === st.t ? 'ds-cur' : ''}>${st.t}</p>`
        : html`<p class="small">${st.h}</p>`)}</div>`}

      <button class="btn btn-primary" onClick=${() => back('/dlya-sebya')}>Готово</button>
    </div>`;
}

// «Все ›» у «Минутки для себя» — все десять практик
function MinutkaAll() {
  usePractice();
  const ctx = useCtx();
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Минутка для себя</h1>
      <p class="lead">Короткие практики на 3–12 минут. Можно включить, пока малыш спит, или прямо на кухне.</p>
      <div class="rows">${PRACTICES.map((p) => html`<${PracticeRow} key=${p.id} id=${p.id} ctx=${ctx} />`)}</div>
      ${!hasPlus(ctx.s) && html`<p class="small">Четыре практики бесплатны всегда, остальные — в Плюсе.</p>`}
      <div class="rows"><${HelpRow} /></div>
    </div>`;
}

// ——— «Как вы?» — анкета раз в месяц ———
function KakVyScreen() {
  const ctx = useCtx();
  useEffect(() => { const k = ds().kakVy || {}; if (!k.off) setKakVy({ next: now() + 30 * DAY }); }, []);
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Как вы?</h1>
      <p class="p">Отвечайте так, как есть, а не так, как «правильно». Здесь нет хороших и плохих ответов, и никто, кроме вас, их не увидит.</p>
      <div class="card-gray">
        <p class="p">Десять вопросов анкеты появятся, когда авторы шкалы разрешат её русскую версию. В пробной версии приложения их пока нет.</p>
        <p class="small">А пока можно ответить на короткий вопрос — он сразу подскажет, что сделать для себя за пару минут.</p>
      </div>
      <${KakVyBlock} ctx=${ctx} />
      <${SecTitle}>Телефоны помощи<//>
      <div class="stack">
        ${PHONES.map((ph) => html`<p class="p"><a class="link" href=${'tel:' + ph.tel} onClick=${() => track('для себя:звонок')}>${ph.label}</a> — ${ph.text}</p>`)}
      </div>
      <div class="rows"><${HelpRow} /></div>
    </div>`;
}

// ——— Если тяжело (экран 8) ———
function Help() {
  const ctx = useCtx();
  const { s, offline } = ctx;
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Если тяжело</h1>
      <p class="p">${HELP.lead}</p>
      <div class="rows">${HELP.practices.map((id) => html`<${PracticeRow} key=${id} id=${id} ctx=${ctx} />`)}</div>

      <${SecTitle} more="Все" onMore=${() => { track('для себя:подборка'); go('/dlya-sebya/podborka/' + HELP.manyMore); }}>Так бывает у многих<//>
      <div class="feed">
        ${HELP.many.filter((it) => anyArticle(it.id)).map((it) => {
          const ok = readable(it.id, s);
          return html`<button key=${it.id} class=${'feed-card' + (ok ? '' : ' ds-off')} onClick=${() => openArticle(it.id)}>
            <${Ill} id=${it.id} keep /><span class="tiny">${ok ? '' : NEED_NET}</span><span class="t">${it.t}</span></button>`;
        })}
      </div>

      <${SecTitle}>Что можно сделать<//>
      ${HELP.todo.map((t) => html`<p class="p">${t}</p>`)}

      <${SecTitle}>Если тяжело не первый день<//>
      <p class="p">${HELP.notFirstDay}</p>
      <div class="rows">
        <${ArticleRow} item=${HELP.psychologist} s=${s} />
        <${Row} title="Психологи Балансити" sub="Подобрать специалиста для себя · Реклама" onClick=${() => { track('для себя:балансити'); toast({ text: 'В пробной версии запись к психологу выключена. В приложении — со скидкой для Плюса.', ms: 4000 }); }} />
      </div>

      <p class="tiny">Если есть угроза жизни или здоровью — <a class="ds-tel" href="tel:112" onClick=${() => track('для себя:звонок')}>112</a> или <a class="ds-tel" href="tel:103" onClick=${() => track('для себя:звонок')}>103</a>.</p>
    </div>`;
}

// ——— Заметки (экраны 10, 12) ———
function Notes({ query }) {
  const s = useStore();
  // Из поиска — сразу нужная заметка
  useEffect(() => { if (query && query.id && (s.notes || []).some((n) => n.id === query.id)) openSheet(NoteView, { id: query.id }); }, [query && query.id]);
  const list = notesSorted(s);
  const groups = [];
  const thisYear = new Date(now()).getFullYear();
  for (const n of list) {
    const d = new Date(n.at);
    const k = d.getFullYear() + '-' + d.getMonth();
    let g = groups[groups.length - 1];
    if (!g || g.k !== k) { g = { k, title: MONTHS[d.getMonth()] + (d.getFullYear() !== thisYear ? ' ' + d.getFullYear() : ''), items: [] }; groups.push(g); }
    g.items.push(n);
  }
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Заметки</h1>
      <button class="ds-add" onClick=${() => { track('для себя:новая заметка'); go('/zametka'); }}>＋ Заметка</button>
      ${!list.length && html`
        <p class="lead">Сохраните свои вопросы, планы и мысли.</p>
        <p class="p muted">Заметок пока нет. Первая запись может быть совсем короткой.</p>`}
      ${groups.map((g) => html`
        <${SecTitle}>${g.title}<//>
        <div class="rows">${g.items.map((n) => html`<${Row} key=${n.id} title=${noteTitle(n)} sub=${dateLong(n.at)} onClick=${() => { track('для себя:заметка'); openSheet(NoteView, { id: n.id }); }} />`)}</div>`)}
      <p class="tiny">Заметки хранятся на этом телефоне в вашем личном дневнике, отдельно от семейного дневника.</p>
    </div>`;
}

// Дата заметки — кнопками, без набора цифр
function dayChoices(at) {
  const t0 = startOfDay(now());
  const days = Array.from({ length: 7 }, (_, i) => t0 - i * DAY);
  const label = (d, i) => (i === 0 ? 'Сегодня' : i === 1 ? 'Вчера' : `${weekdayShort(d)}, ${new Date(d).getDate()}`);
  const list = days.map((d, i) => ({ d, l: label(d, i) }));
  if (at && startOfDay(at) < days[days.length - 1]) list.push({ d: startOfDay(at), l: dateLong(at) });
  return list;
}
// Заметка — на весь экран: без меню и полосы записи, потому что сразу открывается клавиатура
// (журнал, 4 ноября). Новая — из кнопки слева в меню и из «Заметок».
function NoteScreen({ params }) {
  const s = getState();
  const id = params && params.id;
  const old = id && (s.notes || []).find((n) => n.id === id);
  const [title, setTitle] = useState(old ? noteTitle(old) : '');
  const [text, setText] = useState(old ? noteBody(old) : '');
  const [day, setDay] = useState(old ? startOfDay(old.at) : startOfDay(now()));
  const ok = title.trim() || text.trim();
  const saveNote = () => {
    if (!ok) return;
    const t = new Date(now());
    const at = day + (t.getHours() * 3600 + t.getMinutes() * 60) * 1000;
    const full = title.trim() ? title.trim() + (text.trim() ? '\n' + text.trim() : '') : text.trim();
    const nid = old ? old.id : uid();
    update((d) => {
      d.notes = d.notes || [];
      const i = d.notes.findIndex((n) => n.id === nid);
      const note = { id: nid, text: full.trim(), at: old && startOfDay(old.at) === day ? old.at : at };
      if (i >= 0) d.notes[i] = note; else d.notes.unshift(note);
    });
    track(old ? 'для себя:заметка поправить' : 'для себя:заметка сохранить');
    back('/dlya-sebya/zametki');
    toast({ text: old ? 'Заметку поправили' : 'Заметка сохранена', ms: 3000, actions: old ? [] : [{ label: 'Отменить', onClick: () => update((d) => { d.notes = (d.notes || []).filter((n) => n.id !== nid); }) }] });
  };
  return html`
    <div class="note-screen">
      <div class="note-top">
        <button onClick=${() => back('/dlya-sebya/zametki')}>Отмена</button>
        <button class="done" disabled=${!ok} onClick=${saveNote}>Готово</button>
      </div>
      <input class="note-title" value=${title} placeholder=${old ? 'Название' : 'Новая заметка'} onInput=${(e) => setTitle(e.target.value)} />
      <textarea class="note-body" autofocus=${!old} value=${text} placeholder="Что хочется не забыть. Например, вопросы к педиатру" onInput=${(e) => setText(e.target.value)}></textarea>
      <div class="label">Когда</div>
      <div class="pills">${dayChoices(old && old.at).map((c) => html`<${Pill} on=${day === c.d} onClick=${() => setDay(c.d)}>${c.l}<//>`)}</div>
    </div>`;
}
function NoteView({ id }) {
  const s = useStore();
  const n = (s.notes || []).find((x) => x.id === id);
  if (!n) return html`<p class="empty">Заметки уже нет.</p>`;
  const body = noteBody(n);
  const remove = () => {
    const copy = { ...n };
    update((d) => { d.notes = (d.notes || []).filter((x) => x.id !== id); });
    closeSheet();
    track('для себя:заметка удалить');
    toast({ text: 'Заметку удалили', actions: [{ label: 'Вернуть', onClick: () => update((d) => { d.notes = [copy, ...(d.notes || [])]; }) }] });
  };
  return html`
    <div class="h2">${noteTitle(n)}</div>
    <p class="small">${dateFull(n.at)}</p>
    ${body && html`<p class="p ds-text">${body}</p>`}
    <div class="actions">
      <button onClick=${() => { closeSheet(); go('/zametka/' + id); }}>Поправить</button>
      <button onClick=${remove}>Удалить</button>
    </div>`;
}

// ——— Подборка (экраны 4, 18) ———
function Podborka({ params }) {
  const ctx = useCtx();
  const { s, offline } = ctx;
  const pb = podborkaById(params.id);
  if (!pb) return html`<div class="screen"><${Header} /><p class="empty">Такой подборки нет.</p><button class="btn btn-gray" onClick=${() => go('/dlya-sebya/podborki')}>Все подборки</button></div>`;
  const items = pb.items.filter((it) => anyArticle(it.id));
  const [head, ...rest] = items;
  const a = head && anyArticle(head.id);
  const headOk = a && readable(a.id, s);
  const test = pb.test && TOPIC_TESTS[pb.test];
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">${pb.title}</h1>
      ${a && html`
        <div class=${'card' + (headOk ? '' : ' ds-off')}>
          <${Ill} big id=${a.id} />
          <span class="small">${headOk ? (offline && isSaved('article', a.id) ? 'Сохранено' : '') : NEED_NET}</span>
          <div class="h2">${a.title}</div>
          <p class="p">${firstSentence(a.lead && a.lead.length > 40 ? a.lead : (a.body || []).find((x) => !x.startsWith('## ')))}</p>
          <div class="actions">
            <button onClick=${() => openArticle(a.id)}>Читать</button>
            <${SaveButton} item=${articleItem(a)} />
          </div>
        </div>`}
      <div class="rows">${rest.map((it) => html`<${ArticleRow} key=${it.id} item=${it} s=${s} />`)}</div>

      ${pb.efir && s.demo && s.demo.club && html`
        <${SecTitle}>Эфиры Клуба<//>
        <div class=${'rows' + (offline ? ' ds-off' : '')}>
          <${Row} title=${pb.efir.title} sub=${offline ? NEED_NET : pb.efir.sub} onClick=${() => { if (offline) return netToast(); track('для себя:эфир'); go('/moy-nen/klub'); }} />
        </div>`}

      ${test && html`
        <${SecTitle}>Тест в тему<//>
        <div class=${'rows' + (offline ? ' ds-off' : '')}><${Row} title=${test.title} sub=${offline ? NEED_NET : 'Тест НЭН на сайте'} onClick=${() => openTest(test)} /></div>`}

      ${pb.practice && html`
        <${SecTitle}>Минутка в тему<//>
        <div class="rows"><${PracticeRow} id=${pb.practice} ctx=${ctx} /></div>`}

      ${pb.id === 'ustalost-i-vygoranie' && html`<div class="rows"><${HelpRow} /></div>`}
    </div>`;
}

function PodborkiAll() {
  const s = useStore();
  const order = podborkiOrder(s);
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Подборки</h1>
      <p class="lead">Статьи НЭН о вас, а не о малыше.</p>
      <div class="rows">${order.map((id) => { const pb = podborkaById(id); const n = pb.items.filter((it) => anyArticle(it.id)).length;
        return html`<${Row} key=${id} title=${pb.title} sub=${`${pb.sub} · ${pl(n, 'статья', 'статьи', 'статей')}`} onClick=${() => { track('для себя:подборка'); go('/dlya-sebya/podborka/' + id); }} />`; })}</div>
      <div class="rows"><${HelpRow} /></div>
    </div>`;
}

function TestsAll() {
  const offline = useOffline();
  return html`
    <div class="screen">
      <${Header} />
      <h1 class="h1">Тесты</h1>
      <p class="lead">Лёгкие тесты НЭН — открываются на сайте n-e-n.ru.</p>
      <div class=${'rows' + (offline ? ' ds-off' : '')}>${TESTS.map((t) => html`<${Row} key=${t.id} title=${t.title} sub=${offline ? NEED_NET : 'Тест НЭН'} onClick=${() => openTest(t)} />`)}</div>
    </div>`;
}

// ——— Читалка статей из подборок, которых нет в общей ленте ———
function Statya({ params }) {
  const s = useStore();
  const a = anyArticle(params.id);
  if (!a) return html`<div class="screen"><${Back} /><p class="empty">Статья не нашлась.</p><button class="btn btn-gray" onClick=${() => go('/dlya-sebya')}>В «Для себя»</button></div>`;
  if (!readable(a.id, s)) {
    return html`
      <div class="screen">
        <${Back} />
        <h1 class="h1" style="font-size:22px">${a.title}</h1>
        <p class="lead">Эта статья ещё не загружена. Откроется, когда появится интернет, а сохранённое читается и без него.</p>
        <button class="btn btn-gray" onClick=${() => go('/sohranyonnoe')}>Сохранённое</button>
      </div>`;
  }
  const pb = PODBORKI.find((p) => p.items.some((it) => it.id === a.id));
  const more = pb ? pb.items.filter((it) => it.id !== a.id && anyArticle(it.id)).slice(0, 4) : HELP.many.filter((it) => it.id !== a.id);
  const date = a.date ? dateFull(fromKey(a.date)) : '';
  return html`
    <div class="screen">
      <${Back} />
      <span class="small">${[date, a.author].filter(Boolean).join(' · ')}</span>
      <h1 class="h1" style="font-size:24px">${a.title}</h1>
      <${Ill} big id=${a.id} />
      <div class="actions"><${SaveButton} item=${articleItem(a)} /></div>
      <div class="prose">
        ${(a.body || []).map((p) => (p.startsWith('## ') ? html`<h3>${p.slice(3)}</h3>` : html`<p>${p}</p>`))}
      </div>
      <div class="actions">
        <${SaveButton} item=${articleItem(a)} />
        ${a.url && html`<a class="link" href=${a.url} target="_blank" rel="noopener" onClick=${() => track('для себя:на сайте')}>На сайте НЭН ›</a>`}
      </div>
      ${more.length > 0 && html`
        <${SecTitle}>${pb ? 'Ещё в подборке «' + pb.title + '»' : 'Так бывает у многих'}<//>
        <div class="rows">${more.map((it) => html`<${ArticleRow} key=${it.id} item=${it} s=${s} />`)}</div>`}
    </div>`;
}

// ——— Адреса ———
const R = (path, view) => ({ path, view, tab: '/dlya-sebya', night: true, get strip() { return showStrip(); } });
export const routes = [
  R('/dlya-sebya', Home),
  R('/dlya-sebya/minutka', MinutkaAll),
  R('/dlya-sebya/minutka/:id', MinutkaScreen),
  R('/dlya-sebya/kak-vy', KakVyScreen),
  R('/dlya-sebya/esli-tyazhelo', Help),
  R('/dlya-sebya/zametki', Notes),
  R('/dlya-sebya/podborki', PodborkiAll),
  R('/dlya-sebya/podborka/:id', Podborka),
  R('/dlya-sebya/testy', TestsAll),
  R('/dlya-sebya/statya/:id', Statya),
  { path: '/zametka', view: NoteScreen, solo: true, night: true },
  { path: '/zametka/:id', view: NoteScreen, solo: true, night: true },
];

// ——— Поиск: практики, подборки, заметки, «Если тяжело», статьи подборок ———
export function searchItems(state) {
  const items = [];
  for (const p of PRACTICES) {
    items.push({
      title: p.title, sub: `${p.min} мин · Минутка для себя`, path: `/dlya-sebya/minutka/${p.id}`,
      text: `${p.sub} ${p.short} практика минутка${p.id === 'rebenok-plachet-sil-net' ? ' плачет плач нет сил злюсь кричит' : ''}`,
    });
  }
  for (const pb of PODBORKI) {
    items.push({ title: pb.title, sub: 'Подборка · Для себя', path: `/dlya-sebya/podborka/${pb.id}`, text: pb.sub + ' ' + pb.items.map((it) => (anyArticle(it.id) || {}).title || '').join(' ') });
  }
  for (const n of notesSorted(state)) {
    items.push({ title: noteTitle(n), sub: `Заметка · ${dateLong(n.at)}`, path: `/dlya-sebya/zametki?id=${n.id}`, text: n.text });
  }
  items.push({ title: 'Если тяжело', sub: HELP_ROW.sub, path: '/dlya-sebya/esli-tyazhelo', text: 'тяжело нет сил плачу слёзы злость не справляюсь выгорание депрессия психолог помощь телефон 112 103' });
  items.push({ title: 'Как вы?', sub: 'Вопрос о вас и анкета раз в месяц', path: '/dlya-sebya/kak-vy', text: 'как вы настроение самочувствие анкета телефоны помощи' });
  items.push({ title: 'Заметки', sub: 'Личный дневник родителя', path: '/dlya-sebya/zametki', text: 'заметки дневник записать мысли вопросы планы' });
  items.push({ title: 'Тесты НЭН', sub: 'Лёгкие тесты на сайте', path: '/dlya-sebya/testy', text: TESTS.map((t) => t.title).join(' ') });
  for (const a of STATI) {
    items.push({ title: a.title, sub: 'Для себя', path: articleRoute(a.id), text: a.lead });
  }
  return items;
}
