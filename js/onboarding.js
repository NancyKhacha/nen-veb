// Первый вход — Фигма «36 · V3 · Первый вход», экраны 1, 2, 3, 7, 9, 10, 11.
import { html, useState } from './lib.js';
import { useStore, update, uid, getState, replaceAll, savePhoto, now } from './store.js';
import { parseDate, maskDate, ageText, expectingLine, startOfDay, ddmmyyyy } from './age.js';
import { go, back, current } from './router.js';
import { Row, Pill, Field, toast, GestStepper, gestShort } from './ui.js';
import { track } from './stats.js';

export const TOPICS = [
  ['sleep', 'Сон'], ['food', 'Еда'], ['development', 'Развитие'],
  ['health', 'Здоровье'], ['emotions', 'Эмоции и поведение'], ['self', 'Для себя'],
];

const Dots = ({ n }) => html`<div class="onb-dots" aria-label=${`Шаг ${n} из 3`}>${[1, 2, 3].map((i) => html`<i class=${i === n ? 'on' : ''}></i>`)}</div>`;

// Показ первого входа: пройти его заново и ничего не поменять в записях.
// «Профиль → Для исследования → Посмотреть первый вход» или ссылка #/start?pokaz=1.
const PREVIEW = 'nen-pokaz';
let previewChild = null;
export const isPreview = () => { try { return sessionStorage.getItem(PREVIEW) === '1'; } catch (e) { return false; } };
export function markPreview() {
  try { sessionStorage.setItem(PREVIEW, '1'); } catch (e) { /* без хранилища показ не включится */ }
}
export function endPreview() { try { sessionStorage.removeItem(PREVIEW); } catch (e) { /* ничего */ } previewChild = null; }
export function startPreview() {
  markPreview();
  try { sessionStorage.removeItem('nen-splash'); } catch (e) { /* экран загрузки просто не покажется */ }
  previewChild = null;
  track('первый-вход:показ');
  go('/start');
}
// В показе ничего не сохраняем
const remember = (fn) => { if (!isPreview()) update(fn); };

function finish(path = '/segodnya') {
  if (isPreview()) {
    try { sessionStorage.removeItem(PREVIEW); } catch (e) { /* ничего */ }
    previewChild = null;
    go(path, { replace: true });
    toast({ text: 'Это был показ первого входа — ваши записи на месте', ms: 3500 });
    return;
  }
  update((s) => { s.onboarded = true; });
  track('первый-вход:готово');
  go(path, { replace: true });
}

// 1. Первый экран
function Start() {
  const pick = (stage, path) => () => {
    track('первый-вход:' + stage);
    remember((s) => { s.stage = stage; });
    if (stage === 'planning') return finish();
    go(path);
  };
  return html`
    <div class="solo">
      <div class="onb-logo"><img src="img/logo.svg" alt="НЭН" /></div>
      <h1 class="h1">Нет, это нормально</h1>
      <p class="lead">Для родителей, которые хотят разобраться, а не соответствовать.</p>
      <div class="sec-title center">Это для вас, если</div>
      <div class="onb-stage">
        <${Row} title="Ребёнок уже родился" sub="и каждый день приносит новые вопросы" onClick=${pick('born', '/start/rebyonok')} />
        <${Row} title="Ждёте малыша" sub="и советов вокруг больше, чем ответов" onClick=${pick('expecting', '/start/zhdyom')} />
        <${Row} title="Планируете родительство" sub="и хотите понять, во что ввязываетесь" onClick=${pick('planning')} />
      </div>
      <div class="grow"></div>
      <button class="btn-quiet" onClick=${() => go('/start/perenos')}>Перенести записи с другого телефона</button>
      <button class="btn-quiet" onClick=${() => go('/start/vhod')}>Вы в Клубе или учитесь в Школе НЭН? Войти</button>
    </div>`;
}

