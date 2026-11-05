// Общие детали экранов — те же, что в Фигме: шапка, строка, карточка, лист, сообщение, меню.
import { html, useState, useEffect } from './lib.js?v=23';
import { useStore, activeChild, update, isSaved, toggleSaved, usePhoto, now } from './store.js?v=23';
import { childAgeLine, pl } from './age.js?v=23';
import { go, back, current, match } from './router.js?v=23';
import { track } from './stats.js?v=23';
import { usePlayer } from './player.js?v=23';
import { cover, coverOfUrl } from './content/covers.js?v=23';

// ——— Лист поверх экрана и сообщение внизу ———
let overlay = { sheet: null, toast: null };
const olisteners = new Set();
const emit = () => olisteners.forEach((l) => l({ ...overlay }));
let toastTimer = null;

export function openSheet(view, props = {}) { overlay.sheet = { view, props }; emit(); }
export function closeSheet() { overlay.sheet = null; emit(); }
// toast({ text, actions: [{ label, onClick }] , ms })
export function toast(t) {
  clearTimeout(toastTimer);
  overlay.toast = t;
  emit();
  toastTimer = setTimeout(() => { overlay.toast = null; emit(); }, t.ms || 5000);
}
export function hideToast() { clearTimeout(toastTimer); overlay.toast = null; emit(); }

// Открыт ли лист и видно ли сообщение — по ним прячется кнопка «✦ Спросить»
export function useOverlay() {
  const [o, setO] = useState({ ...overlay });
  useEffect(() => { olisteners.add(setO); return () => olisteners.delete(setO); }, []);
  return o;
}

export function OverlayHost({ bottomOffset = 0 }) {
  const o = useOverlay();
  const S = o.sheet && o.sheet.view;
  const p = usePlayer();
  bottomOffset += p ? 64 : 0; // мини-плеер над полосой записи
  // Сообщение встаёт над всем низом экрана (меню, полоса, плеер) с отступом — не на карточку
  const low = typeof document !== 'undefined' && document.querySelector('.app > .bottom');
  if (low) bottomOffset = low.offsetHeight;
  return html`
    ${o.toast && html`
      <div class="toast" style=${o.sheet ? 'top:calc(10px + var(--safe-t))' : `bottom:${bottomOffset + 14}px`} role="status">
        <span class="t">${o.toast.text}</span>
        ${(o.toast.actions || []).map((a) => html`<button onClick=${() => { hideToast(); a.onClick(); }}>${a.label}</button>`)}
      </div>`}
    ${S && html`
      <div class="dim" onClick=${closeSheet}></div>
      <div class="sheet" role="dialog">
        <div class="sheet-handle"></div>
        <${S} ...${o.sheet.props} />
      </div>`}
  `;
}

// Подтверждение на самом экране: системные окна confirm() на публичной странице не работают
function ConfirmSheet({ title, text, yes, onYes }) {
  return html`
    <div class="h2">${title}</div>
    ${text && html`<p class="small">${text}</p>`}
    <button class="btn btn-primary" onClick=${() => { closeSheet(); onYes(); }}>${yes}</button>
    <button class="btn-quiet" onClick=${closeSheet}>Отмена</button>`;
}
export const confirmAction = (props) => openSheet(ConfirmSheet, props);

// ——— Иконки шапки ———
const Bell = () => html`<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>`;
const Heart = () => html`<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>`;
const Lupa = () => html`<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="11" cy="11" r="6"/><path d="M15.5 15.5L20 20"/></svg>`;
const Person = () => html`<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="9" r="3.5"/><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0"/></svg>`;
// Искорка — общий знак ИИ
const Spark = () => html`<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/></svg>`;

export function Avatar({ child, size = 36 }) {
  const url = usePhoto(child && child.photo);
  const letter = child && child.name ? child.name[0] : '';
  return html`<span class="avatar" style=${`width:${size}px;height:${size}px`}>${url ? html`<img src=${url} alt="" />` : letter}</span>`;
}

