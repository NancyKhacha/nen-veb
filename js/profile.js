// Профиль родителя — всё служебное: дети, темы, кнопки записи, копия, вход, «Для исследования».
import { html, useState } from './lib.js?v=17';
import { useStore, update, uid, getState, resetAll, savePhoto, now, storage } from './store.js?v=17';
import { parseDate, maskDate, ageText, expectingLine, startOfDay, ddmmyyyy, childAgeLine } from './age.js?v=17';
import { go, back } from './router.js?v=17';
import { Back, Row, SecTitle, Pill, Field, Avatar, toast, confirmAction, GestStepper } from './ui.js?v=17';
import { TOPICS, Transfer, startPreview } from './onboarding.js?v=17';
import { familyLine } from './semya.js?v=17';
import { TodayTiles } from './tabs/rebyonok/istoriya.js?v=17';
import { quickTypes, recordAllowed } from './stages.js?v=17';
import { ageMonths } from './age.js?v=17';
import { statsReport, statsCode, resetStats, track } from './stats.js?v=17';

function Profile() {
  const s = useStore();
  return html`
    <div class="screen">
      <${Back} title="Профиль" />
      <${SecTitle}>Дети<//>
      <div class="rows">
        ${s.children.map((c) => html`<${Row} left=${html`<${Avatar} child=${c} />`} title=${c.name || 'Малыш'} sub=${childAgeLine(c)} onClick=${() => go('/profil/rebyonok/' + c.id)} />`)}
        <${Row} title="+ Добавить ребёнка" sub="Или малыша, которого ждёте" onClick=${() => go('/profil/rebyonok/novyy')} />
      </div>
      <${SecTitle}>Семья<//>
      <div class="rows">
        <${Row} title="Вести дневник вместе" sub=${familyLine(s)} onClick=${() => { track('профиль:семья'); go('/profil/semya'); }} />
      </div>
      <${SecTitle}>Приложение<//>
      <div class="rows">
        <${Row} title="Что сейчас волнует" sub=${s.topics.length ? TOPICS.filter(([k]) => s.topics.includes(k)).map(([, l]) => l).join(', ') : 'Темы не выбраны — статьи по возрасту'} onClick=${() => go('/profil/temy')} />
        <${Row} title="Быстрая запись" sub=${(s.settings.hiddenButtons || []).length ? 'Часть кнопок убрана' : 'Сон, кормление, подгузник — как по возрасту'} onClick=${() => go('/profil/knopki')} />
        <${Row} title="Город для погоды" sub=${s.settings.city} onClick=${() => go('/profil/gorod')} />
        <${Row} title="Копия записей" sub="Файл, чтобы перенести всё на другой телефон" onClick=${() => go('/profil/kopiya')} />
        <${Row} title="Войти" sub="Для Клуба и Школы НЭН. Дневник работает и без входа" onClick=${() => go('/start/vhod')} />
      </div>
      <${SecTitle}>Проверка<//>
      <div class="rows">
        <${Row} title="Посмотреть первый вход" sub="Пройти его ещё раз, как в первый день. Записи не тронутся" onClick=${startPreview} />
        <${Row} title="Если что-то не работает" sub="Версия, телефон и браузер — чтобы прислать нам" onClick=${() => go('/profil/pomosh')} />
        <${Row} title="Для исследования" sub=${`Участник ${statsCode()} · отчёт за неделю`} onClick=${() => go('/profil/issledovanie')} />
      </div>
      <p class="tiny">Пробная веб-версия приложения НЭН. Всё, что вы записываете, хранится только на этом телефоне.</p>
    </div>`;
}

// Карточка ребёнка: правка или новый
const ageMonthsOf = (c) => Math.floor((now() - c.dob) / (30.44 * 864e5));