// 2 и 11. Ваш ребёнок; с сайта — имя и дата уже подставлены
function ChildStep({ fromSite }) {
  const q = current().query;
  const [name, setName] = useState(fromSite ? (q.name || '') : '');
  const [date, setDate] = useState(fromSite && q.dob ? ddmmyyyy(new Date(q.dob).getTime()) : '');
  const [sex, setSex] = useState(fromSite ? 'none' : null);
  const [gest, setGest] = useState(null);
  const [showGest, setShowGest] = useState(false);
  const [photo, setPhoto] = useState(null);
  const dob = parseDate(date);
  const future = dob && dob > now();
  const ok = name.trim() && dob && !future;
  const save = async () => {
    if (isPreview()) { previewChild = { name: name.trim() }; go('/start/temy'); return; }
    const photoId = photo ? await savePhoto(photo) : null;
    const id = uid();
    update((s) => {
      s.stage = 'born';
      s.children.push({ id, name: name.trim(), dob: startOfDay(dob), sex, gestWeeks: gest, photo: photoId });
      s.activeChildId = id;
    });
    track('первый-вход:ребёнок-сохранён' + (fromSite ? ':с-сайта' : ''));
    go('/start/temy');
  };
  return html`
    <div class="solo">
      ${!fromSite && html`<div class="back"><button onClick=${() => back('/start')}>‹ Назад</button></div>`}
      <${Dots} n=${2} />
      <h1 class="h1">Ваш ребёнок</h1>
      <p class="lead">${fromSite ? 'Имя и дату перенесли с n-e-n.ru — проверьте и сохраните.' : 'Достаточно имени и даты рождения. По ним «Сегодня» подберёт ориентиры, прививки и статьи.'}</p>
      <${Field} label="Имя" value=${name} onInput=${setName} placeholder="Можно домашнее" />
      <${Field} label="Дата рождения" value=${date} inputmode="numeric" placeholder="ДД.ММ.ГГГГ"
        onInput=${(v) => setDate(maskDate(v))}
        err=${date.length === 10 && (!dob || future)}
        hint=${dob && !future ? `Сейчас ${ageText(dob, now())}` : (date.length === 10 ? (future ? 'Дата ещё не наступила — если ждёте малыша, вернитесь назад' : 'Такой даты нет') : '')} />
      <div class="sec-title">Пол · по желанию</div>
      <div class="pills">
        ${[['girl', 'Девочка'], ['boy', 'Мальчик'], ['none', 'Не указывать']].map(([k, l]) => html`<${Pill} on=${sex === k} onClick=${() => setSex(k)}>${l}<//>`)}
      </div>
      ${!fromSite && html`
        <div class="rows">
          <${Row} title="Срок рождения" sub=${gest != null ? gestShort(gest) : 'По желанию. Раньше 37 недель — развитие по исправленному возрасту'} onClick=${() => setShowGest(!showGest)} />
          ${showGest && html`
            <div style="padding:12px 0" class="stack"><${GestStepper} value=${gest} onChange=${setGest} /></div>`}
          <label class="row" style="cursor:pointer">
            <span class="row-text"><span class="row-title">Фото</span><span class="row-sub">${photo ? 'Выбрано' : 'По желанию — будет в шапке рядом с именем'}</span></span><span class="chev">›</span>
            <input type="file" accept="image/*" style="display:none" onChange=${(e) => setPhoto(e.target.files[0])} />
          </label>
        </div>`}
      <div class="grow"></div>
      <button class="btn btn-primary" disabled=${!ok} onClick=${save}>Готово</button>
      <button class="btn-quiet" onClick=${() => { remember((s) => { s.stage = 'born'; }); track('первый-вход:заполню-позже'); finish(); }}>Заполню позже</button>
    </div>`;
}

// 7. Ждём малыша
function Expecting() {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const due = parseDate(date);
  const valid = due && due > now() - 14 * 864e5 && due < now() + 300 * 864e5;
  const save = () => {
    if (isPreview()) { previewChild = { name: name.trim() || 'Малыш', expecting: true }; go('/start/temy'); return; }
    const id = uid();
    update((s) => {
      s.stage = 'expecting';
      s.children.push({ id, name: name.trim() || 'Малыш', expecting: true, due: startOfDay(due) });
      s.activeChildId = id;
    });
    track('первый-вход:ждём-сохранено');
    go('/start/temy');
  };
  return html`
    <div class="solo">
      <div class="back"><button onClick=${() => back('/start')}>‹ Назад</button></div>
      <${Dots} n=${2} />
      <h1 class="h1">Ждём малыша</h1>
      <p class="lead">Достаточно даты родов. После рождения дополните эту же карточку — записи и заметки останутся.</p>
      <${Field} label="Как назвать" value=${name} onInput=${setName} placeholder="Можно домашнее или «Малыш»" />
      <${Field} label="Предполагаемая дата родов" value=${date} inputmode="numeric" placeholder="ДД.ММ.ГГГГ"
        onInput=${(v) => setDate(maskDate(v))} err=${date.length === 10 && !valid}
        hint=${valid ? expectingLine(due, now()) : (date.length === 10 ? 'Проверьте дату' : '')} />
      <div class="grow"></div>
      <button class="btn btn-primary" disabled=${!valid} onClick=${save}>Готово</button>
      <button class="btn-quiet" onClick=${() => { track('первый-вход:заполню-позже'); finish(); }}>Заполню позже</button>
    </div>`;
}

// 3. Что сейчас волнует?
function Topics() {
  const s = useStore();
  const [sel, setSel] = useState(s.topics.length && !isPreview() ? s.topics : []);
  const child = isPreview() ? previewChild : s.children.find((c) => c.id === s.activeChildId);
  const who = child && !child.expecting ? `по возрасту ${genitive(child.name)}` : child ? 'по сроку' : 'по возрасту ребёнка';
  const toggle = (k) => setSel(sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k]);
  return html`
    <div class="solo">
      <div class="back"><button onClick=${() => back('/start')}>‹ Назад</button></div>
      <${Dots} n=${3} />
      <h1 class="h1">Что сейчас волнует?</h1>
      <p class="lead">Отметьте одну или несколько тем — с них начнутся статьи на «Сегодня». Поменять можно в профиле.</p>
      <div class="pills">${TOPICS.map(([k, l]) => html`<${Pill} on=${sel.includes(k)} onClick=${() => toggle(k)}>${l}<//>`)}</div>
      <p class="small">Можно ничего не отмечать — статьи подберём ${who}.</p>
      <div class="grow"></div>
      <button class="btn btn-primary" onClick=${() => { remember((d) => { d.topics = sel; }); track('первый-вход:темы-' + sel.length); finish(); }}>Готово</button>
      <button class="btn-quiet" onClick=${() => finish()}>Пропустить</button>
    </div>`;
}

// Родительный падеж для простых имён: Соня → Сони, Миша → Миши, Лёва → Лёвы, Тимур → Тимура
export function genitive(n = '') {
  if (!n) return 'ребёнка';
  if (/[кгхжчшщ]а$/i.test(n)) return n.slice(0, -1) + 'и';
  if (/[ья]$/i.test(n)) return n.slice(0, -1) + 'и';
  if (/а$/i.test(n)) return n.slice(0, -1) + 'ы';
  if (/й$/i.test(n)) return n.slice(0, -1) + 'я';
  if (/[бвгдзклмнпрстфхцчшщж]$/i.test(n)) return n + 'а';
  return n;
}

// 9. Перенести записи — из файла копии веб-версии
export function Transfer() {
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [text, setText] = useState('');
  const onFile = async (f) => importText(await f.text());
  const importText = (raw) => {
    if (isPreview()) { toast({ text: 'В показе первого входа записи не переносятся — ваши остаются как есть', ms: 3500 }); return; }
    try {
      const data = JSON.parse(raw);
      if (!data || data.app !== 'nen-veb' || !data.state) throw new Error();
      const cur = getState();
      const ids = new Set(cur.records.map((r) => r.id));
      const kids = new Set(cur.children.map((c) => c.id));
      const merged = {
        ...cur, ...data.state,
        children: [...cur.children, ...data.state.children.filter((c) => !kids.has(c.id))],
        records: [...cur.records, ...data.state.records.filter((r) => !ids.has(r.id))],
        onboarded: true,
      };
      if (!merged.activeChildId && merged.children[0]) merged.activeChildId = merged.children[0].id;
      replaceAll(merged);
      track('перенос:готово');
      setRes({ kids: data.state.children.length, recs: data.state.records.length });
    } catch (e) { setErr('Копия не открылась. Нужна копия из веб-версии НЭН: «Профиль → Копия записей».'); }
  };
  if (res) return html`
    <div class="solo">
      <h1 class="h1">Перенесли</h1>
      <p class="lead">Детей — ${res.kids}, записей — ${res.recs}. Всё уже на «Сегодня».</p>
      <div class="grow"></div>
      <button class="btn btn-primary" onClick=${() => go('/segodnya', { replace: true })}>Открыть «Сегодня»</button>
    </div>`;
  return html`
    <div class="solo">
      <div class="back"><button onClick=${() => back('/start')}>‹ Назад</button></div>
      <h1 class="h1">Перенести записи</h1>
      <p class="lead">Из копии, которую сделали на старом телефоне: «Профиль → Копия записей».</p>
      <p class="small">Записи, которые уже есть на этом телефоне, останутся — без дублей.</p>
      <label class="field"><span class="label">Копия текстом</span><textarea value=${text} placeholder="Вставьте сюда скопированную копию" onInput=${(e) => setText(e.target.value)}></textarea></label>
      ${err && html`<div class="note-box">${err}</div>`}
      <div class="grow"></div>
      <button class="btn btn-primary" disabled=${!text.trim()} onClick=${() => importText(text)}>Перенести</button>
      <label class="btn btn-gray">Выбрать файл копии<input type="file" accept=".json,.nen,application/json" style="display:none" onChange=${(e) => e.target.files[0] && onFile(e.target.files[0])} /></label>
    </div>`;
}

// 10. Вход для Клуба и Школы — в веб-версии выключен
function Login() {
  const [mail, setMail] = useState('');
  return html`
    <div class="solo">
      <div class="back"><button onClick=${() => back('/start')}>‹ Назад</button></div>
      <h1 class="h1">Вход</h1>
      <p class="lead">Аккаунт тот же, что на n-e-n.ru: Клуб, курсы, подарки. Пароль не нужен.</p>
      <${Field} label="Почта" value=${mail} type="email" inputmode="email" placeholder="имя@почта.ru" onInput=${setMail} />
      <p class="small">Пришлём код из 6 цифр. Дневник работает и без входа.</p>
      <div class="grow"></div>
      <button class="btn btn-primary" onClick=${() => { track('вход:попытка'); toast({ text: 'В пробной версии вход выключен. Всё остальное работает без него.', ms: 4000 }); }}>Получить код</button>
      <button class="btn-quiet" onClick=${() => back('/start')}>Продолжить без входа</button>
    </div>`;
}

export const onboardingRoutes = [
  { path: '/start', view: Start, solo: true },
  { path: '/start/rebyonok', view: () => html`<${ChildStep} />`, solo: true },
  { path: '/start/zhdyom', view: Expecting, solo: true },
  { path: '/start/temy', view: Topics, solo: true },
  { path: '/start/perenos', view: Transfer, solo: true },
  { path: '/start/vhod', view: Login, solo: true },
  { path: '/s', view: () => html`<${ChildStep} fromSite />`, solo: true },
];