// Есть ли новое под колокольчиком — считает «Сегодня», каркас передаёт сюда
let newsCheck = null;
export function setNewsCheck(fn) { newsCheck = fn; }

// Шапка вкладок: ребёнок слева; справа поиск, «Что нового», «Сохранённое», профиль
// Внутренний экран — не корень вкладки: в шапке слева тонкая стрелка «назад»
const ROOTS = ['/segodnya', '/rebyonok', '/dlya-sebya', '/moy-nen'];
const rootOf = (path) => { const r = '/' + (path.split('/')[1] || ''); return ROOTS.includes(r) ? r : '/segodnya'; };
const Chevron = () => html`<svg class="chev-ico" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>`;
// Если истории нет (открыли по ссылке) — в начало своей вкладки: статья из «Мой НЭН» — в «Мой НЭН»
const homeOf = (path) => { const m = match(path); return (m && m.route && m.route.tab) || rootOf(path); };
export function BackArrow() {
  const path = current().path;
  return html`<button class="back-arrow" aria-label="Назад" onClick=${() => { track('назад:шапка'); back(homeOf(path)); }}><${Chevron} /></button>`;
}

export function Header({ newsDot }) {
  const s = useStore();
  const child = activeChild(s);
  const inner = !ROOTS.includes(current().path);
  if (newsDot === undefined) { try { newsDot = newsCheck ? newsCheck(s, now()) : false; } catch (e) { newsDot = false; } }
  let name, line;
  const twin = child && s.bothTwins && child.twinOf ? s.children.find((c) => c.id === child.twinOf) : null;
  if (twin) { name = `${child.name} и ${twin.name}`; line = childAgeLine(child); }
  else if (child) { name = child.name || (child.expecting ? 'Малыш' : 'Ребёнок'); line = childAgeLine(child); }
  else { name = s.stage === 'planning' ? 'Планируем' : 'Ваша семья'; line = 'Добавить ребёнка'; }
  const onChild = () => { track('шапка:ребёнок'); child ? openSheet(ChildSwitcher) : go('/profil/rebyonok/novyy'); };
  return html`
    <div class="hdr">
      ${inner && html`<${BackArrow} />`}
      <button class="hdr-child" onClick=${onChild}>
        <${Avatar} child=${child} />
        <span style="min-width:0">
          <div class="hdr-name">${name}</div>
          <div class="hdr-age">${line}${s.children.length > 1 || child ? ' ▾' : ''}</div>
        </span>
      </button>
      <div class="hdr-icons">
        <button class="icon-btn" aria-label="Поиск" onClick=${() => { track('шапка:поиск'); go('/poisk'); }}><${Lupa} /></button>
        <button class="icon-btn" aria-label="Что нового" onClick=${() => { track('шапка:колокольчик'); go('/novoe'); }}><${Bell} />${newsDot && html`<span class="dot"></span>`}</button>
        <button class="icon-btn" aria-label="Сохранённое" onClick=${() => { track('шапка:сердечко'); go('/sohranyonnoe'); }}><${Heart} /></button>
        <button class="icon-btn" aria-label="Профиль" onClick=${() => { track('шапка:профиль'); go('/profil'); }}><${Person} /></button>
      </div>
    </div>`;
}

// Несколько детей: полоска с каждым — касание переключает весь экран на него (журнал, 5 ноября)
export function KidsBar({ compact }) {
  const s = useStore();
  if (s.children.length < 2) return null;
  const cur = activeChild(s);
  const pick = (id) => { if (cur && cur.id === id) return; track('дети:переключить'); update((d) => { d.activeChildId = id; }); };
  return html`
    <div class=${'kids-bar' + (compact ? ' compact' : '')} role="tablist" aria-label="Дети">
      ${s.children.map((c) => html`
        <button role="tab" aria-selected=${cur && cur.id === c.id} class=${'kid' + (cur && cur.id === c.id ? ' on' : '')} onClick=${() => pick(c.id)}>
          <${Avatar} child=${c} size=${compact ? 24 : 28} /><span>${c.name || (c.expecting ? 'Малыш' : 'Ребёнок')}</span>
        </button>`)}
      ${!compact && html`<button class="kid add" aria-label="Добавить ребёнка" onClick=${() => { track('дети:добавить'); go('/profil/rebyonok/novyy'); }}>＋</button>`}
    </div>`;
}