function ChildCard({ params }) {
  const s = useStore();
  const isNew = params.id === 'novyy';
  const c = isNew ? null : s.children.find((x) => x.id === params.id);
  const [expecting, setExpecting] = useState(c ? !!c.expecting : false);
  const [name, setName] = useState(c ? c.name || '' : '');
  const [date, setDate] = useState(c ? ddmmyyyy(c.expecting ? c.due : c.dob) : '');
  const [sex, setSex] = useState(c ? c.sex : null);
  const [gest, setGest] = useState(c ? c.gestWeeks || null : null);
  const [photo, setPhoto] = useState(null);
  const [twin, setTwin] = useState(c ? c.twinOf || null : null);
  if (!isNew && !c) return html`<div class="screen"><${Back} /><p class="empty">Такого ребёнка нет.</p></div>`;
  const d = parseDate(date);
  const ok = expecting ? d && d > now() - 14 * 864e5 : name.trim() && d && d <= now();
  const save = async () => {
    const fresh = photo ? await savePhoto(photo) : null;
    const photoId = fresh || (c ? c.photo : null);
    if (photo && !fresh) toast({ text: 'Фото не сохранилось — остальное сохранили. Попробуйте другое фото.', ms: 4000 });
    const id = c ? c.id : uid();
    update((st) => {
      const data = expecting
        ? { id, name: name.trim() || 'Малыш', expecting: true, due: startOfDay(d), photo: photoId }
        : { id, name: name.trim(), dob: startOfDay(d), sex, gestWeeks: gest, photo: photoId, twinOf: twin };
      const i = st.children.findIndex((x) => x.id === id);
      if (i >= 0) st.children[i] = data; else st.children.push(data);
      if (twin) { const t = st.children.find((x) => x.id === twin); if (t) t.twinOf = id; }
      st.activeChildId = id;
      if (!expecting) st.stage = 'born';
    });
    track(isNew ? 'профиль:ребёнок-добавлен' : 'профиль:ребёнок-изменён');
    toast({ text: 'Сохранили', ms: 1800 });
    back('/profil');
  };
  const others = s.children.filter((x) => x.id !== (c && c.id) && !x.expecting);
  return html`
    <div class="screen">
      <${Back} title=${isNew ? 'Новый ребёнок' : (c.name || 'Малыш')} />
      ${!isNew && !c.expecting && html`
        <div class="child-top"><${Avatar} child=${c} /><span class="small">${childAgeLine(c)}</span></div>
        <${SecTitle}>Сегодня<//>
        ${quickTypes(ageMonthsOf(c)).length > 0 && html`<${TodayTiles} child=${c} types=${quickTypes(ageMonthsOf(c))} />`}
        <div class="rows">
          <${Row} title="Дневник по дням" sub="Что было и что в планах" onClick=${() => { track('карточка:дневник'); go('/rebyonok/dnevnik'); }} />
          <${Row} title="Рост" sub="Вес, рост, окружность головы — график" onClick=${() => { track('карточка:рост'); go('/rebyonok/rost'); }} />
          <${Row} title="Вести дневник вместе" sub=${familyLine(s)} onClick=${() => { track('карточка:семья'); go('/profil/semya'); }} />
        </div>
        <${SecTitle}>Данные<//>`}
      ${(isNew || c.expecting) && html`<div class="pills"><${Pill} on=${!expecting} onClick=${() => setExpecting(false)}>${c && c.expecting ? 'Малыш родился' : 'Уже родился'}<//><${Pill} on=${expecting} onClick=${() => setExpecting(true)}>Ждём<//></div>`}
      <${Field} label=${expecting ? 'Как назвать' : 'Имя'} value=${name} onInput=${setName} placeholder=${expecting ? 'Можно домашнее или «Малыш»' : 'Можно домашнее'} />
      <${Field} label=${expecting ? 'Предполагаемая дата родов' : 'Дата рождения'} value=${date} inputmode="numeric" placeholder="ДД.ММ.ГГГГ" onInput=${(v) => setDate(maskDate(v))}
        hint=${d ? (expecting ? expectingLine(d, now()) : d <= now() ? `Сейчас ${ageText(d, now())}` : '') : ''} />
      ${!expecting && html`
        <div class="sec-title">Пол · по желанию</div>
        <div class="pills">${[['girl', 'Девочка'], ['boy', 'Мальчик'], ['none', 'Не указывать']].map(([k, l]) => html`<${Pill} on=${sex === k} onClick=${() => setSex(k)}>${l}<//>`)}</div>
        <div class="sec-title">Срок рождения · по желанию</div>
        <${GestStepper} value=${gest} onChange=${setGest} />
        ${others.length > 0 && html`
          <div class="sec-title">Близнецы</div>
          <div class="pills">${others.map((o) => html`<${Pill} on=${twin === o.id} onClick=${() => setTwin(twin === o.id ? null : o.id)}>Двойня с ${o.name}<//>`)}</div>`}`}
      <label class="btn btn-gray">${photo ? 'Фото выбрано' : 'Фото'}<input type="file" accept="image/*" style="display:none" onChange=${(e) => setPhoto(e.target.files[0])} /></label>
      <button class="btn btn-primary" disabled=${!ok} onClick=${save}>Сохранить</button>
      ${!isNew && html`<button class="btn-quiet" onClick=${() => confirmAction({ title: 'Убрать карточку?', text: 'Записи этого ребёнка тоже удалятся с телефона.', yes: 'Убрать', onYes: () => { update((st) => { st.children = st.children.filter((x) => x.id !== c.id); st.records = st.records.filter((r) => r.childId !== c.id); st.activeChildId = st.children[0] ? st.children[0].id : null; }); go('/profil', { replace: true }); } })}>Убрать карточку</button>`}
    </div>`;
}

function TopicsSettings() {
  const s = useStore();
  const toggle = (k) => update((d) => { d.topics = d.topics.includes(k) ? d.topics.filter((x) => x !== k) : [...d.topics, k]; });
  return html`
    <div class="screen">
      <${Back} title="Что сейчас волнует" />
      <p class="lead">С этих тем начинаются статьи на «Сегодня».</p>
      <div class="pills">${TOPICS.map(([k, l]) => html`<${Pill} on=${s.topics.includes(k)} onClick=${() => toggle(k)}>${l}<//>`)}</div>
    </div>`;
}

function Buttons() {
  const s = useStore();
  const hidden = s.settings.hiddenButtons || [];
  const toggle = (k) => update((d) => { const h = d.settings.hiddenButtons || []; d.settings.hiddenButtons = h.includes(k) ? h.filter((x) => x !== k) : [...h, k]; });
  const child = (s.children.find((c) => c.id === s.activeChildId) || s.children[0]);
  const m = child && !child.expecting ? ageMonths(child, now()) : 0;
  const items = [['sleep', 'Сон'], ['feed', 'Кормление'], ['diaper', 'Подгузник'], ['food', 'Еда'], ['potty', 'Горшок']].filter(([k]) => quickTypes(m).includes(k) || (k === 'potty' && recordAllowed('potty', m) && m < 36));
  return html`
    <div class="screen">
      <${Back} title="Быстрая запись" />
      ${items.length ? html`<p class="lead">Что показывать в «Записать» и на «Ребёнке». Что не записываете — уберите, прошлые записи останутся.</p>
      <div class="pills">${items.map(([k, l]) => html`<${Pill} on=${!hidden.includes(k)} onClick=${() => toggle(k)}>${l}<//>`)}</div>`
      : html`<p class="lead">С трёх лет быстрых записей нет: сон и еду дошкольника почти никто не записывает. Всё нужное — в «＋ Записать»: кружки, дела, температура, к врачу, моменты.</p>`}
    </div>`;
}

function City() {
  const s = useStore();
  const cities = ['Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань', 'Нижний Новгород', 'Краснодар', 'Самара', 'Ростов-на-Дону', 'Уфа'];
  return html`
    <div class="screen">
      <${Back} title="Город для погоды" />
      <div class="pills">${cities.map((c) => html`<${Pill} on=${s.settings.city === c} onClick=${() => update((d) => { d.settings.city = c; d.weather = null; })}>${c}<//>`)}</div>
    </div>`;
}

// Копия записей — файл, который открывается на другом телефоне
function Backup() {
  const pack = () => JSON.stringify({ app: 'nen-veb', v: 1, at: Date.now(), state: { ...getState(), demo: {} } });
  const copy = async () => {
    try { await navigator.clipboard.writeText(pack()); track('копия:скопирована'); toast({ text: 'Скопировали. Вставьте текст в заметки или отправьте себе в мессенджер', ms: 4000 }); }
    catch (e) { toast({ text: 'Не получилось скопировать. Попробуйте «Сохранить файлом»', ms: 3000 }); }
  };
  const download = () => {
    const blob = new Blob([pack()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nen-kopiya-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    track('копия:сделана');
  };
  return html`
    <div class="screen">
      <${Back} title="Копия записей" />
      <p class="lead">Все записи, дети и заметки — одним текстом или файлом. Пригодится для нового телефона: на нём на первом экране нажмите «Перенести записи» и вставьте копию.</p>
      <p class="small">Фото в копию не попадают.</p>
      <button class="btn btn-primary" onClick=${copy}>Скопировать текстом</button>
      <button class="btn btn-gray" onClick=${download}>Сохранить файлом</button>
      <button class="btn btn-gray" onClick=${() => go('/profil/perenos')}>Перенести с другого телефона</button>
    </div>`;
}

// Для исследования: отчёт недели, режим показа, сброс
function Research() {
  const s = useStore();
  const rep = statsReport();
  const copy = async () => {
    try { await navigator.clipboard.writeText(rep); toast({ text: 'Отчёт скопирован — отправьте его исследователю', ms: 3000 }); }
    catch (e) { toast({ text: 'Не получилось скопировать — выделите текст и скопируйте вручную', ms: 3000 }); }
  };
  const demo = (k, v) => update((d) => { d.demo = { ...d.demo, [k]: d.demo[k] === v ? null : v }; });
  return html`
    <div class="screen">
      <${Back} title="Для исследования" />
      <p class="lead">Здесь только обезличенный счёт: в какие дни открывали приложение и что нажимали. Имён, дат, текстов записей и заметок в отчёте нет.</p>
      <div class="note-box" style="white-space:pre-wrap;font-size:12px;max-height:240px;overflow:auto">${rep}</div>
      <button class="btn btn-primary" onClick=${copy}>Скопировать отчёт</button>
      <${SecTitle}>Режим показа — для встреч<//>
      <p class="small">Меняет только время суток на экране, записи остаются настоящими.</p>
      <div class="pills">
        ${[['day', 'День'], ['evening', 'Вечер'], ['night', 'Ночь']].map(([k, l]) => html`<${Pill} on=${s.demo.timeOfDay === k} onClick=${() => demo('timeOfDay', k)}>${l}<//>`)}
      </div>
      <div class="pills">
        <${Pill} on=${s.demo.course} onClick=${() => update((d) => { d.demo = { ...d.demo, course: !d.demo.course }; })}>С курсом<//>
        <${Pill} on=${s.demo.club} onClick=${() => update((d) => { d.demo = { ...d.demo, club: !d.demo.club }; })}>В Клубе<//>
        <${Pill} on=${s.demo.offline} onClick=${() => update((d) => { d.demo = { ...d.demo, offline: !d.demo.offline }; })}>Без сети<//>
      </div>
      <p class="small">Редкие состояния — посмотреть, как выглядят:</p>
      <div class="pills">
        <button class="pill" onClick=${() => go('/moy-nen?sostoyanie=pusto')}>«Мой НЭН»: пусто</button>
        <button class="pill" onClick=${() => go('/moy-nen?sostoyanie=pervyy-zapusk')}>Первый запуск без сети</button>
      </div>
      <${SecTitle}>Первый вход<//>
      <p class="small">Пройти его ещё раз, как в первый день. Записи, дети и заметки не тронутся.</p>
      <button class="btn btn-gray" onClick=${startPreview}>Посмотреть первый вход</button>
      <${SecTitle}>Начать заново<//>
      <button class="btn btn-gray" onClick=${() => confirmAction({ title: 'Стереть всё?', text: 'Записи, дети и заметки на этом телефоне удалятся, приложение начнётся с первого экрана.', yes: 'Стереть всё', onYes: () => { resetAll(); resetStats(); go('/start', { replace: true }); } })}>Стереть всё и начать с первого экрана</button>
    </div>`;
}

// Для проверки на людях: что за телефон и браузер, работает ли хранение. Без имён и записей.
function Diagnostics() {
  const ua = navigator.userAgent;
  const ios = (/OS (\d+)_(\d+)/.exec(ua) || []).slice(1).join('.');
  const where = /Telegram/i.test(ua) ? 'браузер Telegram' : /CriOS/.test(ua) ? 'Chrome на айфоне' : /FxiOS/.test(ua) ? 'Firefox на айфоне' : /Safari/.test(ua) && /iPhone|iPad/.test(ua) ? 'Safari' : /Android/.test(ua) ? 'Android' : 'компьютер';
  const standalone = navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  const ver = ((document.querySelector('script[src*="app.js"]') || {}).src || '').split('v=')[1] || '—';
  const lines = [
    `Версия веб-версии: ${ver}`,
    `Телефон: ${/iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : 'другое'}${ios ? ', iOS ' + ios : ''}`,
    `Открыто: ${standalone ? 'с экрана телефона (как приложение)' : where}`,
    `Хранение записей: ${storage.ok ? 'работает' : 'не работает — ' + storage.error}`,
    `Сохранение без structuredClone: ${typeof structuredClone === 'function' ? 'не нужно' : 'включено'}`,
    `Детей: ${getState().children.length}, записей: ${getState().records.length}`,
  ];
  const text = lines.join('\n') + '\n' + ua;
  const copy = async () => { try { await navigator.clipboard.writeText(text); toast({ text: 'Скопировали — отправьте Анастасии', ms: 2500 }); } catch (e) { toast({ text: 'Не скопировалось — сделайте снимок экрана', ms: 3000 }); } };
  return html`
    <div class="screen">
      <${Back} title="Если что-то не работает" />
      <p class="lead">Сделайте снимок этого экрана или скопируйте текст и пришлите нам — так мы быстрее поймём, что сломалось. Имён и записей здесь нет.</p>
      <div class="note-box" style="white-space:pre-wrap;font-size:13px">${lines.join('\n')}</div>
      <button class="btn btn-primary" onClick=${copy}>Скопировать</button>
    </div>`;
}

export const profileRoutes = [
  { path: '/profil/pomosh', view: Diagnostics },
  { path: '/profil', view: Profile },
  { path: '/profil/rebyonok/:id', view: ChildCard },
  { path: '/profil/temy', view: TopicsSettings },
  { path: '/profil/knopki', view: Buttons },
  { path: '/profil/gorod', view: City },
  { path: '/profil/kopiya', view: Backup },
  { path: '/profil/perenos', view: Transfer },
  { path: '/profil/issledovanie', view: Research },
];