// Лист: карточка ребёнка и переключатель детей
export function ChildSwitcher() {
  const s = useStore();
  const pick = (id) => { update((d) => { d.activeChildId = id; }); closeSheet(); };
  return html`
    <div class="h2">Дети</div>
    <div class="rows">
      ${s.children.map((c) => html`
        <button class="row" onClick=${() => pick(c.id)}>
          <${Avatar} child=${c} />
          <span class="row-text"><span class="row-title">${c.name || (c.expecting ? 'Малыш' : 'Ребёнок')}</span><span class="row-sub">${childAgeLine(c)}</span></span>
          ${c.id === (activeChild(s) || {}).id ? html`<span class="row-end">✓</span>` : ''}
        </button>`)}
      <button class="row" onClick=${() => { closeSheet(); go('/profil/rebyonok/' + (activeChild(s) || {}).id); }}>
        <span class="row-text"><span class="row-title">Карточка ребёнка</span><span class="row-sub">Как сегодня: сон, кормления, подгузники — и данные</span></span><span class="chev">›</span>
      </button>
      <button class="row" onClick=${() => { closeSheet(); go('/profil/rebyonok/novyy'); }}>
        <span class="row-text"><span class="row-title">+ Добавить ребёнка</span><span class="row-sub">Или малыша, которого ждёте</span></span><span class="chev">›</span>
      </button>
      <button class="row" onClick=${() => { track('шапка:семья'); closeSheet(); go('/profil/semya'); }}>
        <span class="row-text"><span class="row-title">Вести дневник вместе</span><span class="row-sub">Позвать второго родителя, бабушку или няню</span></span><span class="chev">›</span>
      </button>
    </div>`;
}

// Шапка внутреннего экрана: «‹ Назад» и заголовок
export function Back({ title, to, right }) {
  return html`
    <div class="back between">
      <button class="back-btn" onClick=${() => (to ? go(to) : back(homeOf(current().path)))}><${Chevron} />Назад</button>
      ${right || ''}
    </div>
    ${title && html`<h1 class="h1" style="font-size:24px">${title}</h1>`}`;
}

export const SecTitle = ({ children, more, onMore }) => html`
  <div class="sec-title"><span>${children}</span>${more && html`<button onClick=${onMore}>${more} ›</button>`}</div>`;

export function Row({ title, sub, end, onClick, chev = !!onClick, left }) {
  // Без действия — не кнопка и без стрелки: стрелка обещает переход
  if (!onClick) return html`
    <div class="row">${left || ''}<span class="row-text"><span class="row-title">${title}</span>${sub && html`<span class="row-sub">${sub}</span>`}</span>${end && html`<span class="row-end">${end}</span>`}</div>`;
  return html`
    <button class="row" onClick=${onClick}>
      ${left || ''}
      <span class="row-text"><span class="row-title">${title}</span>${sub && html`<span class="row-sub">${sub}</span>`}</span>
      ${end && html`<span class="row-end">${end}</span>`}
      ${chev && html`<span class="chev">›</span>`}
    </button>`;
}

// Картинка карточки — живая иллюстрация НЭН: обложка статьи с сайта (id статьи или from — её адрес).
// Нет иллюстрации — нет и пустого пятна; пятно в цветах НЭН остаётся только там, где его держит
// сетка (keep — карточки ленты) или где в приложении будет фото или видео (text — что там будет).
// Служебных подписей вроде «Иллюстрация из архива НЭН» на экране нет.
const PLACEHOLDER = /архив|иллюстрац|фото блюда|видео из урока|фото из момента/i;

// Пятно без картинки — у каждой карточки своё: цвета НЭН, расположение и наклон
// выбираются по её названию, поэтому от открытия к открытию не меняются.
const TINTS = ['255,164,192', '128,184,250', '186,164,240', '255,212,120', '255,182,156', '150,124,232'];
const BASES = [['#fbe3ee', '#e8e0fb'], ['#dfeafd', '#efe8fc'], ['#fff0d6', '#fbe3ee'], ['#efe8fc', '#ffe9df'], ['#fde9f1', '#e3eefe']];
function seeded(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  let x = (h >>> 0) || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}
export function blobBg(seed) {
  const r = seeded(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const [b1, b2] = pick(BASES);
  const start = Math.floor(r() * TINTS.length);
  const layers = [];
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const c = TINTS[(start + i * (1 + Math.floor(r() * 2))) % TINTS.length];
    const x = Math.round(r() * 100); const y = Math.round(r() * 100);
    const w = 45 + Math.round(r() * 65); const h = 45 + Math.round(r() * 65);
    layers.push(`radial-gradient(${w}% ${h}% at ${x}% ${y}%, rgba(${c},${(0.8 + r() * 0.2).toFixed(2)}) 0%, rgba(${c},0) ${62 + Math.round(r() * 14)}%)`);
  }
  if (r() < 0.45) {
    // Иногда — круглое «солнце» с мягким краем
    const c = TINTS[(start + 2 + Math.floor(r() * 3)) % TINTS.length];
    const rad = 12 + Math.round(r() * 14);
    layers.unshift(`radial-gradient(circle at ${12 + Math.round(r() * 76)}% ${18 + Math.round(r() * 64)}%, rgba(${c},0.95) 0, rgba(${c},0.95) ${rad}%, rgba(${c},0) ${rad + 6}%)`);
  }
  return layers.join(', ') + `, linear-gradient(${Math.round(r() * 360)}deg, ${b1} 0%, ${b2} 100%)`;
}

export const Ill = ({ text, big, id, src, from, keep, seed }) => {
  const size = big ? 'big' : 'small';
  const url = src || (id && cover(id, size)) || (from && coverOfUrl(from, size)) || null;
  const label = text && !PLACEHOLDER.test(text) ? text : '';
  if (url) return html`<div class=${'ill' + (big ? ' big' : '')}><img src=${url} alt="" loading="lazy" onError=${(e) => e.target.remove()} /></div>`;
  if (!text && !keep) return null;
  const video = /видео/i.test(text || '');
  return html`<div class=${'ill' + (big ? ' big' : '')} style=${{ background: blobBg(seed || id || from || text || 'НЭН') }} aria-hidden=${label ? null : 'true'}>${video ? html`<span class="ill-play" aria-label="Видео"></span>` : label}</div>`;
};

// Срок рождения — как в приложении (app/src/children: от 22 до 44 недель, по умолчанию 40).
// 37 — не предел: в срок рожают и в 38–41 неделю, позже срока — с 42.
export const gestShort = (w) => (w == null ? '' : `${pl(w, 'неделя', 'недели', 'недель')} — ${w < 37 ? 'по исправленному возрасту' : w < 42 ? 'в срок' : 'позже срока'}`);
export function GestStepper({ value, onChange }) {
  const shown = value == null ? 40 : value;
  const step = (d) => onChange(Math.min(44, Math.max(22, shown + d)));
  const hint = value == null ? 'Не помните точно — можно не указывать.'
    : value < 37 ? 'Раньше 37 недель — до двух лет ориентиры и материалы по исправленному возрасту, прививки — от даты рождения.'
    : value < 42 ? 'В срок: ориентиры и прививки — от даты рождения.' : 'Позже срока: ориентиры и прививки — от даты рождения.';
  return html`
    <div class="gest">
      <button class="pill" aria-label="На неделю раньше" disabled=${shown <= 22} onClick=${() => step(-1)}>−</button>
      <span class="big-num">${value == null ? 'не указан' : pl(value, 'неделя', 'недели', 'недель')}</span>
      <button class="pill" aria-label="На неделю позже" disabled=${shown >= 44} onClick=${() => step(1)}>+</button>
      ${value != null && html`<button class="link gest-clear" onClick=${() => onChange(null)}>Не указывать</button>`}
    </div>
    <p class="small">${hint}</p>`;
}

export function Pill({ on, children, onClick }) {
  return html`<button class=${'pill' + (on ? ' on' : '')} onClick=${onClick}>${on ? '✓ ' : ''}${children}</button>`;
}

// «♡ Сохранить» у любой карточки
export function SaveButton({ item, label = 'Сохранить' }) {
  const s = useStore();
  const on = isSaved(item.kind, item.id);
  return html`<button onClick=${(e) => { e.stopPropagation(); const added = toggleSaved(item); track('сохранить:' + item.kind); toast({ text: added ? 'Сохранено — под сердечком в шапке' : 'Убрали из сохранённого', ms: 3000, actions: [{ label: 'Отменить', onClick: () => toggleSaved(item) }] }); }}>${on ? '♥ Сохранено' : '♡ ' + label}</button>`;
}

// Помощник: капсула «✦ Спросить» над меню справа (журнал, 4 ноября). Прячется под листом
// и сообщением, а ночью — вместе со всем, кроме записи.
export function AskButton() {
  const o = useOverlay();
  const s = useStore();
  if (o.sheet || o.toast) return null;
  if (s.records.some((r) => r.end == null && ['sleep', 'feed', 'walk'].includes(r.type))) return null;
  return html`<button class="ask-fab" onClick=${() => { track('помощник:кнопка'); go('/sprosit'); }}><${Spark} />Спросить</button>`;
}

// Значки вкладок — тонкой линией, как в шапке
const TAB_ICONS = {
  '/segodnya': () => html`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>`,
  '/rebyonok': () => html`<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M11 5.2c.6-.9 1.8-1 2.5-.3"/><path d="M5 20.5c.8-3.6 3.6-5.8 7-5.8s6.2 2.2 7 5.8"/></svg>`,
  '/dlya-sebya': () => html`<svg viewBox="0 0 24 24"><path d="M5 10h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M9 3.5c-.8 1 .8 2-.1 3M12.5 3.5c-.8 1 .8 2-.1 3"/></svg>`,
  '/moy-nen': () => html`<svg viewBox="0 0 24 24"><path d="M12 6.5C10 5 7.5 4.6 4 5v13c3.5-.4 6 0 8 1.5 2-1.5 4.5-1.9 8-1.5V5c-3.5-.4-6 0-8 1.5z"/><path d="M12 6.5v13"/></svg>`,
};
const NoteIcon = () => html`<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>`;

// Нижнее меню: слева — новая заметка (журнал, 4 ноября), дальше четыре вкладки;
// поиск — в шапке, помощник — капсулой над меню.
export const TABS = [
  { path: '/segodnya', label: 'Сегодня' },
  { path: '/rebyonok', label: 'Ребёнок' },
  { path: '/dlya-sebya', label: 'Для себя' },
  { path: '/moy-nen', label: 'Мой НЭН' },
];
export function Menu({ tab, onRecord, running }) {
  return html`
    <nav class="menu">
      <button class=${'note-btn' + (running ? ' on' : '')} aria-label="Записать" onClick=${() => { track('меню:записать'); onRecord ? onRecord() : go('/zametka'); }}><${NoteIcon} /></button>
      ${TABS.map((t) => html`
        <button class=${'tab' + (tab === t.path ? ' on' : '')} aria-current=${tab === t.path ? 'page' : null} onClick=${() => { track('вкладка:' + t.label); go(t.path, { replace: true }); }}>
          ${TAB_ICONS[t.path]()}${t.label}
        </button>`)}
    </nav>`;
}

// Поле ввода в рамке, как в Фигме
export function Field({ label, value, onInput, placeholder, type = 'text', inputmode, hint, err, autofocus }) {
  return html`
    <label class=${'field' + (err ? ' err' : '')}>
      <span class="label">${label}</span>
      <input type=${type} inputmode=${inputmode} value=${value} placeholder=${placeholder} autofocus=${autofocus}
        onInput=${(e) => onInput(e.target.value)} />
      ${hint && html`<span class="hint">${hint}</span>`}
    </label>`;
}
